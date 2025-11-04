import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useAuthStore } from '../store/authStore';

export default function Header() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleLogout = async () => {
    if (!auth) {
      console.error('Firebase auth not initialized');
      navigate('/');
      return;
    }
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold text-white">Math Problem Solver</h1>
      </div>
      <div className="flex items-center space-x-4">
        {user && (
          <>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-sm text-gray-300">{user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}
