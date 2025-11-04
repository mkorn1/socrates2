import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
}

export const useAuthStore = create<AuthState>((set) => {
  // Initialize auth state listener only if auth is available
  if (auth) {
    try {
      onAuthStateChanged(auth, (user) => {
        set({ user, loading: false, initialized: true });
      });
    } catch (error) {
      console.error('Auth state listener error:', error);
      set({ user: null, loading: false, initialized: true });
    }
  } else {
    // If auth is not configured, mark as initialized with no user
    set({ user: null, loading: false, initialized: true });
  }

  return {
    user: null,
    loading: true,
    initialized: false,
  };
});
