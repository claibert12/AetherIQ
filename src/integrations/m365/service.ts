import { M365Client } from './client';
import { M365AuthManager } from './auth-manager';
import { M365RateLimiter } from './rate-limiter';
import { 
  M365Config,
  M365Credentials,
  M365OperationResponse,
  M365User,
  CreateUserRequest,
  UpdateUserRequest,
  ListUsersRequest,
  ListUsersResponse,
  M365HealthStatus,
  BatchUserOperation,
  BatchOperationResult
} from './types';

/**
 * Microsoft 365 Integration Service
 * 
 * High-level service interface for Microsoft 365 integration.
 * Provides simplified methods for common operations while maintaining
 * enterprise-grade features like multi-tenancy, rate limiting, and audit logging.
 */
export class M365Service {
  private client: M365Client;
  private authManager: M365AuthManager;
  private rateLimiter: M365RateLimiter;
  private configCache: Map<string, M365Config> = new Map();

  constructor() {
    this.client = new M365Client();
    this.authManager = new M365AuthManager();
    this.rateLimiter = new M365RateLimiter();
  }

  /**
   * Initialize Microsoft 365 integration for a tenant
   */
  async initializeTenant(
    tenantId: string,
    credentials: M365Credentials,
    config: Partial<M365Config> = {}
  ): Promise<string> {
    // Generate authorization URL
    const authUrl = this.authManager.generateAuthUrl(tenantId, credentials);
    
    // Store configuration
    const fullConfig = this.buildConfig(tenantId, credentials, config);
    this.configCache.set(tenantId, fullConfig);

    this.logInfo('Tenant initialization started', { tenantId, authUrl });
    return authUrl;
  }

  /**
   * Complete OAuth2 flow with authorization code
   */
  async completeAuthorization(
    tenantId: string,
    authorizationCode: string,
    credentials: M365Credentials
  ): Promise<void> {
    await this.authManager.exchangeCodeForTokens(tenantId, authorizationCode, credentials);
    this.logInfo('Authorization completed successfully', { tenantId });
  }

  /**
   * List users with pagination support
   */
  async listUsers(tenantId: string, options: ListUsersRequest = {}, runId?: string): Promise<M365OperationResponse<ListUsersResponse>> {
    return this.client.listUsers(tenantId, options, runId);
  }

  /**
   * Get specific user by ID or userPrincipalName
   */
  async getUser(tenantId: string, userKey: string, runId?: string): Promise<M365OperationResponse<M365User>> {
    return this.client.getUser(tenantId, userKey, runId);
  }

  /**
   * Create new user
   */
  async createUser(tenantId: string, userData: CreateUserRequest, runId?: string): Promise<M365OperationResponse<M365User>> {
    return this.client.createUser(tenantId, userData, runId);
  }

  /**
   * Update existing user
   */
  async updateUser(tenantId: string, userKey: string, updateData: UpdateUserRequest, runId?: string): Promise<M365OperationResponse<M365User>> {
    return this.client.updateUser(tenantId, userKey, updateData, runId);
  }

  /**
   * Delete user account
   */
  async deleteUser(tenantId: string, userKey: string, runId?: string): Promise<M365OperationResponse<void>> {
    return this.client.deleteUser(tenantId, userKey, runId);
  }

  /**
   * Disable user account
   */
  async disableUser(tenantId: string, userKey: string, runId?: string): Promise<M365OperationResponse<M365User>> {
    return this.client.disableUser(tenantId, userKey, runId);
  }

  /**
   * Enable user account
   */
  async enableUser(tenantId: string, userKey: string, runId?: string): Promise<M365OperationResponse<M365User>> {
    return this.client.enableUser(tenantId, userKey, runId);
  }

  /**
   * Reset user password
   */
  async resetUserPassword(tenantId: string, userKey: string, newPassword: string, runId?: string): Promise<M365OperationResponse<M365User>> {
    return this.client.updateUser(tenantId, userKey, {
      id: userKey,
      passwordProfile: {
        password: newPassword,
        forceChangePasswordNextSignIn: true
      }
    }, runId);
  }

