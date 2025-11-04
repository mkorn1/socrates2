import { initializeApp, getApps } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase is properly configured
const isFirebaseConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'your_firebase_api_key' &&
  firebaseConfig.authDomain &&
  firebaseConfig.authDomain !== 'your_project.firebaseapp.com' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'your_project_id';

// Initialize Firebase (avoid multiple initializations)
let app: FirebaseApp | null = null;
const apps = getApps();

if (apps.length === 0) {
  if (!isFirebaseConfigured) {
    console.warn(
      '⚠️ Firebase is not configured. Please set up your Firebase configuration in .env.local\n' +
      'See .env.example for the required environment variables.\n' +
      'Authentication features will not work until Firebase is configured.'
    );
    // Don't initialize Firebase if not configured - this will prevent 400 errors
  } else {
    try {
      // Validate that all required config values are present
      const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId'];
      const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);
      
      if (missingFields.length > 0) {
        console.error('❌ Missing Firebase configuration fields:', missingFields.join(', '));
        console.error('Please check your .env.local file');
        app = null;
      } else {
        app = initializeApp(firebaseConfig);
        console.log('✅ Firebase initialized successfully');
        console.log('Project ID:', firebaseConfig.projectId);
        console.log('Auth Domain:', firebaseConfig.authDomain);
      }
    } catch (error: any) {
      console.error('❌ Firebase initialization error:', error);
      if (error.code === 'app/invalid-app-options') {
        console.error('Invalid Firebase configuration. Please verify:');
        console.error('1. All values in .env.local are correct');
        console.error('2. API key matches the project');
        console.error('3. Project ID is correct');
        console.error('4. Auth domain matches: <project-id>.firebaseapp.com');
      }
      app = null;
    }
  }
} else {
  app = apps[0];
}

// Initialize Firebase Authentication only if app is initialized
export const auth: Auth | null = app ? getAuth(app) : null;
export const isConfigured = isFirebaseConfigured && app !== null;
export default app;
