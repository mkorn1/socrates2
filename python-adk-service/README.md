# Python ADK Coach Service

This is a Python FastAPI service that provides bidirectional streaming capabilities for the Coach feature using Google ADK (Agent Development Kit).

## Setup Instructions

### 1. Create Virtual Environment

```bash
cd python-adk-service
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` and add:
- `GOOGLE_API_KEY`: Your Google AI API key
- `MODEL_NAME`: Model to use (default: gemini-2.0-flash-live-001)

### 4. Run the Service

```bash
# Development mode
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or using Python directly
python -m app.main
```

The service will be available at `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /health
```

### Streaming Coach Endpoint
```
POST /api/coach/stream
Content-Type: application/json

Body:
{
  "messages": [
    {"content": "Hello", "isUser": true},
    {"content": "Hi there!", "isUser": false}
  ],
  "image": "base64_encoded_image_string",
  "userId": "user_id"
}
```

Returns: Server-Sent Events (SSE) stream

### Non-Streaming Coach Endpoint
```
POST /api/coach
Content-Type: application/json

Body: (same as above)
```

Returns: JSON response with complete message

## Docker Deployment

### Build Image
```bash
docker build -t adk-coach-service .
```

### Run Container
```bash
docker run -p 8000:8000 --env-file .env adk-coach-service
```

## Deployment to Google Cloud Run

See `DEPLOYMENT.md` for detailed instructions.

## Testing

Test the health endpoint:
```bash
curl http://localhost:8000/health
```

Test the coach endpoint:
```bash
curl -X POST http://localhost:8000/api/coach/stream \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"content": "Hello", "isUser": true}]}'
```

