/**
 * Cost Optimization Chart Component
 * 
 * Displays cost savings by category using a horizontal bar chart.
 */

import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell 
} from 'recharts';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { InlineLoader } from '../common/LoadingSpinner';
import { CostOptimizationData } from '../../hooks/useApi';
import { ChartBarIcon } from '@heroicons/react/24/outline';

export interface CostOptimizationChartProps {
  data: CostOptimizationData[];
  loading?: boolean;
  error?: Error | null;
  className?: string;
  height?: number;
}

export const CostOptimizationChart: React.FC<CostOptimizationChartProps> = ({
  data = [],
  loading = false,
  error = null,
  className,
  height = 300,
}) => {
  // Color palette for different categories
  const colors = [
    '#10b981', // success-500
    '#3b82f6', // primary-500
    '#f59e0b', // warning-500
    '#ef4444', // error-500
    '#6b7280', // gray-500
    '#8b5cf6', // purple-500
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {label}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between space-x-4">
              <span className="text-sm text-gray-600">Savings</span>
              <span className="text-sm font-medium text-gray-900">
                ${data.savings.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between space-x-4">
              <span className="text-sm text-gray-600">Percentage</span>
              <span className="text-sm font-medium text-gray-900">
                {data.percentage}%
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
      <div className="flex items-center justify-center h-64" data-testid="cost-chart-loading">
        <InlineLoader />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-error-600" data-testid="cost-chart-error">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4" />
          <p>Failed to load cost optimization data</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500" data-testid="cost-chart-empty">
        <div className="text-center">
          <ChartBarIcon className="h-12 w-12 mx-auto mb-4" />
          <p>No cost optimization data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-64" data-testid="cost-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="horizontal"
          margin={{
            top: 10,
            right: 30,
            left: 20,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis 
            type="number"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            stroke="#d1d5db"
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <YAxis 
            type="category"
            dataKey="category"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            stroke="#d1d5db"
            width={120}
          />
          <Tooltip content={<CustomTooltip />} />
          
          <Bar dataKey="savings" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Total Savings</span>
          <span className="font-semibold text-gray-900">
            ${data.reduce((sum, item) => sum + item.savings, 0).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CostOptimizationChart; 