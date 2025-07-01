import { SystemConfig } from '../types';

/**
 * EnvLoader - Loads and validates environment configuration
 * 
 * Handles:
 * - Environment variable loading
 * - Configuration validation
 * - Default value management
 * - Type conversion and parsing
 */
export class EnvLoader {
  private static instance: EnvLoader;
  private config: SystemConfig | null = null;

  private constructor() {}

  public static getInstance(): EnvLoader {
    if (!EnvLoader.instance) {
      EnvLoader.instance = new EnvLoader();
    }
    return EnvLoader.instance;
  }

  /**
   * Load and validate system configuration
   */
  public loadConfig(): SystemConfig {
    if (this.config) {
      return this.config;
    }

    this.config = {
      region: this.getString('AWS_REGION', 'us-east-1'),
      environment: this.getEnvironment('NODE_ENV', 'development'),
      logLevel: this.getLogLevel('LOG_LEVEL', 'info'),
      maxConcurrentWorkflows: this.getNumber('MAX_CONCURRENT_WORKFLOWS', 10),
      defaultTimeout: this.getNumber('DEFAULT_TIMEOUT', 30000),
    };

    this.validateConfig(this.config);
    return this.config;
  }

  /**
   * Get database configuration
   */
  public getDatabaseConfig(): DatabaseConfig {
    return {
      usersTable: this.getString('DYNAMODB_USERS_TABLE', 'aetheriq-users'),
      licensesTable: this.getString('DYNAMODB_LICENSES_TABLE', 'aetheriq-licenses'),
      workflowsTable: this.getString('DYNAMODB_WORKFLOWS_TABLE', 'aetheriq-workflows'),
      executionsTable: this.getString('DYNAMODB_EXECUTIONS_TABLE', 'aetheriq-executions'),
      region: this.getString('AWS_REGION', 'us-east-1'),
    };
  }

  /**
   * Get integration configurations
   */
  public getIntegrationConfig(integrationType: string): IntegrationEnvironmentConfig {
    const prefix = integrationType.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    
    return {
      clientId: this.getString(`${prefix}_CLIENT_ID`),
      clientSecret: this.getString(`${prefix}_CLIENT_SECRET`),
      redirectUri: this.getString(`${prefix}_REDIRECT_URI`),
      scopes: this.getStringArray(`${prefix}_SCOPES`),
      baseUrl: this.getString(`${prefix}_BASE_URL`),
      apiVersion: this.getString(`${prefix}_API_VERSION`),
      enabled: this.getBoolean(`${prefix}_ENABLED`, true),
    };
  }

  /**
   * Get billing configuration
   */
  public getBillingConfig(): BillingConfig {
    return {
      enabled: this.getBoolean('BILLING_ENABLED', true),
      currency: this.getString('BILLING_CURRENCY', 'USD'),
      billingCycle: this.getString('BILLING_CYCLE', 'monthly') as 'monthly' | 'yearly',
      freeTierLimits: {
        workflowExecutions: this.getNumber('FREE_TIER_WORKFLOW_EXECUTIONS', 100),
        users: this.getNumber('FREE_TIER_USERS', 5),
        storageGB: this.getNumber('FREE_TIER_STORAGE_GB', 1),
      },
    };
  }

  /**
   * Get security configuration
   */
  public getSecurityConfig(): SecurityConfig {
    return {
      jwtSecret: this.getString('JWT_SECRET'),
      jwtExpiresIn: this.getString('JWT_EXPIRES_IN', '24h'),
      bcryptRounds: this.getNumber('BCRYPT_ROUNDS', 12),
      maxLoginAttempts: this.getNumber('MAX_LOGIN_ATTEMPTS', 5),
      lockoutDurationMs: this.getNumber('LOCKOUT_DURATION_MS', 300000), // 5 minutes
      sessionDurationMs: this.getNumber('SESSION_DURATION_MS', 86400000), // 24 hours
    };
  }

