import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';

// Demo authentication component to bypass login for testing
export function DemoAuth() {

  useEffect(() => {
    // Auto-login with demo user for testing
    if (import.meta.env.DEV) {
      const demoUser = {
        id: 'demo-user-1',
        email: 'admin@example.com',
        name: 'Demo Administrator',
        role: 'admin' as const,
        organizationId: 'demo-org',
        organizationName: 'Demo Organization',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const demoToken = 'demo-jwt-token';

      // Simulate login without API call
      useAuthStore.setState({
        user: demoUser,
        token: demoToken,
        isAuthenticated: true,
        isLoading: false,
        error: null
      });
    }
  }, []);

  return null; // This component doesn't render anything
}

// Add this to your Login page as a quick bypass button
export function DemoLoginButton() {

  const handleDemoLogin = () => {
    const demoUser = {
      id: 'demo-user-1',
      email: 'admin@example.com',
      name: 'Demo Administrator', 
      role: 'admin' as const,
      organizationId: 'demo-org',
      organizationName: 'Demo Organization',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const demoToken = 'demo-jwt-token';

    useAuthStore.setState({
      user: demoUser,
      token: demoToken,
      isAuthenticated: true,
      isLoading: false,
      error: null
    });
  };

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <button
        onClick={handleDemoLogin}
        className="w-full bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
      >
        🚀 Demo Login (Development Only)
      </button>
      <p className="text-xs text-gray-500 mt-2 text-center">
        This button bypasses authentication for testing purposes
      </p>
    </div>
  );
}