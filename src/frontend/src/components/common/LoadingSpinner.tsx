/**
 * Loading Spinner Component
 * 
 * Flexible loading spinner with multiple size and color variants.
 */

import React from 'react';
import { clsx } from 'clsx';

export interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'gray';
  className?: string;
  testId?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className,
  testId,
}) => {
  const spinnerClasses = clsx(
    'animate-spin rounded-full border-2',
    {
      // Size variants
      'h-3 w-3': size === 'xs',
      'h-4 w-4': size === 'sm',
      'h-6 w-6': size === 'md',
      'h-8 w-8': size === 'lg',
      'h-12 w-12': size === 'xl',
      
      // Color variants
      'border-gray-300 border-t-primary-600': color === 'primary',
      'border-gray-200 border-t-white': color === 'white',
      'border-gray-200 border-t-gray-600': color === 'gray',
    },
    className
  );

  return (
    <div 
      className={spinnerClasses}
      data-testid={testId}
      role="status"
      aria-label="Loading"
    />
  );
};

// Overlay Loading Spinner
export interface OverlayLoaderProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const OverlayLoader: React.FC<OverlayLoaderProps> = ({
  text = 'Loading...',
  size = 'md',
  className,
}) => {
  return (
    <div className={clsx(
      'fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50',
      className
    )}>
      <div className="text-center">
        <LoadingSpinner size={size} />
        {text && (
          <p className="mt-4 text-sm text-gray-600">{text}</p>
        )}
      </div>
    </div>
  );
};

// Page Loading Spinner
export interface PageLoaderProps {
  text?: string;
  className?: string;
}

export const PageLoader: React.FC<PageLoaderProps> = ({
  text = 'Loading...',
  className,
}) => {
  return (
    <div className={clsx(
      'flex items-center justify-center py-12',
      className
    )}>
      <div className="text-center">
        <LoadingSpinner size="lg" />
        {text && (
          <p className="mt-4 text-sm text-gray-600">{text}</p>
        )}
      </div>
    </div>
  );
};

// Button Loading Spinner
export interface ButtonLoaderProps {
  size?: 'xs' | 'sm' | 'md';
  color?: 'primary' | 'white' | 'gray';
  className?: string;
}

export const ButtonLoader: React.FC<ButtonLoaderProps> = ({
  size = 'sm',
  color = 'white',
  className,
}) => {
  return <LoadingSpinner size={size} color={color} className={className} />;
};

// Inline Loading Spinner with Text
export interface InlineLoaderProps {
  text?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const InlineLoader: React.FC<InlineLoaderProps> = ({
  text = 'Loading...',
  size = 'sm',
  className,
}) => {
  return (
    <div className={clsx('flex items-center space-x-2', className)}>
      <LoadingSpinner size={size} />
      {text && (
        <span className="text-sm text-gray-600">{text}</span>
      )}
    </div>
  );
};

export default LoadingSpinner; 