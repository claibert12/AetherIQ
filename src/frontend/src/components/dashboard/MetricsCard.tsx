/**
 * Metrics Card Component
 * 
 * Displays key performance indicators with icons, values, trends, and descriptions.
 */

import React from 'react';
import { clsx } from 'clsx';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

export interface MetricsCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'neutral';
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  loading?: boolean;
  error?: Error | null;
  className?: string;
  testId?: string;
}

export const MetricsCard: React.FC<MetricsCardProps> = ({
  title,
  value,
  icon: Icon,
  color = 'primary',
  change,
  changeType = 'neutral',
  trend,
  description,
  loading = false,
  error = null,
  className,
  testId,
}) => {
  const cardClasses = clsx(
    'bg-white rounded-xl shadow-soft border border-gray-100 p-6 transition-all duration-200 hover:shadow-medium',
    className
  );

  const iconClasses = clsx(
    'h-8 w-8',
    {
      'text-primary-600': color === 'primary',
      'text-success-600': color === 'success',
      'text-warning-600': color === 'warning',
      'text-error-600': color === 'error',
      'text-gray-600': color === 'neutral',
    }
  );

  // Use trend if provided, otherwise fall back to changeType
  const actualChangeType = trend === 'up' ? 'positive' : 
                          trend === 'down' ? 'negative' : 
                          trend === 'neutral' ? 'neutral' : 
                          changeType;

  const changeClasses = clsx(
    'inline-flex items-center text-sm font-medium',
    {
      'text-success-600': actualChangeType === 'positive',
      'text-error-600': actualChangeType === 'negative',
      'text-gray-500': actualChangeType === 'neutral',
    }
  );

  if (loading) {
    return (
      <div className={cardClasses} data-testid={testId}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500 truncate">
            {title}
          </h3>
          <Icon className={iconClasses} />
        </div>
        <div className="mb-2">
          <div className="text-2xl font-bold text-gray-900">
            Loading...
          </div>
        </div>
        {description && (
          <div className="text-xs text-gray-500 truncate">
            {description}
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cardClasses} data-testid={testId}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500 truncate">
            {title}
          </h3>
          <Icon className="h-8 w-8 text-error-600" />
        </div>
        <div className="mb-2">
          <div className="text-2xl font-bold text-error-600">
            Error
          </div>
        </div>
        <div className="text-xs text-error-500 truncate">
          Failed to load data
        </div>
      </div>
    );
  }

  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      } else if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <div className={cardClasses} data-testid={testId}>
      {/* Header with title and icon */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 truncate">
          {title}
        </h3>
        <Icon className={iconClasses} />
      </div>

      {/* Main value */}
      <div className="mb-2">
        <div className="text-2xl font-bold text-gray-900">
          {formatValue(value)}
        </div>
      </div>

      {/* Change indicator and description */}
      <div className="flex items-center justify-between">
        {change && (
          <div className={changeClasses}>
            {actualChangeType === 'positive' && (
              <ArrowUpIcon className="h-3 w-3 mr-1" />
            )}
            {actualChangeType === 'negative' && (
              <ArrowDownIcon className="h-3 w-3 mr-1" />
            )}
            <span>{change}</span>
          </div>
        )}
        
        {description && (
          <div className="text-xs text-gray-500 truncate">
            {description}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsCard; 