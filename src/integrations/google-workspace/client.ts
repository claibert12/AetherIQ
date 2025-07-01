import axios, { AxiosResponse } from 'axios';
import { GoogleWorkspaceAuthManager } from './auth-manager';
import { GoogleWorkspaceRateLimiter } from './rate-limiter';
import { MeteringClient } from '../../core/meter';
import {
  GoogleWorkspaceConfig,
  GoogleWorkspaceOperation,
  GoogleWorkspaceOperationRequest,
  GoogleWorkspaceOperationResponse,
  GoogleWorkspaceUser,
  CreateUserRequest,
  UpdateUserRequest,
  ListUsersRequest,
  ListUsersResponse,
  GoogleWorkspaceError,
  GoogleWorkspaceAuditEvent
} from './types';

/**
 * Google Workspace Integration Client
 * 
 * Enterprise-grade client for Google Workspace Admin SDK with:
 * - Multi-tenant authentication
 * - Rate limiting and quota management
 * - Comprehensive error handling and classification
 * - Automatic retries with exponential backoff
 * - Full audit logging and metering
 * - Configurable timeouts and failover
 */
export class GoogleWorkspaceClient {
  private authManager: GoogleWorkspaceAuthManager;
  private rateLimiter: GoogleWorkspaceRateLimiter;
  private meteringClient: MeteringClient;
  private readonly BASE_URL = 'https://www.googleapis.com/admin/directory/v1';

  constructor() {
    this.authManager = new GoogleWorkspaceAuthManager();
    this.rateLimiter = new GoogleWorkspaceRateLimiter();
    this.meteringClient = new MeteringClient();
  }

