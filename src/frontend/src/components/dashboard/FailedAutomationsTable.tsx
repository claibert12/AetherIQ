/**
 * Failed Automations Table Component
 * 
 * Displays recent automation failures with retry and details functionality.
 */

import React from 'react';
import { format, parseISO } from 'date-fns';
import { 
  ExclamationTriangleIcon, 
  ArrowPathIcon,
  EyeIcon 
} from '@heroicons/react/24/outline';
import { InlineLoader } from '../common/LoadingSpinner';
import { IntegrationBadge } from '../common/Badge';
import { FailedAutomationData } from '../../hooks/useApi';

export interface FailedAutomationsTableProps {
  data: FailedAutomationData[];
  loading?: boolean;
  error?: Error | null;
  tenantId: string;
  onRetry?: (automationId: string) => void;
  onViewDetails?: (automationId: string) => void;
  className?: string;
}

export const FailedAutomationsTable: React.FC<FailedAutomationsTableProps> = ({
  data = [],
  loading = false,
  error = null,
  tenantId,
  onRetry,
  onViewDetails,
  className,
}) => {
  const formatTimestamp = (timestamp: string) => {
    try {
      return format(parseISO(timestamp), 'MMM dd, HH:mm');
    } catch {
      return timestamp;
    }
  };

  const truncateError = (error: string, maxLength: number = 60) => {
    if (error.length <= maxLength) return error;
    return error.substring(0, maxLength) + '...';
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="failed-table-loading">
        <InlineLoader />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8 text-error-600" data-testid="failed-table-error">
        <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4" />
        <p>Failed to load failed automations</p>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className={`p-4 text-center ${className}`}>
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">No failed automations</p>
          <p className="text-xs text-gray-500 mt-1">
            All automations are running successfully
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-testid="failed-automations-table">
      <div className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Workflow
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Integration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Error
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Retries
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((automation) => (
              <tr key={automation.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {automation.workflowName}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <IntegrationBadge 
                    integration={automation.integration}
                    status="error"
                    size="xs"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900 max-w-xs">
                    <span title={automation.errorMessage}>
                      {truncateError(automation.errorMessage)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {formatTimestamp(automation.timestamp)}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {automation.retryCount}/3
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    {onViewDetails && (
                      <button
                        onClick={() => onViewDetails(automation.id)}
                        className="text-primary-600 hover:text-primary-900"
                        title="View details"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                    )}
                    {onRetry && automation.retryCount < 3 && (
                      <button
                        onClick={() => onRetry(automation.id)}
                        className="text-warning-600 hover:text-warning-900"
                        title="Retry automation"
                      >
                        <ArrowPathIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Footer */}
      {data.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Showing {data.length} failed automation{data.length !== 1 ? 's' : ''}</span>
            <span>Last updated: {format(new Date(), 'HH:mm')}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FailedAutomationsTable; 