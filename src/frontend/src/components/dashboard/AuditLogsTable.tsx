/**
 * Audit Logs Table Component
 * 
 * Displays recent user and system activities with filtering capabilities.
 */

import React from 'react';
import { format, parseISO } from 'date-fns';
import { 
  ExclamationTriangleIcon,
  EyeIcon,
  UserIcon,
  CogIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import { InlineLoader } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/Badge';
import { AuditLogEntry, DashboardFilters } from '../../hooks/useApi';

export interface AuditLogsTableProps {
  data: AuditLogEntry[];
  loading?: boolean;
  error?: Error | null;
  tenantId: string;
  filters?: DashboardFilters;
  onViewDetails?: (logId: string) => void;
  className?: string;
}

export const AuditLogsTable: React.FC<AuditLogsTableProps> = ({
  data = [],
  loading = false,
  error = null,
  tenantId,
  filters,
  onViewDetails,
  className,
}) => {
  const formatTimestamp = (timestamp: string) => {
    try {
      return format(parseISO(timestamp), 'MMM dd, HH:mm:ss');
    } catch {
      return timestamp;
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('user') || action.includes('User')) {
      return <UserIcon className="h-4 w-4 text-primary-500" />;
    }
    return <CogIcon className="h-4 w-4 text-gray-500" />;
  };

  const getActionType = (action: string) => {
    if (action.includes('create') || action.includes('add')) return 'success';
    if (action.includes('delete') || action.includes('remove')) return 'error';
    if (action.includes('update') || action.includes('modify')) return 'warning';
    return 'info';
  };

  const truncateDetails = (details: Record<string, any>, maxLength: number = 40) => {
    const summary = Object.keys(details).slice(0, 2).join(', ');
    if (summary.length <= maxLength) return summary;
    return summary.substring(0, maxLength) + '...';
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="audit-table-loading">
        <InlineLoader />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8 text-error-600" data-testid="audit-table-error">
        <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4" />
        <p>Failed to load audit logs</p>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className={`p-4 text-center ${className}`}>
        <div className="text-center">
          <ClipboardDocumentListIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">No audit logs</p>
          <p className="text-xs text-gray-500 mt-1">
            System activity will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} data-testid="audit-logs-table">
      <div className="overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resource
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {getActionIcon(log.action)}
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {log.action}
                      </div>
                      <StatusBadge 
                        status={getActionType(log.action)}
                        size="xs"
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {log.user}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {log.resource}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-500 max-w-xs">
                    <span title={JSON.stringify(log.details, null, 2)}>
                      {truncateDetails(log.details)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {formatTimestamp(log.timestamp)}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                  {onViewDetails && (
                    <button
                      onClick={() => onViewDetails(log.id)}
                      className="text-primary-600 hover:text-primary-900"
                      title="View details"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                  )}
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
            <span>Showing {data.length} audit log{data.length !== 1 ? 's' : ''}</span>
            <span>Last updated: {format(new Date(), 'HH:mm')}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsTable; 