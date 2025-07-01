/**
 * Admin Dashboard Component
 * 
 * Enterprise-grade admin dashboard with org-wide overview, metrics, charts,
 * and comprehensive filtering capabilities.
 */

import React, { useState } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  UserGroupIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

import Card from '../common/Card';
import { InlineLoader } from '../common/LoadingSpinner';
import MetricsCard from './MetricsCard';
import TaskVolumeChart from '../charts/TaskVolumeChart';
import CostOptimizationChart from '../charts/CostOptimizationChart';
import FailedAutomationsTable from './FailedAutomationsTable';
import AuditLogsTable from './AuditLogsTable';
import IntegrationStatusGrid from './IntegrationStatusGrid';
import DashboardFilters from './DashboardFilters';

import {
  useDashboardMetrics,
  useTaskVolumeData,
  useCostOptimizationData,
  useFailedAutomations,
  useAuditLogs,
  useIntegrationStatus,
  DashboardFilters as FilterType,
} from '../../hooks/useApi';

export interface AdminDashboardProps {
  tenantId: string;
  className?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  tenantId,
  className,
}) => {
  // State for filters and view options
  const [filters, setFilters] = useState<FilterType>({
    dateRange: {
      start: format(startOfDay(subDays(new Date(), 7)), 'yyyy-MM-dd'),
      end: format(endOfDay(new Date()), 'yyyy-MM-dd'),
    },
    tenants: [],
    integrations: [],
    categories: [],
    status: [],
  });

  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month' | 'quarter'>('week');
  const [showFilters, setShowFilters] = useState(false);

  // Data fetching hooks
  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError
  } = useDashboardMetrics(tenantId, filters);

  const {
    data: taskVolumeData,
    isLoading: taskVolumeLoading,
    error: taskVolumeError
  } = useTaskVolumeData(tenantId, timeframe);

  const {
    data: integrationStatus,
    isLoading: integrationLoading,
    error: integrationError
  } = useIntegrationStatus(tenantId);

  const {
    data: failedAutomations,
    isLoading: failedLoading,
    error: failedError
  } = useFailedAutomations(tenantId);

  const {
    data: auditLogs,
    isLoading: auditLoading,
    error: auditError
  } = useAuditLogs(tenantId);

  const {
    data: costData,
    isLoading: costLoading,
    error: costError
  } = useCostOptimizationData(tenantId);

  // Computed values
  const taskVolume = taskVolumeData?.data?.data || [];
  const costOptimization = costData?.data?.data || [];
  const metricsData = metrics?.data?.data;
  
  const successRate = metricsData ? 
    (metricsData.completedAutomations / (metricsData.completedAutomations + metricsData.failedAutomations) * 100).toFixed(1) + '%' 
    : '0%';

  const isLoading = metricsLoading && taskVolumeLoading && costLoading;
  // Only show global error if ALL critical data sources fail
  const hasGlobalError = metricsError && taskVolumeError && costError;

  // Metric cards configuration
  const metricCards = [
    {
      title: 'Total Users',
      value: metricsData?.totalUsers?.toLocaleString() || '0',
      change: '+5.2%',
      trend: 'up' as const,
      icon: UserGroupIcon,
      loading: metricsLoading,
      error: metricsError
    },
    {
      title: 'Active Integrations',
      value: metricsData?.activeIntegrations?.toString() || '0',
      change: '+12.5%',
      trend: 'up' as const,
      icon: CogIcon,
      loading: metricsLoading,
      error: metricsError
    },
    {
      title: 'Completed Automations',
      value: metricsData?.completedAutomations?.toLocaleString() || '0',
      change: '+8.1%',
      trend: 'up' as const,
      icon: ArrowPathIcon,
      loading: metricsLoading,
      error: metricsError
    },
    {
      title: 'Failed Automations',
      value: metricsData?.failedAutomations?.toString() || '0',
      change: '-2.3%',
      trend: 'down' as const,
      icon: ExclamationTriangleIcon,
      loading: metricsLoading,
      error: metricsError
    },
    {
      title: 'Cost Savings',
      value: metricsData?.costSavings ? `$${metricsData.costSavings.toLocaleString()}` : '$0',
      change: '+15.7%',
      trend: 'up' as const,
      icon: CurrencyDollarIcon,
      loading: metricsLoading,
      error: metricsError
    },
    {
      title: 'Success Rate',
      value: successRate,
      change: '+1.2%',
      trend: 'up' as const,
      icon: CheckCircleIcon,
      loading: metricsLoading,
      error: metricsError
    }
  ];

  if (hasGlobalError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-error-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Dashboard Error
            </h3>
            <p className="text-gray-600 mb-4">
              Unable to load dashboard data. Please try again.
            </p>
            <button 
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Enterprise automation overview
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Timeframe selector */}
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as any)}
                className="input-field w-auto"
              >
                <option value="day">Last 24 Hours</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last Month</option>
                <option value="quarter">Last Quarter</option>
              </select>

              {/* Filters toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`btn-secondary flex items-center space-x-2 ${
                  showFilters ? 'bg-primary-50 text-primary-700' : ''
                }`}
              >
                <ArrowPathIcon className="h-4 w-4" />
                <span>Filters</span>
              </button>

              {/* Last updated */}
              <div className="text-sm text-gray-500">
                Last updated: {metricsData?.lastUpdated ? 
                  new Date(metricsData.lastUpdated).toLocaleString() : 
                  'Loading...'
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-8">
            <DashboardFilters
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters({
                dateRange: {
                  start: format(startOfDay(subDays(new Date(), 7)), 'yyyy-MM-dd'),
                  end: format(endOfDay(new Date()), 'yyyy-MM-dd'),
                },
                tenants: [],
                integrations: [],
                categories: [],
                status: [],
              })}
            />
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <InlineLoader text="Loading dashboard data..." />
          </div>
        )}

        {!isLoading && (
          <>
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
              {metricCards.map((metric, index) => (
                <MetricsCard
                  key={index}
                  title={metric.title}
                  value={metric.error ? 'Error' : metric.value}
                  icon={metric.icon}
                  color={metric.error ? 'error' : 'primary'}
                  change={metric.change}
                  trend={metric.trend}
                  loading={metric.loading}
                />
              ))}
            </div>

            {/* Integration Status */}
            <div className="mb-8">
              <IntegrationStatusGrid
                integrations={integrationStatus?.data || []}
                loading={integrationLoading}
                error={integrationError}
                tenantId={tenantId}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Task Volume Chart */}
              <Card
                title="Task Volume"
                subtitle="Automation activity across integrations"
              >
                <TaskVolumeChart
                  data={taskVolume}
                  loading={taskVolumeLoading}
                  error={taskVolumeError}
                />
              </Card>

              {/* Cost Optimization Chart */}
              <Card
                title="Cost Optimization"
                subtitle="Savings by category"
              >
                <CostOptimizationChart
                  data={costOptimization}
                  loading={costLoading}
                  error={costError}
                />
              </Card>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Failed Automations */}
              <Card
                title="Recent Failures"
                subtitle="Recent failures requiring attention"
              >
                <FailedAutomationsTable
                  data={failedAutomations?.data || []}
                  loading={failedLoading}
                  error={failedError}
                  tenantId={tenantId}
                />
              </Card>

              {/* Audit Logs */}
              <Card
                title="Audit Logs"
                subtitle="Recent user and system activities"
              >
                <AuditLogsTable
                  data={auditLogs?.data || []}
                  loading={auditLoading}
                  error={auditError}
                  tenantId={tenantId}
                  filters={filters}
                />
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard; 