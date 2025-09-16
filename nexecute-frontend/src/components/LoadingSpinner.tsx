import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'white';
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const colorClasses = {
  primary: 'text-primary-600',
  secondary: 'text-secondary-600',
  white: 'text-white',
};

export function LoadingSpinner({ 
  size = 'md', 
  color = 'primary', 
  className 
}: LoadingSpinnerProps) {
  return (
    <Loader2 
      className={cn(
        'animate-spin',
        sizeClasses[size],
        colorClasses[color],
        className
      )} 
    />
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
  className?: string;
}

export function LoadingOverlay({ 
  isLoading, 
  message, 
  children, 
  className 
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" />
            {message && (
              <p className="text-sm text-secondary-600 font-medium">
                {message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export function LoadingScreen({ 
  message = 'Loading...', 
  className 
}: LoadingScreenProps) {
  return (
    <div className={cn(
      'min-h-screen bg-secondary-50 flex items-center justify-center',
      className
    )}>
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="xl" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-secondary-900 mb-1">
            Nexecute Connect
          </h2>
          <p className="text-sm text-secondary-600">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

interface ButtonLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export function ButtonWithLoading({ 
  isLoading, 
  children, 
  className,
  disabled,
  ...props 
}: ButtonLoadingProps) {
  return (
    <button
      {...props}
      disabled={isLoading || disabled}
      className={cn(
        'flex items-center justify-center gap-2',
        className
      )}
    >
      {isLoading && <LoadingSpinner size="sm" color="white" />}
      {children}
    </button>
  );
}