  /**
   * Utility methods for environment variable access
   */
  private getString(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (value === undefined || value === '') {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  private getNumber(key: string, defaultValue?: number): number {
    const value = process.env[key];
    if (value === undefined || value === '') {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Required environment variable ${key} is not set`);
    }
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} must be a valid number, got: ${value}`);
    }
    return parsed;
  }

  private getBoolean(key: string, defaultValue?: boolean): boolean {
    const value = process.env[key];
    if (value === undefined || value === '') {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Required environment variable ${key} is not set`);
    }
    
    const lowercased = value.toLowerCase();
    if (lowercased === 'true' || lowercased === '1' || lowercased === 'yes') {
      return true;
    }
    if (lowercased === 'false' || lowercased === '0' || lowercased === 'no') {
      return false;
    }
    
    throw new Error(`Environment variable ${key} must be a boolean value, got: ${value}`);
  }

  private getStringArray(key: string, defaultValue?: string[]): string[] {
    const value = process.env[key];
    if (value === undefined || value === '') {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      return [];
    }
    
    return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
  }

  private getEnvironment(key: string, defaultValue: 'development' | 'staging' | 'production'): 'development' | 'staging' | 'production' {
    const value = this.getString(key, defaultValue);
    
    if (value === 'development' || value === 'staging' || value === 'production') {
      return value;
    }
    
    throw new Error(`Environment variable ${key} must be one of: development, staging, production. Got: ${value}`);
  }

  private getLogLevel(key: string, defaultValue: 'debug' | 'info' | 'warn' | 'error'): 'debug' | 'info' | 'warn' | 'error' {
    const value = this.getString(key, defaultValue);
    
    if (value === 'debug' || value === 'info' || value === 'warn' || value === 'error') {
      return value;
    }
    
    throw new Error(`Environment variable ${key} must be one of: debug, info, warn, error. Got: ${value}`);
  }

  private validateConfig(config: SystemConfig): void {
    if (config.maxConcurrentWorkflows <= 0) {
      throw new Error('maxConcurrentWorkflows must be greater than 0');
    }
    
    if (config.defaultTimeout <= 0) {
      throw new Error('defaultTimeout must be greater than 0');
    }
    
    if (!config.region) {
      throw new Error('AWS region must be specified');
    }
  }

  /**
   * Check if running in Lambda environment
   */
  public isLambdaEnvironment(): boolean {
    return !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_RUNTIME_DIR);
  }

  /**
   * Check if running in local development
   */
  public isLocalDevelopment(): boolean {
    return this.config?.environment === 'development' && !this.isLambdaEnvironment();
  }

  /**
   * Get AWS Lambda context information
   */
  public getLambdaContext(): LambdaContext | null {
    if (!this.isLambdaEnvironment()) {
      return null;
    }

    return {
      functionName: process.env.AWS_LAMBDA_FUNCTION_NAME || '',
      functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION || '',
      memoryLimitInMB: parseInt(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || '128', 10),
      logGroupName: process.env.AWS_LAMBDA_LOG_GROUP_NAME || '',
      logStreamName: process.env.AWS_LAMBDA_LOG_STREAM_NAME || '',
    };
  }
}

// Configuration interfaces
export interface DatabaseConfig {
  usersTable: string;
  licensesTable: string;
  workflowsTable: string;
  executionsTable: string;
  region: string;
}

export interface IntegrationEnvironmentConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  baseUrl?: string;
  apiVersion?: string;
  enabled: boolean;
}

export interface BillingConfig {
  enabled: boolean;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  freeTierLimits: {
    workflowExecutions: number;
    users: number;
    storageGB: number;
  };
}

export interface SecurityConfig {
  jwtSecret?: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
  maxLoginAttempts: number;
  lockoutDurationMs: number;
  sessionDurationMs: number;
}

export interface LambdaContext {
  functionName: string;
  functionVersion: string;
  memoryLimitInMB: number;
  logGroupName: string;
  logStreamName: string;
} 