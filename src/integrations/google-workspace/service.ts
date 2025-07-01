import { GoogleWorkspaceClient } from './client';
import { GoogleWorkspaceAuthManager } from './auth-manager';
import { GoogleWorkspaceRateLimiter } from './rate-limiter';
import { 
  GoogleWorkspaceConfig,
  GoogleWorkspaceCredentials,
  GoogleWorkspaceOperationResponse,
  GoogleWorkspaceUser,
  CreateUserRequest,
  UpdateUserRequest,
  ListUsersRequest,
  ListUsersResponse,
  GoogleWorkspaceHealthStatus
} from './types';

/**
 * Google Workspace Integration Service
 * 
 * High-level service interface for Google Workspace integration.
 * Provides simplified methods for common operations while maintaining
 * enterprise-grade features like multi-tenancy, rate limiting, and audit logging.
 */
export class GoogleWorkspaceService {
  private client: GoogleWorkspaceClient;
  private authManager: GoogleWorkspaceAuthManager;
  private rateLimiter: GoogleWorkspaceRateLimiter;
  private configCache: Map<string, GoogleWorkspaceConfig> = new Map();

  constructor() {
    this.client = new GoogleWorkspaceClient();
    this.authManager = new GoogleWorkspaceAuthManager();
    this.rateLimiter = new GoogleWorkspaceRateLimiter();
  }

  /**
   * Initialize Google Workspace integration for a tenant
   */
  async initializeTenant(
    tenantId: string,
    credentials: GoogleWorkspaceCredentials,
    config: Partial<GoogleWorkspaceConfig> = {}
  ): Promise<string> {
    // Generate authorization URL
    const authUrl = this.authManager.generateAuthUrl(tenantId, credentials);
    
    // Store configuration
    const fullConfig = this.buildConfig(tenantId, config);
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
    credentials: GoogleWorkspaceCredentials
  ): Promise<void> {
    await this.authManager.exchangeCodeForTokens(tenantId, authorizationCode, credentials);
    this.logInfo('Authorization completed successfully', { tenantId });
  }

  /**
   * List users with pagination support
   */
  async listUsers(tenantId: string, options: ListUsersRequest = {}, runId?: string): Promise<GoogleWorkspaceOperationResponse<ListUsersResponse>> {
    return this.client.listUsers(tenantId, options, runId);
  }

  /**
   * Get specific user by ID or email
   */
  async getUser(tenantId: string, userKey: string, runId?: string): Promise<GoogleWorkspaceOperationResponse<GoogleWorkspaceUser>> {
    return this.client.getUser(tenantId, userKey, runId);
  }

  /**
   * Create new user
   */
  async createUser(tenantId: string, userData: CreateUserRequest, runId?: string): Promise<GoogleWorkspaceOperationResponse<GoogleWorkspaceUser>> {
    return this.client.createUser(tenantId, userData, runId);
  }

  /**
   * Update existing user
   */
  async updateUser(tenantId: string, userKey: string, updateData: UpdateUserRequest, runId?: string): Promise<GoogleWorkspaceOperationResponse<GoogleWorkspaceUser>> {
    return this.client.updateUser(tenantId, userKey, updateData, runId);
  }

  /**
   * Suspend user account
   */
  async suspendUser(tenantId: string, userKey: string, runId?: string): Promise<GoogleWorkspaceOperationResponse<GoogleWorkspaceUser>> {
    return this.client.suspendUser(tenantId, userKey, runId);
  }

  /**
   * Unsuspend user account
   */
  async unsuspendUser(tenantId: string, userKey: string, runId?: string): Promise<GoogleWorkspaceOperationResponse<GoogleWorkspaceUser>> {
    return this.client.updateUser(tenantId, userKey, { userId: userKey, suspended: false }, runId);
  }

  /**
   * Delete user account
   */
  async deleteUser(tenantId: string, userId: string, runId?: string): Promise<GoogleWorkspaceOperationResponse<void>> {
    const config = await this.getConfig(tenantId);
    
    const operationRequest: any = {
      operation: 'delete_user',
      tenantId,
      parameters: { userId }
    };
    
    if (runId) {
      operationRequest.runId = runId;
    }
    
    return this.client.executeOperation(operationRequest, config);
  }

