import { format, parseISO } from 'date-fns';

// Date formatting utilities
export const formatDate = (date: string | Date, formatString: string = 'yyyy-MM-dd HH:mm:ss'): string => {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return format(parsedDate, formatString);
};

export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

// Number formatting utilities
export const formatNumber = (number: number, decimals: number = 2): string => {
  return number.toFixed(decimals);
};

export const formatPercentage = (number: number, decimals: number = 1): string => {
  return `${formatNumber(number, decimals)}%`;
};

// Color utilities
export const getSeverityColor = (severity: 'critical' | 'high' | 'medium' | 'low'): string => {
  const colors = {
    critical: '#f44336',
    high: '#ff9800',
    medium: '#ffc107',
    low: '#4caf50',
  };
  return colors[severity] || '#757575';
};

// Type guards
export const isError = (error: unknown): error is Error => {
  return error instanceof Error;
};

export const isApiError = (error: unknown): error is { message: string; code: string } => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'code' in error
  );
};

// Debounce utility
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle utility
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  let lastResult: ReturnType<T>;

  return function executedFunction(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Local storage utilities
export const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  },
  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  },
};

// Error handling utility
export const handleError = (error: unknown): string => {
  if (isError(error)) {
    return error.message;
  }
  if (isApiError(error)) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

// Validation utilities
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 8;
};

// URL utilities
export const getQueryParams = (): Record<string, string> => {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(params.entries());
};

export const setQueryParams = (params: Record<string, string>): void => {
  const searchParams = new URLSearchParams(params);
  window.history.replaceState(
    {},
    '',
    `${window.location.pathname}?${searchParams.toString()}`
  );
}; 