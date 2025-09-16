import React from 'react';
import { cn } from '../utils/cn';

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

export function Skeleton({ className, children, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-secondary-200', className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Common skeleton patterns
export function SkeletonText({ className }: { className?: string }) {
  return <Skeleton className={cn('h-4 w-full', className)} />;
}

export function SkeletonTitle({ className }: { className?: string }) {
  return <Skeleton className={cn('h-6 w-3/4', className)} />;
}

export function SkeletonAvatar({ className }: { className?: string }) {
  return <Skeleton className={cn('h-10 w-10 rounded-full', className)} />;
}

export function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-10 w-24 rounded-lg', className)} />;
}

export function SkeletonCard({ 
  className, 
  children 
}: { 
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('card space-y-4', className)}>
      {children || (
        <>
          <SkeletonTitle />
          <div className="space-y-2">
            <SkeletonText />
            <SkeletonText className="w-5/6" />
            <SkeletonText className="w-4/6" />
          </div>
          <div className="flex gap-2">
            <SkeletonButton />
            <SkeletonButton />
          </div>
        </>
      )}
    </div>
  );
}

// Table skeleton
export function SkeletonTable({ 
  rows = 5, 
  cols = 4,
  className 
}: { 
  rows?: number; 
  cols?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Table header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonText key={`header-${i}`} className="h-6" />
        ))}
      </div>
      
      {/* Table rows */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div 
            key={`row-${rowIndex}`}
            className="grid gap-4" 
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: cols }).map((_, colIndex) => (
              <SkeletonText key={`cell-${rowIndex}-${colIndex}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// List skeleton
export function SkeletonList({ 
  items = 5,
  showAvatar = true,
  className 
}: { 
  items?: number;
  showAvatar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          {showAvatar && <SkeletonAvatar />}
          <div className="flex-1 space-y-2">
            <SkeletonText className="w-3/4" />
            <SkeletonText className="w-1/2 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Dashboard skeleton
export function SkeletonDashboard({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <SkeletonTitle className="h-8 w-64" />
        <SkeletonButton className="h-10 w-32" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <SkeletonText className="w-24 h-3" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-12 w-12 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Table */}
      <SkeletonCard>
        <SkeletonTable />
      </SkeletonCard>
    </div>
  );
}

// Form skeleton
export function SkeletonForm({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <SkeletonTitle />
      
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonText className="w-24 h-4" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <SkeletonButton className="w-32" />
        <SkeletonButton className="w-24" />
      </div>
    </div>
  );
}