  /**
   * Execute Google Workspace operation with full enterprise controls
   */
  async executeOperation<T = any>(
    request: GoogleWorkspaceOperationRequest,
    config: GoogleWorkspaceConfig
  ): Promise<GoogleWorkspaceOperationResponse<T>> {
    const startTime = Date.now();
    const auditEvent: Partial<GoogleWorkspaceAuditEvent> = {
      eventId: `gws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId: request.tenantId,
      operation: request.operation,
      parameters: request.parameters,
      timestamp: new Date().toISOString()
    };
    
    if (request.runId) {
      auditEvent.runId = request.runId;
    }
    
    try {
      // Check rate limits
      const rateLimitResult = await this.rateLimiter.checkRateLimit(request.tenantId, config);
      if (!rateLimitResult.allowed) {
        throw this.createError(
          'RATE_LIMIT_EXCEEDED',
          'Rate limit exceeded for tenant',
          {
            tenantId: request.tenantId,
            retryAfterMs: rateLimitResult.retryAfterMs,
            remaining: rateLimitResult.remaining
          },
          true,
          'rate_limit',
          429
        );
      }

      // Execute operation with retry logic
      const result = await this.executeWithRetry(request, config);

      // Create successful response
      const response: GoogleWorkspaceOperationResponse<T> = {
        success: true,
        data: result.data,
        metadata: {
          operation: request.operation,
          tenantId: request.tenantId,
          executionTimeMs: Date.now() - startTime,
          rateLimitRemaining: rateLimitResult.remaining,
          quotaUsed: this.calculateQuotaUsed(request.operation),
          timestamp: new Date().toISOString()
        }
      };

      // Log audit event
      await this.logAuditEvent({
        ...auditEvent,
        result: 'success',
        executionTimeMs: response.metadata.executionTimeMs,
        targetResource: this.extractTargetResource(request)
      } as GoogleWorkspaceAuditEvent);

      // Publish metering event
      if (config.features.enableMetering) {
        const meteringEvent: any = {
          eventType: 'task_completed',
          tenantId: request.tenantId,
          integration: 'google_workspace',
          operation: request.operation,
          success: true,
          executionTimeMs: response.metadata.executionTimeMs,
          resourcesUsed: response.metadata.quotaUsed,
          timestamp: response.metadata.timestamp
        };
        
        if (request.runId) {
          meteringEvent.runId = request.runId;
        }
        
        await this.publishMeteringEvent(meteringEvent);
      }

      return response;

    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      const wsError: GoogleWorkspaceError = (error as any).category && (error as any).code && (error as any).retryable !== undefined
        ? error as GoogleWorkspaceError
        : this.createGoogleWorkspaceError(
            error.message || 'Unknown error',
            'internal',
            error.code || 'UNKNOWN_ERROR',
            error instanceof Error
          );

      // Log audit event for failure
      await this.logAuditEvent({
        ...auditEvent,
        result: 'failure',
        error: wsError,
        executionTimeMs,
        targetResource: this.extractTargetResource(request)
      } as GoogleWorkspaceAuditEvent);

      // Publish metering event for failure
      if (config.features.enableMetering) {
        const meteringEvent: any = {
          eventType: 'task_failed',
          tenantId: request.tenantId,
          integration: 'google_workspace',
          operation: request.operation,
          success: false,
          executionTimeMs,
          resourcesUsed: 0,
          timestamp: new Date().toISOString(),
          metadata: { error: wsError.code }
        };
        
        if (request.runId) {
          meteringEvent.runId = request.runId;
        }
        
        await this.publishMeteringEvent(meteringEvent);
      }

      return {
        success: false,
        error: wsError,
        metadata: {
          operation: request.operation,
          tenantId: request.tenantId,
          executionTimeMs,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * List users in Google Workspace
   */
  async listUsers(tenantId: string, params: ListUsersRequest, runId?: string): Promise<GoogleWorkspaceOperationResponse<ListUsersResponse>> {
    const config = await this.getConfig(tenantId);
    
    const operationRequest: any = {
      operation: 'list_users',
      tenantId,
      parameters: params
    };
    
    if (runId) {
      operationRequest.runId = runId;
    }
    
    return this.executeOperation<ListUsersResponse>(operationRequest, config);
  }

  /**
   * Get specific user by ID or email
   */
  async getUser(tenantId: string, userKey: string, runId?: string): Promise<GoogleWorkspaceOperationResponse<GoogleWorkspaceUser>> {
    const config = await this.getConfig(tenantId);
    
    const operationRequest: any = {
      operation: 'get_user',
      tenantId,
      parameters: { userKey }
    };
    
    if (runId) {
      operationRequest.runId = runId;
    }
    
    return this.executeOperation<GoogleWorkspaceUser>(operationRequest, config);
  }

  /**
   * Create new user
   */
  async createUser(tenantId: string, userData: CreateUserRequest, runId?: string): Promise<GoogleWorkspaceOperationResponse<GoogleWorkspaceUser>> {
    const config = await this.getConfig(tenantId);
    
    const operationRequest: any = {
      operation: 'create_user',
      tenantId,
      parameters: userData
    };
    
    if (runId) {
      operationRequest.runId = runId;
    }
    
    return this.executeOperation<GoogleWorkspaceUser>(operationRequest, config);
  }

  /**
   * Update existing user
   */
  async updateUser(tenantId: string, _userKey: string, updateData: UpdateUserRequest, runId?: string): Promise<GoogleWorkspaceOperationResponse<GoogleWorkspaceUser>> {
    const config = await this.getConfig(tenantId);
    
    const operationRequest: any = {
      operation: 'update_user',
      tenantId,
      parameters: updateData
    };
    
    if (runId) {
      operationRequest.runId = runId;
    }
    
    return this.executeOperation<GoogleWorkspaceUser>(operationRequest, config);
  }

  /**
   * Suspend user
   */
  async suspendUser(tenantId: string, userKey: string, runId?: string): Promise<GoogleWorkspaceOperationResponse<GoogleWorkspaceUser>> {
    const config = await this.getConfig(tenantId);
    
    const operationRequest: any = {
      operation: 'suspend_user',
      tenantId,
      parameters: { userKey, suspended: true }
    };
    
    if (runId) {
      operationRequest.runId = runId;
    }
    
    return this.executeOperation<GoogleWorkspaceUser>(operationRequest, config);
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry(
    request: GoogleWorkspaceOperationRequest,
    config: GoogleWorkspaceConfig
  ): Promise<AxiosResponse> {
    const maxAttempts = config.retryConfig.maxAttempts || 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.makeApiCall(request, config);
      } catch (error: any) {
        lastError = error;
        
        const wsError = this.classifyError(error);
        
        // Don't retry non-retryable errors
        if (!wsError.retryable || attempt >= maxAttempts) {
          throw wsError;
        }

        // Calculate retry delay
        const delay = this.calculateRetryDelay(attempt, config.retryConfig);
        await this.sleep(delay);

        this.logInfo('Retrying operation', {
          tenantId: request.tenantId,
          operation: request.operation,
          attempt,
          maxAttempts,
          delay,
          error: wsError.code
        });
      }
    }

    throw lastError;
  }

  /**
   * Make actual API call to Google Workspace
   */
  private async makeApiCall(
    request: GoogleWorkspaceOperationRequest,
    config: GoogleWorkspaceConfig
  ): Promise<AxiosResponse> {
    const token = await this.authManager.getValidToken(request.tenantId);
    const url = this.buildApiUrl(request.operation, request.parameters);
    const method = this.getHttpMethod(request.operation);
    const timeout = request.options?.timeout || config.timeouts.requestTimeoutMs;

    const axiosConfig: any = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AetherIQ-GoogleWorkspace/1.0'
      },
      timeout,
      validateStatus: (status: number) => status < 500 // Retry on 5xx errors
    };

    // Add request body for POST/PUT operations
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      axiosConfig['data'] = this.buildRequestBody(request.operation, request.parameters);
    } else {
      axiosConfig['params'] = this.buildQueryParams(request.operation, request.parameters);
    }

    const response = await axios(axiosConfig);

    // Handle 4xx errors
    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  /**
   * Build API URL based on operation
   */
  private buildApiUrl(operation: GoogleWorkspaceOperation, params: any): string {
    switch (operation) {
      case 'list_users':
        return `${this.BASE_URL}/users`;
      case 'get_user':
        return `${this.BASE_URL}/users/${encodeURIComponent(params.userKey)}`;
      case 'create_user':
        return `${this.BASE_URL}/users`;
      case 'update_user':
      case 'suspend_user':
      case 'unsuspend_user':
        return `${this.BASE_URL}/users/${encodeURIComponent(params.userId || params.userKey)}`;
      case 'delete_user':
        return `${this.BASE_URL}/users/${encodeURIComponent(params.userKey)}`;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  /**
   * Get HTTP method for operation
   */
  private getHttpMethod(operation: GoogleWorkspaceOperation): string {
    switch (operation) {
      case 'list_users':
      case 'get_user':
        return 'GET';
      case 'create_user':
        return 'POST';
      case 'update_user':
      case 'suspend_user':
      case 'unsuspend_user':
        return 'PUT';
      case 'delete_user':
        return 'DELETE';
      default:
        return 'GET';
    }
  }

  /**
   * Build request body for POST/PUT operations
   */
  private buildRequestBody(operation: GoogleWorkspaceOperation, params: any): any {
    switch (operation) {
      case 'create_user':
        return {
          primaryEmail: params.primaryEmail,
          name: params.name,
          password: params.password,
          orgUnitPath: params.orgUnitPath || '/',
          suspended: params.suspended || false,
          changePasswordAtNextLogin: params.changePasswordAtNextLogin || true,
          includeInGlobalAddressList: params.includeInGlobalAddressList !== false
        };
      case 'update_user':
      case 'suspend_user':
      case 'unsuspend_user':
        const updateBody: any = {};
        if (params.suspended !== undefined) updateBody.suspended = params.suspended;
        if (params.orgUnitPath !== undefined) updateBody.orgUnitPath = params.orgUnitPath;
        if (params.name !== undefined) updateBody.name = params.name;
        if (params.password !== undefined) updateBody.password = params.password;
        if (params.changePasswordAtNextLogin !== undefined) updateBody.changePasswordAtNextLogin = params.changePasswordAtNextLogin;
        return updateBody;
      default:
        return {};
    }
  }

  /**
   * Build query parameters for GET operations
   */
  private buildQueryParams(operation: GoogleWorkspaceOperation, params: any): any {
    switch (operation) {
      case 'list_users':
        const queryParams: any = {};
        if (params.customer) queryParams.customer = params.customer;
        if (params.domain) queryParams.domain = params.domain;
        if (params.maxResults) queryParams.maxResults = params.maxResults;
        if (params.pageToken) queryParams.pageToken = params.pageToken;
        if (params.query) queryParams.query = params.query;
        if (params.orderBy) queryParams.orderBy = params.orderBy;
        if (params.sortOrder) queryParams.sortOrder = params.sortOrder;
        if (params.showDeleted) queryParams.showDeleted = params.showDeleted;
        return queryParams;
      default:
        return {};
    }
  }

  /**
   * Classify errors into standardized format
   */
  private classifyError(error: any): GoogleWorkspaceError {
    try {
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        switch (status) {
          case 401:
            return this.createError('UNAUTHORIZED', 'Authentication failed', data, false, 'auth', status);
          case 403:
            return this.createError('FORBIDDEN', 'Insufficient permissions', data, false, 'permission', status);
          case 404:
            return this.createError('NOT_FOUND', 'Resource not found', data, false, 'not_found', status);
          case 409:
            return this.createError('CONFLICT', 'Resource already exists', data, false, 'validation', status);
          case 429:
            return this.createError('RATE_LIMITED', 'Rate limit exceeded', data, true, 'rate_limit', status);
          case 500:
          case 502:
          case 503:
          case 504:
            return this.createError('SERVER_ERROR', 'Google server error', data, true, 'internal', status);
          default:
            return this.createError('HTTP_ERROR', `HTTP ${status} error`, data, status >= 500, 'network', status);
        }
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return this.createError('TIMEOUT', 'Request timeout', { code: error.code }, true, 'network');
      }

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return this.createError('NETWORK_ERROR', 'Network connection failed', { code: error.code }, true, 'network');
      }

      return this.createError('UNKNOWN_ERROR', error.message || 'Unknown error', { originalError: error.name }, false, 'internal');
    } catch (error: any) {
      this.logError('Failed to classify error', error, { originalError: error });
      return {
        message: error.message || 'Unknown error occurred',
        category: 'internal',
        code: 'CLASSIFICATION_ERROR',
        retryable: false
      };
    }
  }

  /**
   * Create standardized error object
   */
  private createError(
    code: string,
    message: string,
    details: any = {},
    retryable: boolean = false,
    category: GoogleWorkspaceError['category'] = 'internal',
    httpStatus?: number
  ): GoogleWorkspaceError {
    const error: GoogleWorkspaceError = {
      code,
      message,
      details,
      retryable,
      category
    };
    
    if (httpStatus !== undefined) {
      error.httpStatus = httpStatus;
    }
    
    return error;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, retryConfig: any): number {
    const baseDelay = retryConfig.baseDelayMs || 1000;
    const maxDelay = retryConfig.maxDelayMs || 30000;
    
    let delay: number;
    switch (retryConfig.backoffStrategy) {
      case 'exponential':
        delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        break;
      case 'linear':
        delay = Math.min(baseDelay * attempt, maxDelay);
        break;
      case 'fixed':
      default:
        delay = baseDelay;
        break;
    }

    // Add jitter to prevent thundering herd
    return delay + (Math.random() * 1000);
  }

  /**
   * Calculate quota units used for operation
   */
  private calculateQuotaUsed(operation: GoogleWorkspaceOperation): number {
    // Google Workspace Admin SDK quota costs
    switch (operation) {
      case 'list_users':
        return 1;
      case 'get_user':
        return 1;
      case 'create_user':
        return 5;
      case 'update_user':
      case 'suspend_user':
      case 'unsuspend_user':
        return 3;
      case 'delete_user':
        return 5;
      default:
        return 1;
    }
  }

  /**
   * Extract target resource for audit logging
   */
  private extractTargetResource(request: GoogleWorkspaceOperationRequest): string {
    const params = request.parameters;
    if (params.userKey) return `user:${params.userKey}`;
    if (params.userId) return `user:${params.userId}`;
    if (params.primaryEmail) return `user:${params.primaryEmail}`;
    return request.operation;
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(event: GoogleWorkspaceAuditEvent): Promise<void> {
    try {
      // In production, this would publish to a dedicated audit log stream
      this.logInfo('Google Workspace audit event', event);
    } catch (error: any) {
      this.logError('Failed to log audit event', error, { eventId: event.eventId });
    }
  }

  /**
   * Publish metering event
   */
  private async publishMeteringEvent(event: any): Promise<void> {
    try {
      await this.meteringClient.publishMeteringEvent(event);
    } catch (error) {
      console.error('Failed to publish metering event:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private logInfo(message: string, context?: any): void {
    console.log(JSON.stringify({
      level: 'INFO',
      service: 'GoogleWorkspaceClient',
      message,
      ...context,
      timestamp: new Date().toISOString()
    }));
  }

  private logError(message: string, error: any, context?: any): void {
    console.error(JSON.stringify({
      level: 'ERROR',
      service: 'GoogleWorkspaceClient',
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

  /**
   * Get configuration for tenant
   */
  private async getConfig(_tenantId: string): Promise<GoogleWorkspaceConfig> {
    // This would typically fetch from a configuration service
    // For now, return a default configuration
    return {
      tenantId: _tenantId,
      domain: process.env.GOOGLE_DOMAIN || 'example.com',
      adminEmail: process.env.GOOGLE_ADMIN_EMAIL || 'admin@example.com',
      rateLimits: {
        requestsPerSecond: 10,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        burstLimit: 10
      },
      retryConfig: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 30000
      },
      timeouts: {
        connectionTimeoutMs: 5000,
        requestTimeoutMs: 30000
      },
      features: {
        enableMetering: true,
        enableAuditLogging: true,
        enableCaching: false,
        cacheTtlSeconds: 300
      },
      failover: {
        enableFailover: false,
        fallbackBehavior: 'reject',
        maxQueueSize: 100
      }
    };
  }

  private createGoogleWorkspaceError(
    message: string, 
    category: GoogleWorkspaceError['category'], 
    code: string, 
    retryable: boolean = false
  ): GoogleWorkspaceError {
    return {
      message,
      category,
      code,
      retryable
    };
  }
} 