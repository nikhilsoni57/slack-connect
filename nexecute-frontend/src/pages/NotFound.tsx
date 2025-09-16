import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        
        <h1 className="text-6xl font-bold text-secondary-900 mb-4">404</h1>
        
        <h2 className="text-xl font-semibold text-secondary-900 mb-4">
          Page Not Found
        </h2>
        
        <p className="text-secondary-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="space-y-3">
          <Link
            to="/"
            className="btn-primary inline-block"
          >
            Go to Dashboard
          </Link>
          
          <div>
            <button
              onClick={() => window.history.back()}
              className="text-primary-600 hover:text-primary-800 font-medium"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}