/**
 * Integration Status Grid Component
 * 
 * Displays real-time health monitoring across all integrations.
 */

import React from 'react';
import { format, parseISO } from 'date-fns';
import { 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  WifiIcon,
  CloudIcon
} from '@heroicons/react/24/outline';
import Card from '../common/Card';
import { InlineLoader } from '../common/LoadingSpinner';
import { StatusBadge } from '../common/Badge';
import { IntegrationStatus } from '../../hooks/useApi';
import { useSyncIntegration, useTestIntegrationConnection } from '../../hooks/useApi';

export interface IntegrationStatusGridProps {
  integrations: IntegrationStatus[];
  loading?: boolean;
  error?: Error | null;
  tenantId: string;
  className?: string;
}

export const IntegrationStatusGrid: React.FC<IntegrationStatusGridProps> = ({
  integrations = [],
  loading = false,
  error = null,
  tenantId,
  className,
}) => {
  const syncMutation = useSyncIntegration();
  const testMutation = useTestIntegrationConnection();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon className="h-5 w-5 text-success-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-warning-500" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-error-500" />;
      default:
        return <WifiIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getIntegrationDisplayName = (name: string) => {
    switch (name) {
      case 'google-workspace':
        return 'Google Workspace';
      case 'microsoft-365':
        return 'Microsoft 365';
      case 'salesforce':
        return 'Salesforce';
      default:
        return name.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const formatLastSync = (timestamp: string) => {
    try {
      return format(parseISO(timestamp), 'MMM dd, HH:mm');
    } catch {
      return 'Unknown';
    }
  };

  const handleSync = async (integration: string) => {
    try {
      await syncMutation.mutateAsync({ tenantId, integration });
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleTest = async (integration: string) => {
    try {
      await testMutation.mutateAsync({ tenantId, integration });
    } catch (error) {
      console.error('Connection test failed:', error);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="integration-loading">
        <InlineLoader />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8 text-error-600" data-testid="integration-error">
        <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4" />
        <p>Failed to load integration status</p>
      </div>
    );
  }

  // Empty state
  if (!integrations || integrations.length === 0) {
    return (
      <div className={`p-4 text-center ${className}`}>
        <div className="text-center">
          <CloudIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">No integrations configured</p>
          <p className="text-xs text-gray-500 mt-1">
            Add integrations to monitor their status
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card 
      title="Integration Status" 
      subtitle="Real-time status of all integrations"
      className={className}
      data-testid="integration-status-grid"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((integration) => (
          <div
            key={integration.name}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                {getStatusIcon(integration.status)}
                <h4 className="font-medium text-gray-900">
                  {getIntegrationDisplayName(integration.name)}
                </h4>
              </div>
              <StatusBadge 
                status={integration.status === 'healthy' ? 'success' : 
                       integration.status === 'warning' ? 'warning' : 'error'}
                size="xs"
              />
            </div>

            {/* Metrics */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Users</span>
                <span className="font-medium text-gray-900">
                  {integration.userCount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Errors</span>
                <span className={`font-medium ${
                  integration.errorCount > 0 ? 'text-error-600' : 'text-gray-900'
                }`}>
                  {integration.errorCount}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Last Sync</span>
                <span className="text-gray-500 text-xs">
                  {formatLastSync(integration.lastSync)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleSync(integration.name)}
                disabled={syncMutation.isPending}
                className="flex-1 btn-secondary text-xs py-1 px-2 disabled:opacity-50"
                title="Sync integration"
              >
                {syncMutation.isPending ? (
                  <ArrowPathIcon className="h-3 w-3 animate-spin mx-auto" />
                ) : (
                  <>
                    <ArrowPathIcon className="h-3 w-3 mr-1" />
                    Sync
                  </>
                )}
              </button>
              <button
                onClick={() => handleTest(integration.name)}
                disabled={testMutation.isPending}
                className="flex-1 btn-secondary text-xs py-1 px-2 disabled:opacity-50"
                title="Test connection"
              >
                {testMutation.isPending ? (
                  <WifiIcon className="h-3 w-3 animate-pulse mx-auto" />
                ) : (
                  <>
                    <WifiIcon className="h-3 w-3 mr-1" />
                    Test
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-success-600">
              {integrations.filter(i => i.status === 'healthy').length}
            </div>
            <div className="text-xs text-gray-500">Healthy</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-warning-600">
              {integrations.filter(i => i.status === 'warning').length}
            </div>
            <div className="text-xs text-gray-500">Warning</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-error-600">
              {integrations.filter(i => i.status === 'error').length}
            </div>
            <div className="text-xs text-gray-500">Error</div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default IntegrationStatusGrid; 