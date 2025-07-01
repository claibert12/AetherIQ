/**
 * Dashboard Filters Component
 * 
 * Comprehensive filtering interface for dashboard data.
 */

import React from 'react';
import { DashboardFilters as FilterType } from '../../hooks/useApi';
import Card from '../common/Card';

export interface DashboardFiltersProps {
  filters: FilterType;
  onChange: (filters: FilterType) => void;
  onReset: () => void;
  className?: string;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  filters,
  onChange,
  onReset,
  className,
}) => {
  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    onChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: value,
      },
    });
  };

  const handleMultiSelectChange = (field: keyof FilterType, value: string, checked: boolean) => {
    const currentValues = filters[field] as string[];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);
    
    onChange({
      ...filters,
      [field]: newValues,
    });
  };

  return (
    <Card className={className} title="Filter Dashboard Data" padding="md">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Range
          </label>
          <div className="space-y-2">
            <input
              type="date"
              value={filters.dateRange.start}
              onChange={(e) => handleDateRangeChange('start', e.target.value)}
              className="input-field"
              placeholder="Start date"
            />
            <input
              type="date"
              value={filters.dateRange.end}
              onChange={(e) => handleDateRangeChange('end', e.target.value)}
              className="input-field"
              placeholder="End date"
            />
          </div>
        </div>

        {/* Integrations */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Integrations
          </label>
          <div className="space-y-2">
            {['google-workspace', 'microsoft-365', 'salesforce'].map((integration) => (
              <label key={integration} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.integrations.includes(integration)}
                  onChange={(e) => handleMultiSelectChange('integrations', integration, e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-600 capitalize">
                  {integration.replace('-', ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Categories
          </label>
          <div className="space-y-2">
            {['user-management', 'license-management', 'automation', 'audit'].map((category) => (
              <label key={category} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.categories.includes(category)}
                  onChange={(e) => handleMultiSelectChange('categories', category, e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-600 capitalize">
                  {category.replace('-', ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <div className="space-y-2">
            {['success', 'failure', 'pending', 'retry'].map((status) => (
              <label key={status} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.status.includes(status)}
                  onChange={(e) => handleMultiSelectChange('status', status, e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-600 capitalize">
                  {status}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
        <button
          onClick={onReset}
          className="btn-secondary"
        >
          Reset Filters
        </button>
      </div>
    </Card>
  );
};

export default DashboardFilters; 