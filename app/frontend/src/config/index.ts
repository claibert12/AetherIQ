export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

export const DASHBOARD_CONFIG = {
  timeRanges: {
    '1h': 'Last Hour',
    '6h': 'Last 6 Hours',
    '12h': 'Last 12 Hours',
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
  },
  refreshInterval: 30000, // 30 seconds
};

export const CHART_CONFIG = {
  colors: {
    primary: '#1976d2',
    secondary: '#9c27b0',
    success: '#2e7d32',
    warning: '#ed6c02',
    error: '#d32f2f',
    info: '#0288d1',
  },
  lineChart: {
    pointRadius: 2,
    pointHoverRadius: 4,
    tension: 0.4,
  },
};

export const PERFORMANCE_THRESHOLDS = {
  executionTime: {
    warning: 5000, // 5 seconds
    critical: 10000, // 10 seconds
  },
  cpuUsage: {
    warning: 70, // 70%
    critical: 90, // 90%
  },
  memoryUsage: {
    warning: 70, // 70%
    critical: 90, // 90%
  },
  ioOperations: {
    warning: 1000, // operations per second
    critical: 2000, // operations per second
  },
};

export const ALERT_CONFIG = {
  maxAlerts: 100,
  levels: {
    info: {
      color: '#0288d1',
      icon: 'info',
    },
    warning: {
      color: '#ed6c02',
      icon: 'warning',
    },
    error: {
      color: '#d32f2f',
      icon: 'error',
    },
  },
}; 