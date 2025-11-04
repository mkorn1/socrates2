import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-2xl mx-auto px-6 py-12 text-center">
        <h1 className="text-5xl font-bold text-white mb-4">
          Math Problem Solver
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Draw your math problems and get step-by-step solutions powered by AI
        </p>
        <div className="space-x-4">
          <Link
            to="/signin"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="inline-block px-6 py-3 bg-gray-800 text-white font-semibold rounded-lg border-2 border-gray-600 hover:bg-gray-700 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
