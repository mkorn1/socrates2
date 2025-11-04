"""FastAPI application for ADK Coach Service"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from app.config import Config
from app.coach_agent import get_coach_agent
from google.adk.runners import InvocationContext, new_invocation_context_id
from google.adk.sessions import InMemorySessionService, Session
from google.adk.agents import RunConfig
from google.adk.agents.run_config import StreamingMode
from google.genai import types
import json
import asyncio
import uuid
from typing import Optional

app = FastAPI(title="ADK Coach Service", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize the coach agent on startup"""
    try:
        Config.validate()
        # Initialize agent
        get_coach_agent()
        print("✅ Coach agent initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize coach agent: {e}")
        raise

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "adk-coach"}

@app.post("/api/coach/stream")
async def coach_stream(request: Request):
    """
    Streaming endpoint for coach interactions.
    Supports Server-Sent Events (SSE) for real-time streaming.
    """
    try:
        body = await request.json()
        messages = body.get("messages", [])
        image = body.get("image")
        user_id = body.get("userId")
        
        if not messages and not image:
            raise HTTPException(status_code=400, detail="Messages or image required")
        
        # Get the coach agent
        agent = get_coach_agent()
        
        # Build the input text from messages
        if messages:
            # Get the last user message
            last_user_message = None
            for msg in reversed(messages):
                if msg.get("isUser"):
                    last_user_message = msg.get("content", "")
                    break
            
            input_text = last_user_message or "Hello! I'd like help with a math problem."
        else:
            input_text = "I have a math problem. Can you help me understand how to solve it?"
        
        # Create async generator for streaming
        async def generate_response():
            try:
                # Create session service and session
                session_service = InMemorySessionService()
                session_id = str(uuid.uuid4())
                session = Session(
                    id=session_id,
                    app_name="coach",
                    user_id=user_id or "anonymous"
                )
                
                # Create user content as Content object
                user_content = types.Content(
                    parts=[types.Part(text=input_text)],
                    role="user"
                )
                
                # Create run config with response modalities
                run_config = RunConfig(
                    response_modalities=["TEXT"],  # Specify TEXT for text-only responses
                    streaming_mode=StreamingMode.SSE  # Server-Sent Events for streaming
                )
                
                # Create invocation context with all required fields
                context = InvocationContext(
                    session_service=session_service,
                    invocation_id=new_invocation_context_id(),
                    agent=agent,
                    user_content=user_content,
                    session=session,
                    run_config=run_config
                )
                
                # Use ADK agent's run_live method for streaming responses
                # run_live returns an AsyncGenerator[Event, None]
                event_stream = agent.run_live(context)
                
                # Stream the response events
                async for event in event_stream:
                    # Extract text content from event
                    # Events may have different content formats - check for common fields
                    text_content = None
                    
                    # Try to get text from event in various ways
                    if hasattr(event, 'content') and event.content:
                        if isinstance(event.content, str):
                            text_content = event.content
                        elif isinstance(event.content, list):
                            # Content might be a list of parts
                            for part in event.content:
                                if isinstance(part, str):
                                    text_content = part
                                    break
                                elif hasattr(part, 'text'):
                                    text_content = part.text
                                    break
                    
                    # Try alternative fields
                    if not text_content:
                        if hasattr(event, 'text'):
                            text_content = event.text
                        elif hasattr(event, 'message'):
                            if isinstance(event.message, str):
                                text_content = event.message
                            elif hasattr(event.message, 'content'):
                                text_content = event.message.content
                    
                    # If we found text content, stream it
                    if text_content:
                        yield f"data: {json.dumps({'content': text_content, 'done': False})}\n\n"
                    
                    # Check if this is the final response
                    if hasattr(event, 'is_final_response') and event.is_final_response():
                        break
                
                # Send completion signal
                yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
                
            except Exception as e:
                error_msg = str(e) if str(e) else "Unknown error"
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
        
        return StreamingResponse(
            generate_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/coach")
async def coach_non_streaming(request: Request):
    """
    Non-streaming endpoint for coach interactions (fallback).
    """
    try:
        body = await request.json()
        messages = body.get("messages", [])
        image = body.get("image")
        
        if not messages and not image:
            raise HTTPException(status_code=400, detail="Messages or image required")
        
        agent = get_coach_agent()
        
        # Build input text
        if messages:
            last_user_message = None
            for msg in reversed(messages):
                if msg.get("isUser"):
                    last_user_message = msg.get("content", "")
                    break
            input_text = last_user_message or "Hello! I'd like help with a math problem."
        else:
            input_text = "I have a math problem. Can you help me understand how to solve it?"
        
        # Create session service and session
        session_service = InMemorySessionService()
        session_id = str(uuid.uuid4())
        session = Session(
            id=session_id,
            app_name="coach",
            user_id="anonymous"
        )
        
        # Create user content as Content object
        user_content = types.Content(
            parts=[types.Part(text=input_text)],
            role="user"
        )
        
        # Create run config with response modalities
        run_config = RunConfig(
            response_modalities=["TEXT"],  # Specify TEXT for text-only responses
            streaming_mode=StreamingMode.SSE  # Server-Sent Events for streaming
        )
        
        # Create invocation context with all required fields
        context = InvocationContext(
            session_service=session_service,
            invocation_id=new_invocation_context_id(),
            agent=agent,
            user_content=user_content,
            session=session,
            run_config=run_config
        )
        
        # Get response (non-streaming) using run_async
        event_stream = agent.run_async(context)
        
        # Collect full response from events
        full_response = ""
        async for event in event_stream:
            # Extract text content from event
            text_content = None
            
            if hasattr(event, 'content') and event.content:
                if isinstance(event.content, str):
                    text_content = event.content
                elif isinstance(event.content, list):
                    for part in event.content:
                        if isinstance(part, str):
                            text_content = part
                            break
                        elif hasattr(part, 'text'):
                            text_content = part.text
                            break
            
            if not text_content:
                if hasattr(event, 'text'):
                    text_content = event.text
                elif hasattr(event, 'message'):
                    if isinstance(event.message, str):
                        text_content = event.message
                    elif hasattr(event.message, 'content'):
                        text_content = event.message.content
            
            if text_content:
                full_response += text_content
        
        return {"message": full_response}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    Config.validate()
    uvicorn.run(
        "app.main:app",
        host=Config.HOST,
        port=Config.PORT,
        reload=True
    )

