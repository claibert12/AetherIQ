/**
 * AdminDashboard Component Tests
 * 
 * Comprehensive test suite for the AdminDashboard component.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminDashboard from '../AdminDashboard';

// Mock the API hooks
jest.mock('../../../hooks/useApi', () => ({
  useDashboardMetrics: jest.fn(),
  useTaskVolumeData: jest.fn(),
  useCostOptimizationData: jest.fn(),
  useFailedAutomations: jest.fn(),
  useAuditLogs: jest.fn(),
  useIntegrationStatus: jest.fn(),
}));

// Mock the chart components
jest.mock('../../charts/TaskVolumeChart', () => {
  return function MockTaskVolumeChart({ loading, error }: any) {
    if (loading) return <div data-testid="task-volume-loading">Loading chart...</div>;
    if (error) return <div data-testid="task-volume-error">Chart error</div>;
    return <div data-testid="task-volume-chart">Task Volume Chart</div>;
  };
});

jest.mock('../../charts/CostOptimizationChart', () => {
  return function MockCostOptimizationChart({ loading, error }: any) {
    if (loading) return <div data-testid="cost-chart-loading">Loading chart...</div>;
    if (error) return <div data-testid="cost-chart-error">Chart error</div>;
    return <div data-testid="cost-chart">Cost Optimization Chart</div>;
  };
});

jest.mock('../FailedAutomationsTable', () => {
  return function MockFailedAutomationsTable({ loading, error }: any) {
    if (loading) return <div data-testid="failed-table-loading">Loading table...</div>;
    if (error) return <div data-testid="failed-table-error">Table error</div>;
    return <div data-testid="failed-automations-table">Failed Automations Table</div>;
  };
});

jest.mock('../AuditLogsTable', () => {
  return function MockAuditLogsTable({ loading, error }: any) {
    if (loading) return <div data-testid="audit-table-loading">Loading table...</div>;
    if (error) return <div data-testid="audit-table-error">Table error</div>;
    return <div data-testid="audit-logs-table">Audit Logs Table</div>;
  };
});

jest.mock('../IntegrationStatusGrid', () => {
  return function MockIntegrationStatusGrid({ loading, error }: any) {
    if (loading) return <div data-testid="integration-loading">Loading integrations...</div>;
    if (error) return <div data-testid="integration-error">Integration error</div>;
    return <div data-testid="integration-status-grid">Integration Status Grid</div>;
  };
});

const mockHooks = require('../../../hooks/useApi');

// Test data
const mockMetrics = {
  data: {
    data: {
      totalUsers: 1250,
      activeIntegrations: 3,
      completedAutomations: 15420,
      failedAutomations: 23,
      costSavings: 125000,
      lastUpdated: '2024-01-15T10:30:00Z'
    }
  },
  isLoading: false,
  error: null
};

const mockTaskVolumeData = {
  data: {
    data: [
      { date: '2024-01-14', googleWorkspace: 100, microsoft365: 80, salesforce: 60, total: 240 },
      { date: '2024-01-15', googleWorkspace: 120, microsoft365: 90, salesforce: 70, total: 280 }
    ]
  },
  isLoading: false,
  error: null
};

const mockIntegrationStatus = {
  data: {
    data: [
      { name: 'google-workspace', status: 'healthy', lastSync: '2024-01-15T10:00:00Z', userCount: 500, errorCount: 0 },
      { name: 'microsoft-365', status: 'warning', lastSync: '2024-01-15T09:45:00Z', userCount: 450, errorCount: 2 },
      { name: 'salesforce', status: 'healthy', lastSync: '2024-01-15T10:15:00Z', userCount: 300, errorCount: 0 }
    ]
  },
  isLoading: false,
  error: null
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithQueryClient(component: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set default mock implementations
    mockHooks.useDashboardMetrics.mockReturnValue(mockMetrics);
    mockHooks.useTaskVolumeData.mockReturnValue(mockTaskVolumeData);
    mockHooks.useCostOptimizationData.mockReturnValue({ data: { data: [] }, isLoading: false, error: null });
    mockHooks.useFailedAutomations.mockReturnValue({ data: { data: [] }, isLoading: false, error: null });
    mockHooks.useAuditLogs.mockReturnValue({ data: { data: [] }, isLoading: false, error: null });
    mockHooks.useIntegrationStatus.mockReturnValue(mockIntegrationStatus);
  });

  describe('Rendering', () => {
    it('renders the dashboard header', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Enterprise automation overview')).toBeInTheDocument();
    });

    it('renders timeframe selector', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Last 7 days')).toBeInTheDocument();
    });

    it('renders filters toggle button', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('displays last updated timestamp', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading state for metrics', () => {
      mockHooks.useDashboardMetrics.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      });

      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      // Should show loading states for metric cards
      expect(screen.getAllByText('Loading...')).toHaveLength(6); // 6 metric cards
    });

    it('shows loading state for task volume chart', () => {
      mockHooks.useTaskVolumeData.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      });

      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByTestId('task-volume-loading')).toBeInTheDocument();
    });

    it('shows loading state for integration status', () => {
      mockHooks.useIntegrationStatus.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      });

      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByTestId('integration-loading')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles metrics loading error', () => {
      mockHooks.useDashboardMetrics.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load metrics')
      });

      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      // Should show error states for metric cards
      expect(screen.getAllByText('Error')).toHaveLength(6);
    });

    it('handles task volume chart error', () => {
      mockHooks.useTaskVolumeData.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Chart error')
      });

      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByTestId('task-volume-error')).toBeInTheDocument();
    });
  });

  describe('Metrics Display', () => {
    it('displays all metric cards with correct values', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByText('1,250')).toBeInTheDocument(); // Total Users
      expect(screen.getByText('3')).toBeInTheDocument(); // Active Integrations
      expect(screen.getByText('15,420')).toBeInTheDocument(); // Completed Automations
      expect(screen.getByText('23')).toBeInTheDocument(); // Failed Automations
      expect(screen.getByText('$125,000')).toBeInTheDocument(); // Cost Savings
    });

    it('displays metric card titles', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByText('Total Users')).toBeInTheDocument();
      expect(screen.getByText('Active Integrations')).toBeInTheDocument();
      expect(screen.getByText('Completed Automations')).toBeInTheDocument();
      expect(screen.getByText('Failed Automations')).toBeInTheDocument();
      expect(screen.getByText('Cost Savings')).toBeInTheDocument();
      expect(screen.getByText('Success Rate')).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    it('renders task volume chart', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByTestId('task-volume-chart')).toBeInTheDocument();
    });

    it('renders cost optimization chart', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByTestId('cost-chart')).toBeInTheDocument();
    });

    it('renders integration status grid', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByTestId('integration-status-grid')).toBeInTheDocument();
    });

    it('renders failed automations table', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByTestId('failed-automations-table')).toBeInTheDocument();
    });

    it('renders audit logs table', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByTestId('audit-logs-table')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('shows filters panel when toggle is clicked', async () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      const filtersButton = screen.getByText('Filters');
      fireEvent.click(filtersButton);
      
      await waitFor(() => {
        expect(screen.getByText('Filter Dashboard Data')).toBeInTheDocument();
      });
    });

    it('hides filters panel when toggle is clicked again', async () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      const filtersButton = screen.getByText('Filters');
      
      // Open filters
      fireEvent.click(filtersButton);
      await waitFor(() => {
        expect(screen.getByText('Filter Dashboard Data')).toBeInTheDocument();
      });
      
      // Close filters
      fireEvent.click(filtersButton);
      await waitFor(() => {
        expect(screen.queryByText('Filter Dashboard Data')).not.toBeInTheDocument();
      });
    });

    it('applies filters and resets them', async () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      const filtersButton = screen.getByText('Filters');
      fireEvent.click(filtersButton);
      
      await waitFor(() => {
        const resetButton = screen.getByText('Reset Filters');
        expect(resetButton).toBeInTheDocument();
        
        fireEvent.click(resetButton);
      });
    });
  });

  describe('Timeframe Selection', () => {
    it('changes timeframe when dropdown selection changes', async () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'month' } });
      
      await waitFor(() => {
        expect(mockHooks.useTaskVolumeData).toHaveBeenCalledWith(
          'test-tenant',
          'month'
        );
      });
    });
  });

  describe('API Integration', () => {
    it('calls dashboard metrics API with correct parameters', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(mockHooks.useDashboardMetrics).toHaveBeenCalledWith(
        'test-tenant',
        expect.any(Object)
      );
    });

    it('calls task volume API with correct parameters', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(mockHooks.useTaskVolumeData).toHaveBeenCalledWith(
        'test-tenant',
        'week'
      );
    });

    it('calls integration status API with correct parameters', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(mockHooks.useIntegrationStatus).toHaveBeenCalledWith(
        'test-tenant'
      );
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Admin Dashboard');
    });

    it('has accessible form controls', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
    });

    it('has accessible buttons', () => {
      renderWithQueryClient(<AdminDashboard tenantId="test-tenant" />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      buttons.forEach(button => {
        expect(button).toBeInTheDocument();
      });
    });
  });
}); 