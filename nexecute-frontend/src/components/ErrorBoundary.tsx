import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send error to monitoring service in production
    if (import.meta.env.PROD) {
      // TODO: Send to error monitoring service (e.g., Sentry)
    }
  }

  retry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback component
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.retry} />;
      }

      // Default error UI
      return <DefaultErrorFallback error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  retry: () => void;
}

function DefaultErrorFallback({ error, retry }: ErrorFallbackProps) {
  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-screen bg-secondary-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          
          <h1 className="text-xl font-semibold text-gray-900 mb-4">
            Something went wrong
          </h1>
          
          <p className="text-gray-600 mb-6">
            An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
          </p>

          {isDev && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6 text-left">
              <h3 className="text-sm font-medium text-red-800 mb-2">Error Details (Development)</h3>
              <pre className="text-xs text-red-700 whitespace-pre-wrap break-words">
                {error.name}: {error.message}
                {error.stack && '\n\nStack Trace:\n' + error.stack}
              </pre>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={retry}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              className="btn-secondary flex items-center justify-center gap-2"
            >
              <Home className="h-4 w-4" />
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for error boundary
export function useErrorBoundary() {
  return (error: Error) => {
    throw error;
  };
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}