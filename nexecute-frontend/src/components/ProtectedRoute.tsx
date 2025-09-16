import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingScreen } from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user';
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ 
  children, 
  requiredRole,
  fallback 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Show loading while checking authentication
  if (isLoading) {
    return <LoadingScreen message="Verifying authentication..." />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate 
        to="/login" 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // Check role-based access
  if (requiredRole && user.role !== requiredRole) {
    // If admin role is required but user is not admin
    if (requiredRole === 'admin' && user.role !== 'admin') {
      return (
        fallback || (
          <div className="min-h-screen bg-secondary-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
              <div className="bg-white shadow-lg rounded-lg p-8 text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
                  <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                
                <h1 className="text-xl font-semibold text-gray-900 mb-4">
                  Access Denied
                </h1>
                
                <p className="text-gray-600 mb-6">
                  You don't have permission to access this page. Please contact your administrator if you believe this is an error.
                </p>

                <button
                  onClick={() => window.history.back()}
                  className="btn-primary"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )
      );
    }
  }

  return <>{children}</>;
}

// HOC version for class components or additional flexibility
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    requiredRole?: 'admin' | 'user';
    fallback?: React.ReactNode;
  }
) {
  const ProtectedComponent = (props: P) => (
    <ProtectedRoute 
      requiredRole={options?.requiredRole}
      fallback={options?.fallback}
    >
      <Component {...props} />
    </ProtectedRoute>
  );

  ProtectedComponent.displayName = `withProtectedRoute(${Component.displayName || Component.name})`;

  return ProtectedComponent;
}

// Hook for imperative access checks
export function useAccessControl() {
  const { user, isAuthenticated } = useAuth();

  const hasRole = (role: 'admin' | 'user') => {
    if (!isAuthenticated || !user) return false;
    return user.role === role;
  };

  const isAdmin = () => hasRole('admin');
  const isUser = () => hasRole('user');

  const canAccess = (requiredRole?: 'admin' | 'user') => {
    if (!requiredRole) return isAuthenticated;
    return hasRole(requiredRole);
  };

  return {
    hasRole,
    isAdmin,
    isUser,
    canAccess,
    currentRole: user?.role,
  };
}