  /**
   * Batch user operations for efficiency
   */
  async batchUserOperations(
    tenantId: string,
    operations: BatchUserOperation[],
    runId?: string
  ): Promise<BatchOperationResult[]> {
    const results: BatchOperationResult[] = [];

    // Execute operations in parallel with rate limiting
    const promises = operations.map(async (op, index) => {
      try {
        let result: M365OperationResponse<any>;
        
        switch (op.operation) {
          case 'create':
            if (!op.userData) {
              throw new Error('User data required for create operation');
            }
            result = await this.client.createUser(tenantId, op.userData as CreateUserRequest, `${runId}-batch-${index}`);
            break;
          case 'update':
            if (!op.userKey || !op.userData) {
              throw new Error('User key and data required for update operation');
            }
            result = await this.client.updateUser(tenantId, op.userKey, op.userData as UpdateUserRequest, `${runId}-batch-${index}`);
            break;
          case 'delete':
            if (!op.userKey) {
              throw new Error('User key required for delete operation');
            }
            result = await this.client.deleteUser(tenantId, op.userKey, `${runId}-batch-${index}`);
            break;
          case 'enable':
            if (!op.userKey) {
              throw new Error('User key required for enable operation');
            }
            result = await this.client.enableUser(tenantId, op.userKey, `${runId}-batch-${index}`);
            break;
          case 'disable':
            if (!op.userKey) {
              throw new Error('User key required for disable operation');
            }
            result = await this.client.disableUser(tenantId, op.userKey, `${runId}-batch-${index}`);
            break;
          default:
            throw new Error(`Unsupported batch operation: ${op.operation}`);
        }

        return {
          index,
          operation: op.operation,
          success: result.success,
          data: result.data,
          ...(result.error && { error: result.error })
        } as BatchOperationResult;
      } catch (error: any) {
        this.logError('Batch operation failed', error, { tenantId, operation: op.operation, index });
        return {
          index,
          operation: op.operation,
          success: false,
          error: {
            code: 'BATCH_OPERATION_FAILED',
            message: `Batch operation ${index} failed: ${error.message}`,
            details: { index, operation: op.operation },
            retryable: false,
            category: 'internal' as const
          }
        } as BatchOperationResult;
      }
    });

    const results_settled = await Promise.allSettled(promises);
    
    results_settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          index,
          operation: operations[index].operation,
          success: false,
          error: {
            code: 'BATCH_OPERATION_FAILED',
            message: `Batch operation ${index} failed: ${result.reason.message}`,
            details: { index, operation: operations[index].operation },
            retryable: false,
            category: 'internal' as const
          }
        } as BatchOperationResult);
      }
    });

    return results;
  }

  /**
   * Get health status for tenant integration
   */
  async getHealthStatus(tenantId: string): Promise<M365HealthStatus> {
    try {
      const config = await this.getConfig(tenantId);
      
      // Check authentication status
      const isAuthValid = await this.authManager.validateAuth(tenantId);
      
      // Get rate limit status
      const rateLimitStatus = await this.rateLimiter.getRateLimitStatus(tenantId, config);
      
      // Determine overall health
      const isHealthy = isAuthValid && rateLimitStatus.remaining > 0;
      
      const status: M365HealthStatus = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        tenantId,
        consecutiveFailures: 0, // Would be tracked in real implementation
        avgResponseTimeMs: 0, // Would be calculated from metrics
        quotaUsagePercent: ((rateLimitStatus.limit - rateLimitStatus.remaining) / rateLimitStatus.limit) * 100,
        rateLimitStatus: rateLimitStatus.remaining > 0 ? 'ok' : 'throttled',
        errors: [], // Would contain recent errors
        timestamp: new Date().toISOString()
      };
      
      return status;
    } catch (error) {
      // Return unhealthy status on error
      const errorResult: M365HealthStatus = {
        status: 'unhealthy',
        tenantId,
        consecutiveFailures: 1,
        avgResponseTimeMs: 0,
        quotaUsagePercent: 0,
        rateLimitStatus: 'ok',
        errors: [{
          code: 'HEALTH_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: {},
          retryable: false,
          category: 'internal'
        }],
        timestamp: new Date().toISOString()
      };
      
      return errorResult;
    }
  }

  /**
   * Update tenant configuration
   */
  async updateTenantConfig(
    tenantId: string,
    configUpdates: Partial<M365Config>
  ): Promise<void> {
    const currentConfig = await this.getConfig(tenantId);
    const newConfig = { ...currentConfig, ...configUpdates };
    this.configCache.set(tenantId, newConfig);
    
    this.logInfo('Tenant configuration updated', { tenantId, updates: configUpdates });
  }

  /**
   * Revoke tenant access and cleanup
   */
  async revokeTenantAccess(tenantId: string): Promise<void> {
    await this.authManager.revokeAuth(tenantId);
    this.configCache.delete(tenantId);
    
    this.logInfo('Tenant access revoked', { tenantId });
  }

  /**
   * Get rate limit status for tenant
   */
  async getRateLimitStatus(tenantId: string) {
    const config = await this.getConfig(tenantId);
    return this.rateLimiter.getRateLimitStatus(tenantId, config);
  }

  /**
   * Reset rate limits for tenant (admin function)
   */
  async resetRateLimits(tenantId: string): Promise<void> {
    await this.rateLimiter.resetRateLimit(tenantId);
    this.logInfo('Rate limits reset', { tenantId });
  }

  /**
   * Search users with advanced filtering
   */
  async searchUsers(
    tenantId: string,
    searchQuery: string,
    filters?: {
      department?: string;
      jobTitle?: string;
      accountEnabled?: boolean;
      usageLocation?: string;
    },
    runId?: string
  ): Promise<M365OperationResponse<ListUsersResponse>> {
    const listOptions: ListUsersRequest = {
      search: searchQuery
    };

    // Build filter string
    const filterParts: string[] = [];
    if (filters?.department) {
      filterParts.push(`department eq '${filters.department}'`);
    }
    if (filters?.jobTitle) {
      filterParts.push(`jobTitle eq '${filters.jobTitle}'`);
    }
    if (filters?.accountEnabled !== undefined) {
      filterParts.push(`accountEnabled eq ${filters.accountEnabled}`);
    }
    if (filters?.usageLocation) {
      filterParts.push(`usageLocation eq '${filters.usageLocation}'`);
    }

    if (filterParts.length > 0) {
      listOptions.filter = filterParts.join(' and ');
    }

    return this.listUsers(tenantId, listOptions, runId);
  }

  /**
   * Get users by department
   */
  async getUsersByDepartment(
    tenantId: string,
    department: string,
    runId?: string
  ): Promise<M365OperationResponse<ListUsersResponse>> {
    return this.listUsers(tenantId, {
      filter: `department eq '${department}'`
    }, runId);
  }

  /**
   * Get disabled users
   */
  async getDisabledUsers(
    tenantId: string,
    runId?: string
  ): Promise<M365OperationResponse<ListUsersResponse>> {
    return this.listUsers(tenantId, {
      filter: 'accountEnabled eq false'
    }, runId);
  }

  /**
   * Get recently created users
   */
  async getRecentlyCreatedUsers(
    tenantId: string,
    daysBack: number = 30,
    runId?: string
  ): Promise<M365OperationResponse<ListUsersResponse>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const isoDate = cutoffDate.toISOString();

    return this.listUsers(tenantId, {
      filter: `createdDateTime ge ${isoDate}`,
      orderBy: 'createdDateTime desc'
    }, runId);
  }

  /**
   * Bulk enable/disable users
   */
  async bulkToggleUsers(
    tenantId: string,
    userKeys: string[],
    enabled: boolean,
    runId?: string
  ): Promise<BatchOperationResult[]> {
    const operations: BatchUserOperation[] = userKeys.map(userKey => ({
      operation: enabled ? 'enable' : 'disable',
      userKey
    }));

    return this.batchUserOperations(tenantId, operations, runId);
  }

  /**
   * Get or create configuration for tenant
   */
  private async getConfig(tenantId: string): Promise<M365Config> {
    let config = this.configCache.get(tenantId);
    
    if (!config) {
      // Load from database or use defaults
      config = this.buildConfig(tenantId, {
        clientId: '',
        clientSecret: '',
        tenantId,
        redirectUri: '',
        scopes: []
      }, {});
      this.configCache.set(tenantId, config);
    }
    
    return config;
  }

  /**
   * Build complete configuration with defaults
   */
  private buildConfig(
    tenantId: string, 
    credentials: M365Credentials, 
    partial: Partial<M365Config>
  ): M365Config {
    return {
      tenantId,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      redirectUri: credentials.redirectUri,
      scopes: credentials.scopes.length > 0 ? credentials.scopes : ['User.Read.All', 'User.ReadWrite.All', 'Directory.Read.All'],
      rateLimits: {
        requestsPerSecond: 10,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        burstLimit: 20,
        ...partial.rateLimits
      },
      retryConfig: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        ...partial.retryConfig
      },
      timeouts: {
        connectionTimeoutMs: 10000,
        requestTimeoutMs: 30000,
        ...partial.timeouts
      },
      features: {
        enableAuditLogging: true,
        enableMetering: true,
        enableCaching: false,
        cacheTtlSeconds: 300,
        ...partial.features
      },
      failover: {
        enableFailover: false,
        fallbackBehavior: 'reject',
        maxQueueSize: 100,
        ...partial.failover
      }
    };
  }

  private logInfo(message: string, context?: any): void {
    console.log(JSON.stringify({
      level: 'INFO',
      service: 'M365Service',
      message,
      ...context,
      timestamp: new Date().toISOString()
    }));
  }

  private logError(message: string, error: any, context?: any): void {
    console.error(JSON.stringify({
      level: 'ERROR',
      service: 'M365Service',
      message,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack
      },
      ...context,
      timestamp: new Date().toISOString()
    }));
  }
} 