  /**
   * Reset user password
   */
  async resetUserPassword(tenantId: string, userKey: string, newPassword: string, runId?: string): Promise<GoogleWorkspaceOperationResponse<GoogleWorkspaceUser>> {
    return this.client.updateUser(tenantId, userKey, {
      userId: userKey,
      password: newPassword,
      changePasswordAtNextLogin: true
    }, runId);
  }

  /**
   * Batch user operations for efficiency
   */
  async batchUserOperations(
    tenantId: string,
    operations: Array<{
      operation: 'create' | 'update' | 'suspend' | 'unsuspend' | 'delete';
      userKey?: string;
      userData?: CreateUserRequest | UpdateUserRequest;
    }>,
    runId?: string
  ): Promise<Array<GoogleWorkspaceOperationResponse<any>>> {
    const config = await this.getConfig(tenantId);
    const results: Array<GoogleWorkspaceOperationResponse<any>> = [];

    // Execute operations in parallel with rate limiting
    const promises = operations.map(async (op, index) => {
      try {
        switch (op.operation) {
          case 'create':
            return await this.client.createUser(tenantId, op.userData as CreateUserRequest, `${runId}-batch-${index}`);
          case 'update':
            return await this.client.updateUser(tenantId, op.userKey!, op.userData as UpdateUserRequest, `${runId}-batch-${index}`);
          case 'suspend':
            return await this.client.suspendUser(tenantId, op.userKey!, `${runId}-batch-${index}`);
          case 'unsuspend':
            return await this.client.updateUser(tenantId, op.userKey!, { userId: op.userKey!, suspended: false }, `${runId}-batch-${index}`);
          case 'delete':
            return await this.client.executeOperation({
              operation: 'delete_user',
              tenantId,
              runId: `${runId}-batch-${index}`,
              parameters: { userKey: op.userKey! }
            }, config);
          default:
            throw new Error(`Unsupported batch operation: ${op.operation}`);
        }
      } catch (error) {
        this.logError('Batch operation failed', error, { tenantId, operation: op.operation, index });
        throw error;
      }
    });

    const results_settled = await Promise.allSettled(promises);
    
    results_settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          error: {
            code: 'BATCH_OPERATION_FAILED',
            message: `Batch operation ${index} failed: ${result.reason.message}`,
            details: { index, operation: operations[index].operation },
            retryable: false,
            category: 'internal' as const
          },
          metadata: {
            operation: operations[index].operation as any,
            tenantId,
            runId: `${runId}-batch-${index}`,
            executionTimeMs: 0,
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    return results;
  }

  /**
   * Get health status for tenant integration
   */
  async getHealthStatus(tenantId: string): Promise<GoogleWorkspaceHealthStatus> {
    try {
      const config = await this.getConfig(tenantId);
      
      // Check authentication status
      const isAuthValid = await this.authManager.validateAuth(tenantId);
      
      // Get rate limit status
      const rateLimitStatus = await this.rateLimiter.getRateLimitStatus(tenantId, config);
      
      // Determine overall health
      const isHealthy = isAuthValid && rateLimitStatus.remaining > 0;
      
      const status: GoogleWorkspaceHealthStatus = {
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
      const errorResult: GoogleWorkspaceHealthStatus = {
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
    configUpdates: Partial<GoogleWorkspaceConfig>
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
   * Get or create configuration for tenant
   */
  private async getConfig(tenantId: string): Promise<GoogleWorkspaceConfig> {
    let config = this.configCache.get(tenantId);
    
    if (!config) {
      // Load from database or use defaults
      config = this.buildConfig(tenantId, {});
      this.configCache.set(tenantId, config);
    }
    
    return config;
  }

  /**
   * Build complete configuration with defaults
   */
  private buildConfig(tenantId: string, partial: Partial<GoogleWorkspaceConfig>): GoogleWorkspaceConfig {
    return {
      tenantId,
      domain: partial.domain || '',
      adminEmail: partial.adminEmail || '',
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
      service: 'GoogleWorkspaceService',
      message,
      ...context,
      timestamp: new Date().toISOString()
    }));
  }

  private logError(message: string, error: any, context?: any): void {
    console.error(JSON.stringify({
      level: 'ERROR',
      service: 'GoogleWorkspaceService',
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