import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are a patient math tutor who teaches through the Socratic method.
Your goal is to help students discover solutions themselves through thoughtful questions.

CORE DIRECTIVES

Never give direct answers or full solutions.

Start each problem with broad, open-ended questions that invite planning and reasoning.

Ask guiding questions that lead students toward understanding, but do not jump into substeps unless the student hesitates, asks for help, or shows confusion twice in a row.

Validate correct reasoning and gently redirect incorrect ones.

Use encouraging, supportive, and age-appropriate language.

Break complex problems into smaller, focused sub-questions only when necessary.

Help students inventory what they know, identify their goal, and choose methods.

Use method-prompting questions such as: What methods might help here?

Guide, do not tell. For example: What should we do next? instead of Next, do this.

PROBLEM FLOW

Clarify what problem the student is solving.

Ask them to restate it in their own words.

Begin with exploratory prompts such as:

How would you approach this?

What information do you notice?

What are we trying to find?

Encourage them to describe a plan before doing computations.

If they struggle or stall for two turns, introduce a smaller guiding question.

Validate their reasoning at each step.

When a solution emerges, guide reflection and checking:

How can you check that makes sense?

Does the result seem reasonable?

Would your method still work if we changed the numbers?

End each problem by asking the student to summarize what they learned.

META-SOCRATIC HEURISTICS

Ask one small question at a time.

Favor curiosity over challenge. (What happens if... is better than Why didnt you...)

Wait after asking; allow reflection.

Validate partial reasoning. (That is a good direction; what would make it complete?)

Escalate abstraction gradually, moving from numeric to symbolic to conceptual.

If the student says I dont know, simplify or visualize the question.

Maintain a tone of calm curiosity, patience, and encouragement.

EXAMPLE INTERACTION
Student: If you have 3 apples and 4 oranges and you take away 2 fruits, how many fruits do you have left?
Tutor: Interesting. How would you start thinking about this?
Student: Maybe count them?
Tutor: That sounds like a solid plan. How many fruits are there to start with?
Student: Seven.
Tutor: Great. If two are taken away, how could we figure out what remains?
Student: Five.
Tutor: Nice. Does that make sense if you picture it?`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, messages, userId } = req.body;

    if (!image && (!messages || messages.length === 0)) {
      return res.status(400).json({ error: 'Image or messages are required' });
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google AI API key not configured' });
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Use the requested model - if it fails, the error will be caught and logged
    // Note: If gemini-2.0-flash-live-001 doesn't work, try:
    // - gemini-2.0-flash-exp (experimental)
    // - gemini-1.5-flash (stable, fast)
    // - gemini-1.5-pro (stable, more capable)
    const modelName = 'gemini-2.0-flash-live-001';
    console.log(`Attempting to use model: ${modelName}`);
    
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: SYSTEM_PROMPT,
    });

    // Build conversation history
    const conversationHistory: any[] = [];
    
    // Build messages for Gemini
    if (messages && messages.length > 0) {
      messages.forEach((msg: any, index: number) => {
        if (msg.isUser) {
          // For the last user message with images
          if (image && index === messages.length - 1) {
            conversationHistory.push({
              role: 'user',
              parts: [
                { text: msg.content },
                {
                  inlineData: {
                    data: image,
                    mimeType: 'image/png',
                  },
                },
              ],
            });
          } else {
            conversationHistory.push({ 
              role: 'user', 
              parts: [{ text: msg.content }] 
            });
          }
        } else {
          conversationHistory.push({ 
            role: 'model', 
            parts: [{ text: msg.content }] 
          });
        }
      });
    } else if (image) {
      // First message with image
      conversationHistory.push({
        role: 'user',
        parts: [
          { text: 'I have a math problem. Can you help me understand how to solve it?' },
          {
            inlineData: {
              data: image,
              mimeType: 'image/png',
            },
          },
        ],
      });
    } else {
      // First message without image
      conversationHistory.push({
        role: 'user',
        parts: [{ text: 'Hello! I\'d like help with a math problem.' }],
      });
    }

    // Start chat session (before setting headers to catch errors early)
    let chat;
    try {
      chat = model.startChat({
        history: conversationHistory.slice(0, -1), // All but the last message
      });
    } catch (chatError: any) {
      console.error('Error starting chat session:', chatError);
      throw new Error(`Failed to start chat: ${chatError.message}`);
    }

    // Get the last user message
    const lastMessage = conversationHistory[conversationHistory.length - 1];
    
    // Set up streaming response AFTER we know chat session is valid
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Vercel
    
    // Stream the response
    try {
      const result = await chat.sendMessageStream(lastMessage.parts);
      
      // Stream chunks to client
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          res.write(`data: ${JSON.stringify({ content: chunkText, done: false })}\n\n`);
        }
      }

      // Send completion signal
      res.write(`data: ${JSON.stringify({ content: '', done: true })}\n\n`);
      res.end();
    } catch (streamError: any) {
      console.error('Error during streaming:', streamError);
      console.error('Stream error details:', {
        message: streamError.message,
        status: streamError.status,
        statusText: streamError.statusText,
        stack: streamError.stack,
      });
      
      // Headers already sent, write error to stream
      const errorMessage = streamError.message || streamError.statusText || 'Error during streaming';
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    console.error('Error processing coach request:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
    });
    // Check if headers have been sent
    if (!res.headersSent) {
      // Headers not sent yet, return proper error response with detailed error
      return res.status(500).json({ 
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    } else {
      // Headers already sent, write error to stream
      res.write(`data: ${JSON.stringify({ error: error.message || 'Internal server error' })}\n\n`);
      res.end();
    }
  }
}

