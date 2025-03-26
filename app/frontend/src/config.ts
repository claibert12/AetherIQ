// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api/v1';

// WebSocket Configuration
export const WS_BASE_URL = process.env.REACT_APP_WS_BASE_URL || 'ws://localhost:8000/ws';

// Authentication Configuration
export const AUTH_CONFIG = {
  tokenKey: 'auth_token',
  refreshTokenKey: 'refresh_token',
  tokenExpiryKey: 'token_expiry',
};

// Dashboard Configuration
export const DASHBOARD_CONFIG = {
  refreshInterval: 10000, // 10 seconds
  maxDataPoints: 100,
  timeRanges: {
    '1h': 'Last Hour',
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
  },
};

// Chart Configuration
export const CHART_CONFIG = {
  colors: {
    primary: '#1976d2',
    secondary: '#dc004e',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    info: '#2196f3',
  },
  lineChart: {
    tension: 0.4,
    pointRadius: 4,
    pointHoverRadius: 6,
  },
  barChart: {
    barThickness: 20,
    borderRadius: 4,
  },
};

// Alert Configuration
export const ALERT_CONFIG = {
  severityColors: {
    critical: '#f44336',
    high: '#ff9800',
    medium: '#ffc107',
    low: '#4caf50',
  },
  refreshInterval: 5000, // 5 seconds
  maxAlerts: 50,
};

// Performance Thresholds
export const PERFORMANCE_THRESHOLDS = {
  cpu: {
    warning: 70,
    critical: 90,
  },
  memory: {
    warning: 80,
    critical: 95,
  },
  executionTime: {
    warning: 1000, // 1 second
    critical: 5000, // 5 seconds
  },
};

// Error Messages
export const ERROR_MESSAGES = {
  network: 'Network connection error. Please check your internet connection.',
  unauthorized: 'Unauthorized access. Please log in again.',
  server: 'Server error. Please try again later.',
  validation: 'Invalid input. Please check your data and try again.',
};

// Loading States
export const LOADING_STATES = {
  initial: 'initial',
  loading: 'loading',
  success: 'success',
  error: 'error',
}; 