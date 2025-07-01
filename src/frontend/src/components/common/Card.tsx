/**
 * Card Component
 * 
 * Reusable card component with enterprise styling and flexible content.
 */

import React from 'react';
import { clsx } from 'clsx';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
  hover?: boolean;
  onClick?: () => void;
  testId?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  title,
  subtitle,
  headerActions,
  padding = 'md',
  shadow = 'md',
  border = true,
  hover = false,
  onClick,
  testId,
}) => {
  const cardClasses = clsx(
    'bg-white rounded-xl',
    {
      // Padding variants
      'p-0': padding === 'none',
      'p-3': padding === 'sm',
      'p-6': padding === 'md',
      'p-8': padding === 'lg',
      
      // Shadow variants
      'shadow-none': shadow === 'none',
      'shadow-sm': shadow === 'sm',
      'shadow-soft': shadow === 'md',
      'shadow-large': shadow === 'lg',
      
      // Border
      'border border-gray-100': border,
      
      // Hover effects
      'hover:shadow-medium transition-shadow duration-200 cursor-pointer': hover || onClick,
    },
    className
  );

  const headerClasses = clsx(
    'flex items-center justify-between',
    {
      'mb-4': padding === 'sm',
      'mb-6': padding === 'md' || padding === 'lg',
      'p-6 pb-4': padding === 'none' && (title || subtitle || headerActions),
    }
  );

  const contentClasses = clsx({
    'px-6 pb-6': padding === 'none' && (title || subtitle || headerActions),
  });

  return (
    <div 
      className={cardClasses} 
      onClick={onClick}
      data-testid={testId}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {(title || subtitle || headerActions) && (
        <div className={headerClasses}>
          <div className="flex-1">
            {title && (
              <h3 className="text-lg font-semibold text-gray-900 leading-6">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500 leading-5">
                {subtitle}
              </p>
            )}
          </div>
          {headerActions && (
            <div className="flex-shrink-0 ml-4">
              {headerActions}
            </div>
          )}
        </div>
      )}
      
      <div className={contentClasses}>
        {children}
      </div>
    </div>
  );
};

export default Card; 