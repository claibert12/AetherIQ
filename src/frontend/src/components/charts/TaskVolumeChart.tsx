/**
 * Task Volume Chart Component
 * 
 * Displays automation task volume across integrations using a stacked area chart.
 */

import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { InlineLoader } from '../common/LoadingSpinner';
import { TaskVolumeData } from '../../hooks/useApi';
import { ChartBarIcon } from '@heroicons/react/24/outline';

export interface TaskVolumeChartProps {
  data: TaskVolumeData[];
  loading?: boolean;
  error?: Error | null;
  timeframe?: 'day' | 'week' | 'month' | 'quarter';
  className?: string;
  height?: number;
}

export const TaskVolumeChart: React.FC<TaskVolumeChartProps> = ({
  data = [],
  loading = false,
  error = null,
  timeframe = 'week',
  className,
  height = 300,
}) => {
  // Integration colors
  const integrationColors = {
    googleWorkspace: '#4285f4',
    microsoft365: '#0078d4',
    salesforce: '#00a1e0',
  };

  // Format date based on timeframe
  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return dateString;

      switch (timeframe) {
        case 'day':
          return format(date, 'HH:mm');
        case 'week':
          return format(date, 'MMM dd');
        case 'month':
          return format(date, 'MMM dd');
        case 'quarter':
          return format(date, 'MMM yyyy');
        default:
          return format(date, 'MMM dd');
      }
    } catch {
      return dateString;
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {formatDate(label)}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-gray-600">
                  {entry.name === 'googleWorkspace' ? 'Google Workspace' :
                   entry.name === 'microsoft365' ? 'Microsoft 365' :
                   entry.name === 'salesforce' ? 'Salesforce' : entry.name}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {entry.value.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="border-t border-gray-100 mt-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Total</span>
              <span className="text-sm font-bold text-gray-900">
                {payload.reduce((sum: number, entry: any) => sum + entry.value, 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="task-volume-loading">
        <InlineLoader />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-error-600" data-testid="task-volume-error">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4" />
          <p>Failed to load task volume data</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500" data-testid="task-volume-empty">
        <div className="text-center">
          <ChartBarIcon className="h-12 w-12 mx-auto mb-4" />
          <p>No task volume data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-64" data-testid="task-volume-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis 
            dataKey="date"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={formatDate}
            stroke="#d1d5db"
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            stroke="#d1d5db"
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px', color: '#6b7280' }}
            formatter={(value) => {
              switch (value) {
                case 'googleWorkspace':
                  return 'Google Workspace';
                case 'microsoft365':
                  return 'Microsoft 365';
                case 'salesforce':
                  return 'Salesforce';
                default:
                  return value;
              }
            }}
          />
          
          <Area
            type="monotone"
            dataKey="googleWorkspace"
            stackId="1"
            stroke={integrationColors.googleWorkspace}
            fill={integrationColors.googleWorkspace}
            fillOpacity={0.6}
          />
          <Area
            type="monotone"
            dataKey="microsoft365"
            stackId="1"
            stroke={integrationColors.microsoft365}
            fill={integrationColors.microsoft365}
            fillOpacity={0.6}
          />
          <Area
            type="monotone"
            dataKey="salesforce"
            stackId="1"
            stroke={integrationColors.salesforce}
            fill={integrationColors.salesforce}
            fillOpacity={0.6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TaskVolumeChart; 