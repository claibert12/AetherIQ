/**
 * Badge Component
 * 
 * Flexible badge component with multiple variants and sizes.
 */

import React from 'react';
import { clsx } from 'clsx';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  rounded?: boolean;
  className?: string;
  testId?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  rounded = true,
  className,
  testId,
}) => {
  const badgeClasses = clsx(
    'inline-flex items-center font-medium',
    {
      // Size variants
      'px-1.5 py-0.5 text-xs': size === 'xs',
      'px-2.5 py-0.5 text-xs': size === 'sm',
      'px-3 py-1 text-sm': size === 'md',
      'px-4 py-1 text-base': size === 'lg',
      
      // Rounded variants
      'rounded-full': rounded,
      'rounded-md': !rounded,
      
      // Color variants
      'bg-green-100 text-green-800': variant === 'success',
      'bg-yellow-100 text-yellow-800': variant === 'warning',
      'bg-red-100 text-red-800': variant === 'error',
      'bg-blue-100 text-blue-800': variant === 'info',
      'bg-gray-100 text-gray-800': variant === 'neutral',
    },
    className
  );

  return (
    <span className={badgeClasses} data-testid={testId}>
      {children}
    </span>
  );
};

// Status Badge with predefined colors
export interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'error' | 'success' | 'warning' | 'info';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  className,
}) => {
  const getVariant = (status: string) => {
    switch (status) {
      case 'active':
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'pending':
      case 'info':
        return 'info';
      case 'inactive':
      default:
        return 'neutral';
    }
  };

  const getLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <Badge 
      variant={getVariant(status)} 
      size={size} 
      className={className}
    >
      {getLabel(status)}
    </Badge>
  );
};

// Integration Badge with specific styling
export interface IntegrationBadgeProps {
  integration: 'google-workspace' | 'microsoft-365' | 'salesforce' | string;
  status?: 'healthy' | 'warning' | 'error';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const IntegrationBadge: React.FC<IntegrationBadgeProps> = ({
  integration,
  status = 'healthy',
  size = 'sm',
  className,
}) => {
  const getIntegrationName = (integration: string) => {
    switch (integration) {
      case 'google-workspace':
        return 'Google Workspace';
      case 'microsoft-365':
        return 'Microsoft 365';
      case 'salesforce':
        return 'Salesforce';
      default:
        return integration.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'neutral';
    }
  };

  return (
    <Badge 
      variant={getVariant(status)} 
      size={size} 
      className={className}
    >
      {getIntegrationName(integration)}
    </Badge>
  );
};

export default Badge;

 