# Deployment Guide for Python ADK Service

## Option 1: Google Cloud Run (Recommended)

### Prerequisites
- Google Cloud SDK (`gcloud`) installed
- Docker installed
- Google Cloud project with billing enabled

### Steps

1. **Install Google Cloud SDK** (if not already installed):
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Or download from: https://cloud.google.com/sdk/docs/install
   ```

2. **Authenticate with Google Cloud**:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Enable Required APIs**:
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   ```

4. **Build and Deploy**:
   ```bash
   cd python-adk-service
   
   # Build and push to Google Container Registry
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/adk-coach-service
   
   # Deploy to Cloud Run
   gcloud run deploy adk-coach-service \
     --image gcr.io/YOUR_PROJECT_ID/adk-coach-service \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars "GOOGLE_API_KEY=your_key_here,MODEL_NAME=gemini-2.0-flash-live-001" \
     --memory 1Gi \
     --timeout 300 \
     --max-instances 10
   ```

5. **Get the Service URL**:
   ```bash
   gcloud run services describe adk-coach-service --region us-central1 --format 'value(status.url)'
   ```

6. **Update Vercel Environment Variable**:
   - Add `PYTHON_ADK_SERVICE_URL` to Vercel with the Cloud Run URL

## Option 2: Firebase Cloud Functions (Gen 2)

### Steps

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Initialize Firebase Functions** (if not already done):
   ```bash
   firebase init functions
   # Choose Python runtime
   ```

3. **Move service to functions directory**:
   ```bash
   # Copy python-adk-service to firebase/functions/
   ```

4. **Deploy**:
   ```bash
   firebase deploy --only functions
   ```

## Option 3: Docker + Any Cloud Provider

### Build Docker Image
```bash
cd python-adk-service
docker build -t adk-coach-service .
```

### Run Locally for Testing
```bash
docker run -p 8000:8000 \
  -e GOOGLE_API_KEY=your_key \
  -e MODEL_NAME=gemini-2.0-flash-live-001 \
  adk-coach-service
```

### Push to Container Registry
```bash
# Tag for your registry
docker tag adk-coach-service YOUR_REGISTRY/adk-coach-service:latest
docker push YOUR_REGISTRY/adk-coach-service:latest
```

## Option 4: Railway/Render/Fly.io

### Railway
1. Connect GitHub repository
2. Set environment variables in Railway dashboard
3. Railway auto-detects Dockerfile and deploys

### Render
1. Create new Web Service
2. Connect repository
3. Set build command: `docker build -t app .`
4. Set start command: `docker run -p $PORT:8000 app`
5. Add environment variables

### Fly.io
```bash
fly launch
fly secrets set GOOGLE_API_KEY=your_key
fly deploy
```

## Environment Variables

Set these in your deployment platform:

- `GOOGLE_API_KEY`: Your Google AI API key
- `MODEL_NAME`: Model to use (default: gemini-2.0-flash-live-001)
- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `CORS_ORIGINS`: Comma-separated allowed origins (default: *)

## Testing Deployment

After deployment, test the health endpoint:
```bash
curl https://your-service-url.run.app/health
```

Test the coach endpoint:
```bash
curl -X POST https://your-service-url.run.app/api/coach/stream \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"content": "Hello", "isUser": true}]}'
```

## Update Vercel

Once deployed, update your Vercel environment variable:
```
PYTHON_ADK_SERVICE_URL=https://your-service-url.run.app
```

The Vercel API will automatically proxy to the Python service when this variable is set.

