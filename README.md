# Math Problem Solver MVP

A web-based application that enables middle school students to solve math problems by drawing them directly on an interactive full-screen canvas. The application uses GPT-4 Vision to analyze the problem and provides step-by-step solutions through a floating chatbot interface.

## Features

- 🔐 **Firebase Authentication** - Secure user authentication with email/password
- 🎨 **Full-Screen Canvas** - Interactive drawing canvas powered by Fabric.js
- ✏️ **Drawing Tools** - Pencil tool with 5 colors (black, red, blue, green, yellow), eraser, and clear
- 📤 **Image Input** - Upload, paste, or drag-and-drop images onto the canvas
- 🤖 **AI Chatbot** - Floating chatbot interface with step-by-step solutions
- 📐 **KaTeX Rendering** - Beautiful mathematical notation rendering
- 🔄 **Zoom & Pan** - Canvas supports zoom (mouse wheel) and pan (Ctrl/Cmd + drag)

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Canvas**: Fabric.js
- **Authentication**: Firebase Auth
- **Routing**: React Router v7
- **State Management**: Zustand
- **Math Rendering**: KaTeX
- **Backend**: Vercel Serverless Functions
- **AI**: OpenAI GPT-4 Vision API

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication → Email/Password provider
3. Get your Firebase configuration from Project Settings → General → Your apps

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_URL=/api
```

### 4. OpenAI API Key

For local development, you'll need to set up the API route. For Vercel deployment:

1. Add `OPENAI_API_KEY` to Vercel Environment Variables
2. The API route at `api/solve.ts` will automatically use it

### 5. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Deployment to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables:
   - All `VITE_*` variables from `.env.local`
   - `OPENAI_API_KEY` (server-side only)
4. Deploy!

The Vercel serverless function at `api/solve.ts` will automatically be deployed.

## Project Structure

```
src/
├── components/
│   ├── Canvas.tsx          # Full-screen canvas with drawing tools
│   ├── Chatbot.tsx         # Floating chatbot interface
│   ├── Header.tsx          # Header with user menu
│   ├── LandingPage.tsx     # Landing page
│   ├── ProtectedRoute.tsx # Route protection wrapper
│   ├── SignInPage.tsx      # Sign in page
│   └── SignUpPage.tsx      # Sign up page
├── lib/
│   └── firebase.ts         # Firebase configuration
├── pages/
│   └── CanvasPage.tsx      # Main canvas page
├── store/
│   └── authStore.ts        # Zustand auth store
├── App.tsx                 # Main app with routing
└── main.tsx                # Entry point

api/
└── solve.ts                # Vercel serverless function for GPT-4 Vision
```

## Usage

1. **Sign Up/Sign In**: Create an account or sign in with existing credentials
2. **Draw or Upload**: Draw your math problem on the canvas or upload/paste an image
3. **Use Tools**: Select colors, use eraser, or clear the canvas
4. **Solve**: Click "Solve Problem" button
5. **View Solution**: The chatbot will open with step-by-step solution including rendered math notation

## Keyboard Shortcuts

- **Ctrl/Cmd + V**: Paste image from clipboard
- **Mouse Wheel**: Zoom in/out on canvas
- **Ctrl/Cmd + Drag**: Pan the canvas

## Notes

- The canvas is optimized for desktop viewports (1024px+)
- Images are sent as base64-encoded PNG to the API
- Mathematical notation uses KaTeX format: `$inline$` or `$$block$$`
- All API keys are stored server-side only (never exposed to client)

## License

MIT