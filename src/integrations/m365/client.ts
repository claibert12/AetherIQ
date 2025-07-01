import axios, { AxiosResponse } from 'axios';
import { z } from 'zod';
import { M365AuthManager } from './auth-manager';
import { M365RateLimiter } from './rate-limiter';
import {
  M365User,
  M365Error,
  M365Config,
  M365Credentials,
  M365OperationRequest,
  CreateUserRequest,
  UpdateUserRequest,
  ListUsersRequest,
  ListUsersResponse,
  M365OperationResponse,
  M365AuditEvent,
  M365_ENDPOINTS
} from './types';

// Zod schemas for validation
const M365UserSchema = z.object({
  id: z.string(),
  userPrincipalName: z.string(),
  displayName: z.string(),
  givenName: z.string(),
  surname: z.string(),
  mail: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  officeLocation: z.string().optional(),
  mobilePhone: z.string().optional(),
  businessPhones: z.array(z.string()),
  accountEnabled: z.boolean(),
  usageLocation: z.string().optional(),
  preferredLanguage: z.string().optional(),
  createdDateTime: z.string(),
  lastSignInDateTime: z.string().optional(),
  assignedLicenses: z.array(z.object({
    skuId: z.string(),
    disabledPlans: z.array(z.string())
  })),
  assignedPlans: z.array(z.object({
    assignedDateTime: z.string(),
    capabilityStatus: z.string(),
    service: z.string(),
    servicePlanId: z.string()
  }))
});

const ListUsersResponseSchema = z.object({
  value: z.array(M365UserSchema),
  '@odata.nextLink': z.string().optional(),
  '@odata.count': z.number().optional()
});

/**
 * Microsoft 365 Graph API Client
 * 
 * Provides enterprise-grade Microsoft 365 user management operations with:
 * - CRUD operations for users
 * - Error classification and retry logic
 * - Rate limiting integration
 * - Audit logging and metering
 * - Type-safe validation with Zod
 */
export class M365Client {
  private authManager: M365AuthManager;
  private rateLimiter: M365RateLimiter;

  constructor() {
    this.authManager = new M365AuthManager();
    this.rateLimiter = new M365RateLimiter();
  }

  /**
   * List users with pagination support
   */
  async listUsers(
    tenantId: string, 
    options: ListUsersRequest = {}, 
    runId?: string
  ): Promise<M365OperationResponse<ListUsersResponse>> {
    const startTime = Date.now();
    const operation = 'list_users';

    try {
      const config = await this.getConfig(tenantId);
      
      // Check rate limits
      const rateLimitResult = await this.rateLimiter.checkRateLimit(tenantId, config);
      if (!rateLimitResult.allowed) {
        throw this.createError(
          'RATE_LIMIT_EXCEEDED',
          'Rate limit exceeded for list users operation',
          { retryAfterMs: rateLimitResult.retryAfterMs },
          true,
          'rate_limit',
          429
        );
      }

      // Get valid access token
      const credentials = this.getCredentialsFromConfig(config);
      const tokens = await this.authManager.getValidTokens(tenantId, credentials);

      // Build query parameters
      const queryParams = new URLSearchParams();
      if (options.filter) queryParams.append('$filter', options.filter);
      if (options.search) queryParams.append('$search', `"${options.search}"`);
      if (options.orderBy) queryParams.append('$orderby', options.orderBy);
      if (options.select && options.select.length > 0) {
        queryParams.append('$select', options.select.join(','));
      }
      if (options.top) queryParams.append('$top', options.top.toString());
      if (options.skip) queryParams.append('$skip', options.skip.toString());

      const url = `${M365_ENDPOINTS.GRAPH_BASE}${M365_ENDPOINTS.USERS}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

      // Make API request with retry logic
      const response = await this.makeRequestWithRetry(
        'GET',
        url,
        null,
        tokens.accessToken,
        config,
        tenantId,
        runId
      );

      // Validate response
      const validatedData = ListUsersResponseSchema.parse(response.data);
      
      // Transform users to match our type, handling optional properties properly
      const users: M365User[] = validatedData.value.map(user => {
        const transformedUser: M365User = {
          id: user.id,
          userPrincipalName: user.userPrincipalName,
          displayName: user.displayName,
          givenName: user.givenName,
          surname: user.surname,
          businessPhones: user.businessPhones,
          accountEnabled: user.accountEnabled,
          createdDateTime: user.createdDateTime,
          assignedLicenses: user.assignedLicenses,
          assignedPlans: user.assignedPlans
        };
        
        // Only add optional properties if they exist
        if (user.mail !== undefined) transformedUser.mail = user.mail;
        if (user.jobTitle !== undefined) transformedUser.jobTitle = user.jobTitle;
        if (user.department !== undefined) transformedUser.department = user.department;
        if (user.officeLocation !== undefined) transformedUser.officeLocation = user.officeLocation;
        if (user.mobilePhone !== undefined) transformedUser.mobilePhone = user.mobilePhone;
        if (user.usageLocation !== undefined) transformedUser.usageLocation = user.usageLocation;
        if (user.preferredLanguage !== undefined) transformedUser.preferredLanguage = user.preferredLanguage;
        if (user.lastSignInDateTime !== undefined) transformedUser.lastSignInDateTime = user.lastSignInDateTime;
        
        return transformedUser;
      });
      
      const result: ListUsersResponse = {
        users
      };
      
      // Only add optional properties if they exist
      if (validatedData['@odata.nextLink'] !== undefined) {
        result.nextLink = validatedData['@odata.nextLink'];
      }
      if (validatedData['@odata.count'] !== undefined) {
        result.totalCount = validatedData['@odata.count'];
      }

      const executionTimeMs = Date.now() - startTime;

      // Log operation and meter usage
      await this.logOperation({
        operation,
        tenantId,
        ...(runId && { runId }),
        parameters: options,
        result: 'success',
        executionTimeMs
      });

      await this.meterOperation(tenantId, operation, runId, executionTimeMs, users.length);

      return {
        success: true,
        data: result,
        metadata: {
          operation,
          tenantId,
          ...(runId && { runId }),
          executionTimeMs,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      const m365Error = this.classifyError(error);

      await this.logOperation({
        operation,
        tenantId,
        ...(runId && { runId }),
        parameters: options,
        result: 'failure',
        error: m365Error,
        executionTimeMs
      });

      return {
        success: false,
        error: m365Error,
        metadata: {
          operation,
          tenantId,
          ...(runId && { runId }),
          executionTimeMs,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Get specific user by ID or userPrincipalName
   */
  async getUser(
    tenantId: string, 
    userKey: string, 
    runId?: string
  ): Promise<M365OperationResponse<M365User>> {
    const startTime = Date.now();
    const operation = 'get_user';

    try {
      const config = await this.getConfig(tenantId);
      
      // Check rate limits
      const rateLimitResult = await this.rateLimiter.checkRateLimit(tenantId, config);
      if (!rateLimitResult.allowed) {
        throw this.createError(
          'RATE_LIMIT_EXCEEDED',
          'Rate limit exceeded for get user operation',
          { retryAfterMs: rateLimitResult.retryAfterMs },
          true,
          'rate_limit',
          429
        );
      }

      // Get valid access token
      const credentials = this.getCredentialsFromConfig(config);
      const tokens = await this.authManager.getValidTokens(tenantId, credentials);

      const url = `${M365_ENDPOINTS.GRAPH_BASE}${M365_ENDPOINTS.USERS}/${encodeURIComponent(userKey)}`;

      // Make API request with retry logic
      const response = await this.makeRequestWithRetry(
        'GET',
        url,
        null,
        tokens.accessToken,
        config,
        tenantId,
        runId
      );

      // Validate response
      const validatedUser = M365UserSchema.parse(response.data);
      const user: M365User = {
        id: validatedUser.id,
        userPrincipalName: validatedUser.userPrincipalName,
        displayName: validatedUser.displayName,
        givenName: validatedUser.givenName,
        surname: validatedUser.surname,
        businessPhones: validatedUser.businessPhones,
        accountEnabled: validatedUser.accountEnabled,
        createdDateTime: validatedUser.createdDateTime,
        assignedLicenses: validatedUser.assignedLicenses,
        assignedPlans: validatedUser.assignedPlans
      };
      
      // Only add optional properties if they exist
      if (validatedUser.mail !== undefined) user.mail = validatedUser.mail;
      if (validatedUser.jobTitle !== undefined) user.jobTitle = validatedUser.jobTitle;
      if (validatedUser.department !== undefined) user.department = validatedUser.department;
      if (validatedUser.officeLocation !== undefined) user.officeLocation = validatedUser.officeLocation;
      if (validatedUser.mobilePhone !== undefined) user.mobilePhone = validatedUser.mobilePhone;
      if (validatedUser.usageLocation !== undefined) user.usageLocation = validatedUser.usageLocation;
      if (validatedUser.preferredLanguage !== undefined) user.preferredLanguage = validatedUser.preferredLanguage;
      if (validatedUser.lastSignInDateTime !== undefined) user.lastSignInDateTime = validatedUser.lastSignInDateTime;
      const executionTimeMs = Date.now() - startTime;

      // Log operation and meter usage
      await this.logOperation({
        operation,
        tenantId,
        ...(runId && { runId }),
        parameters: { userKey },
        result: 'success',
        executionTimeMs
      });

      await this.meterOperation(tenantId, operation, runId, executionTimeMs, 1);

      return {
        success: true,
        data: user,
        metadata: {
          operation,
          tenantId,
          ...(runId && { runId }),
          executionTimeMs,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      const m365Error = this.classifyError(error);

      await this.logOperation({
        operation,
        tenantId,
        ...(runId && { runId }),
        parameters: { userKey },
        result: 'failure',
        error: m365Error,
        executionTimeMs
      });

      return {
        success: false,
        error: m365Error,
        metadata: {
          operation,
          tenantId,
          ...(runId && { runId }),
          executionTimeMs,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Create new user
   */
  async createUser(
    tenantId: string, 
    userData: CreateUserRequest, 
    runId?: string
  ): Promise<M365OperationResponse<M365User>> {
    const startTime = Date.now();
    const operation = 'create_user';

    try {
      const config = await this.getConfig(tenantId);
      
      // Check rate limits
      const rateLimitResult = await this.rateLimiter.checkRateLimit(tenantId, config);
      if (!rateLimitResult.allowed) {
        throw this.createError(
          'RATE_LIMIT_EXCEEDED',
          'Rate limit exceeded for create user operation',
          { retryAfterMs: rateLimitResult.retryAfterMs },
          true,
          'rate_limit',
          429
        );
      }

      // Get valid access token
      const credentials = this.getCredentialsFromConfig(config);
      const tokens = await this.authManager.getValidTokens(tenantId, credentials);

      const url = `${M365_ENDPOINTS.GRAPH_BASE}${M365_ENDPOINTS.USERS}`;

      // Make API request with retry logic
      const response = await this.makeRequestWithRetry(
        'POST',
        url,
        userData,
        tokens.accessToken,
        config,
        tenantId,
        runId
      );

      // Validate response
      const validatedUser = M365UserSchema.parse(response.data);
      const user: M365User = {
        id: validatedUser.id,
        userPrincipalName: validatedUser.userPrincipalName,
        displayName: validatedUser.displayName,
        givenName: validatedUser.givenName,
        surname: validatedUser.surname,
        businessPhones: validatedUser.businessPhones,
        accountEnabled: validatedUser.accountEnabled,
        createdDateTime: validatedUser.createdDateTime,
        assignedLicenses: validatedUser.assignedLicenses,
        assignedPlans: validatedUser.assignedPlans
      };
      
      // Only add optional properties if they exist
      if (validatedUser.mail !== undefined) user.mail = validatedUser.mail;
      if (validatedUser.jobTitle !== undefined) user.jobTitle = validatedUser.jobTitle;
      if (validatedUser.department !== undefined) user.department = validatedUser.department;
      if (validatedUser.officeLocation !== undefined) user.officeLocation = validatedUser.officeLocation;
      if (validatedUser.mobilePhone !== undefined) user.mobilePhone = validatedUser.mobilePhone;
      if (validatedUser.usageLocation !== undefined) user.usageLocation = validatedUser.usageLocation;
      if (validatedUser.preferredLanguage !== undefined) user.preferredLanguage = validatedUser.preferredLanguage;
      if (validatedUser.lastSignInDateTime !== undefined) user.lastSignInDateTime = validatedUser.lastSignInDateTime;
      const executionTimeMs = Date.now() - startTime;

      // Log operation and meter usage
      await this.logOperation({
        operation,
        tenantId,
        ...(runId && { runId }),
        parameters: userData,
        result: 'success',
        executionTimeMs
      });

      await this.meterOperation(tenantId, operation, runId, executionTimeMs, 1);

      return {
        success: true,
        data: user,
        metadata: {
          operation,
          tenantId,
          ...(runId && { runId }),
          executionTimeMs,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      const m365Error = this.classifyError(error);

      await this.logOperation({
        operation,
        tenantId,
        ...(runId && { runId }),
        parameters: userData,
        result: 'failure',
        error: m365Error,
        executionTimeMs
      });

      return {
        success: false,
        error: m365Error,
        metadata: {
          operation,
          tenantId,
          ...(runId && { runId }),
          executionTimeMs,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Update existing user
   */
  async updateUser(
    tenantId: string, 
    userKey: string, 
    updateData: UpdateUserRequest, 
    runId?: string
  ): Promise<M365OperationResponse<M365User>> {
    const startTime = Date.now();
    const operation = 'update_user';

    try {
      const config = await this.getConfig(tenantId);
      
      // Check rate limits
      const rateLimitResult = await this.rateLimiter.checkRateLimit(tenantId, config);
      if (!rateLimitResult.allowed) {
        throw this.createError(
          'RATE_LIMIT_EXCEEDED',
          'Rate limit exceeded for update user operation',
          { retryAfterMs: rateLimitResult.retryAfterMs },
          true,
          'rate_limit',
          429
        );
      }

      // Get valid access token
      const credentials = this.getCredentialsFromConfig(config);
      const tokens = await this.authManager.getValidTokens(tenantId, credentials);

      const url = `${M365_ENDPOINTS.GRAPH_BASE}${M365_ENDPOINTS.USERS}/${encodeURIComponent(userKey)}`;

      // Remove id from update data if present
      const { id, ...updatePayload } = updateData;

      // Make API request with retry logic
      const response = await this.makeRequestWithRetry(
        'PATCH',
        url,
        updatePayload,
        tokens.accessToken,
        config,
        tenantId,
        runId
      );

      // Validate response
      const validatedUser = M365UserSchema.parse(response.data);
      const user: M365User = {
        id: validatedUser.id,
        userPrincipalName: validatedUser.userPrincipalName,
        displayName: validatedUser.displayName,
        givenName: validatedUser.givenName,
        surname: validatedUser.surname,
        businessPhones: validatedUser.businessPhones,
        accountEnabled: validatedUser.accountEnabled,
        createdDateTime: validatedUser.createdDateTime,
        assignedLicenses: validatedUser.assignedLicenses,
        assignedPlans: validatedUser.assignedPlans
      };
      
      // Only add optional properties if they exist
      if (validatedUser.mail !== undefined) user.mail = validatedUser.mail;
      if (validatedUser.jobTitle !== undefined) user.jobTitle = validatedUser.jobTitle;
      if (validatedUser.department !== undefined) user.department = validatedUser.department;
      if (validatedUser.officeLocation !== undefined) user.officeLocation = validatedUser.officeLocation;
      if (validatedUser.mobilePhone !== undefined) user.mobilePhone = validatedUser.mobilePhone;
      if (validatedUser.usageLocation !== undefined) user.usageLocation = validatedUser.usageLocation;
      if (validatedUser.preferredLanguage !== undefined) user.preferredLanguage = validatedUser.preferredLanguage;
      if (validatedUser.lastSignInDateTime !== undefined) user.lastSignInDateTime = validatedUser.lastSignInDateTime;
      const executionTimeMs = Date.now() - startTime;

      // Log operation and meter usage
      await this.logOperation({
        operation,
        tenantId,
        ...(runId && { runId }),
        parameters: { userKey, updateData },
        result: 'success',
        executionTimeMs
      });

      await this.meterOperation(tenantId, operation, runId, executionTimeMs, 1);

      return {
        success: true,
        data: user,
        metadata: {
          operation,
          tenantId,
          ...(runId && { runId }),
          executionTimeMs,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      const m365Error = this.classifyError(error);

      await this.logOperation({
        operation,
        tenantId,
        ...(runId && { runId }),
        parameters: { userKey, updateData },
        result: 'failure',
        error: m365Error,
        executionTimeMs
      });

      return {
        success: false,
        error: m365Error,
        metadata: {
          operation,
          tenantId,
          ...(runId && { runId }),
          executionTimeMs,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Delete user
   */
  async deleteUser(
    tenantId: string, 
    userKey: string, 
    runId?: string
  ): Promise<M365OperationResponse<void>> {
    const startTime = Date.now();
    const operation = 'delete_user';

    try {
      const config = await this.getConfig(tenantId);
      
      // Check rate limits
      const rateLimitResult = await this.rateLimiter.checkRateLimit(tenantId, config);
      if (!rateLimitResult.allowed) {
        throw this.createError(
          'RATE_LIMIT_EXCEEDED',
          'Rate limit exceeded for delete user operation',
          { retryAfterMs: rateLimitResult.retryAfterMs },
          true,
          'rate_limit',
          429
        );
      }

      // Get valid access token
      const credentials = this.getCredentialsFromConfig(config);
      const tokens = await this.authManager.getValidTokens(tenantId, credentials);

      const url = `${M365_ENDPOINTS.GRAPH_BASE}${M365_ENDPOINTS.USERS}/${encodeURIComponent(userKey)}`;

      // Make API request with retry logic
      await this.makeRequestWithRetry(
        'DELETE',
        url,
        null,
        tokens.accessToken,
        config,
        tenantId,
        runId
      );

      const executionTimeMs = Date.now() - startTime;

      // Log operation and meter usage
      await this.logOperation({
        operation,
        tenantId,
        ...(runId && { runId }),
        parameters: { userKey },
        result: 'success',
        executionTimeMs
      });

      await this.meterOperation(tenantId, operation, runId, executionTimeMs, 1);

      return {
        success: true,
        metadata: {
          operation,
          tenantId,
          ...(runId && { runId }),
          executionTimeMs,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      const m365Error = this.classifyError(error);

      await this.logOperation({
        operation,
        tenantId,
        ...(runId && { runId }),
        parameters: { userKey },
        result: 'failure',
        error: m365Error,
        executionTimeMs
      });

      return {
        success: false,
        error: m365Error,
        metadata: {
          operation,
          tenantId,
          ...(runId && { runId }),
          executionTimeMs,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Disable user account
   */
  async disableUser(
    tenantId: string, 
    userKey: string, 
    runId?: string
  ): Promise<M365OperationResponse<M365User>> {
    return this.updateUser(tenantId, userKey, { id: userKey, accountEnabled: false }, runId);
  }

  /**
   * Enable user account
   */
  async enableUser(
    tenantId: string, 
    userKey: string, 
    runId?: string
  ): Promise<M365OperationResponse<M365User>> {
    return this.updateUser(tenantId, userKey, { id: userKey, accountEnabled: true }, runId);
  }

  /**
   * Execute generic operation (for flexibility)
   */
  async executeOperation(
    request: M365OperationRequest
  ): Promise<M365OperationResponse<any>> {
    switch (request.operation) {
      case 'list_users':
        return this.listUsers(request.tenantId, request.parameters, request.runId);
      case 'get_user':
        return this.getUser(request.tenantId, request.parameters.userKey, request.runId);
      case 'create_user':
        return this.createUser(request.tenantId, request.parameters, request.runId);
      case 'update_user':
        return this.updateUser(request.tenantId, request.parameters.userKey, request.parameters.updateData, request.runId);
      case 'delete_user':
        return this.deleteUser(request.tenantId, request.parameters.userKey, request.runId);
      case 'disable_user':
        return this.disableUser(request.tenantId, request.parameters.userKey, request.runId);
      case 'enable_user':
        return this.enableUser(request.tenantId, request.parameters.userKey, request.runId);
      default:
        throw this.createError(
          'UNSUPPORTED_OPERATION',
          `Unsupported operation: ${request.operation}`,
          { operation: request.operation },
          false,
          'validation'
        );
    }
  }

  /**
   * Make HTTP request with retry logic and error handling
   */
  private async makeRequestWithRetry(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    data: any,
    accessToken: string,
    config: M365Config,
    tenantId: string,
    runId?: string
  ): Promise<AxiosResponse> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= config.retryConfig.maxAttempts; attempt++) {
      try {
        const response = await axios({
          method,
          url,
          data,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'ConsistencyLevel': 'eventual' // For advanced queries
          },
          timeout: config.timeouts.requestTimeoutMs
        });

        return response;
      } catch (error: any) {
        lastError = error;
        const classified = this.classifyError(error);
        
        // Don't retry non-retryable errors
        if (!classified.retryable || attempt === config.retryConfig.maxAttempts) {
          break;
        }

        // Calculate delay for exponential backoff
        const delay = config.retryConfig.backoffStrategy === 'exponential'
          ? Math.min(config.retryConfig.baseDelayMs * Math.pow(2, attempt - 1), config.retryConfig.maxDelayMs)
          : config.retryConfig.baseDelayMs;

        this.logInfo(`Retrying request (attempt ${attempt + 1}/${config.retryConfig.maxAttempts}) after ${delay}ms`, {
          tenantId,
          runId,
          url,
          method,
          error: classified.message
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Classify errors into categories for proper handling
   */
  private classifyError(error: any): M365Error {
    try {
      // Handle Axios errors
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        const errorCode = data?.error?.code || data?.code || 'UNKNOWN_ERROR';
        
        switch (status) {
          case 401:
            return this.createError(
              errorCode,
              data?.error?.message || 'Authentication failed',
              data,
              false,
              'auth',
              status
            );
          case 403:
            return this.createError(
              errorCode,
              data?.error?.message || 'Insufficient permissions',
              data,
              false,
              'permission',
              status
            );
          case 404:
            return this.createError(
              errorCode,
              data?.error?.message || 'Resource not found',
              data,
              false,
              'not_found',
              status
            );
          case 429:
            return this.createError(
              errorCode,
              data?.error?.message || 'Rate limit exceeded',
              data,
              true,
              'rate_limit',
              status
            );
          case 400:
            return this.createError(
              errorCode,
              data?.error?.message || 'Bad request',
              data,
              false,
              'validation',
              status
            );
          case 500:
          case 502:
          case 503:
          case 504:
            return this.createError(
              errorCode,
              data?.error?.message || 'Server error',
              data,
              true,
              'internal',
              status
            );
          default:
            return this.createError(
              errorCode,
              data?.error?.message || error.message || 'Unknown HTTP error',
              data,
              status >= 500,
              'internal',
              status
            );
        }
      }

      // Handle network errors
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return this.createError(
          'TIMEOUT',
          'Request timeout',
          error,
          true,
          'network'
        );
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return this.createError(
          'NETWORK_ERROR',
          'Network connection failed',
          error,
          true,
          'network'
        );
      }

      // Handle validation errors
      if (error.name === 'ZodError') {
        return this.createError(
          'VALIDATION_ERROR',
          'Response validation failed',
          error.errors,
          false,
          'validation'
        );
      }

      // Default error
      return this.createError(
        'UNKNOWN_ERROR',
        error.message || 'Unknown error occurred',
        error,
        false,
        'internal'
      );
    } catch (classificationError) {
      this.logError('Failed to classify error', classificationError, { originalError: error });
      return this.createError(
        'CLASSIFICATION_ERROR',
        error.message || 'Unknown error occurred',
        error,
        false,
        'internal'
      );
    }
  }

  /**
   * Get configuration for tenant
   */
  private async getConfig(tenantId: string): Promise<M365Config> {
    // This would typically fetch from a configuration service
    // For now, return a default configuration
    return {
      tenantId,
      clientId: process.env.M365_CLIENT_ID || '',
      clientSecret: process.env.M365_CLIENT_SECRET || '',
      redirectUri: process.env.M365_REDIRECT_URI || 'http://localhost:3000/auth/m365/callback',
      scopes: ['User.Read.All', 'User.ReadWrite.All', 'Directory.Read.All'],
      rateLimits: {
        requestsPerSecond: 10,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        burstLimit: 20
      },
      retryConfig: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 30000
      },
      timeouts: {
        connectionTimeoutMs: 10000,
        requestTimeoutMs: 30000
      },
      features: {
        enableAuditLogging: true,
        enableMetering: true,
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

  /**
   * Extract credentials from config
   */
  private getCredentialsFromConfig(config: M365Config): M365Credentials {
    return {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      tenantId: config.tenantId,
      redirectUri: config.redirectUri,
      scopes: config.scopes
    };
  }

  /**
   * Log operation for audit trail
   */
  private async logOperation(event: Partial<M365AuditEvent>): Promise<void> {
    try {
      const auditEvent: M365AuditEvent = {
        eventId: `m365-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tenantId: event.tenantId!,
        operation: event.operation!,
        parameters: event.parameters || {},
        ...(event.runId && { runId: event.runId }),
        result: event.result!,
        ...(event.error && { error: event.error }),
        timestamp: new Date().toISOString(),
        executionTimeMs: event.executionTimeMs || 0
      };

      // Log the audit event (implementation would depend on your audit system)
      this.logInfo('M365 operation completed', auditEvent);
    } catch (error) {
      this.logError('Failed to log operation', error);
    }
  }

  /**
   * Record metering data for billing
   */
  private async meterOperation(
    tenantId: string,
    operation: string,
    runId: string | undefined,
    executionTimeMs: number,
    resourceCount: number
  ): Promise<void> {
    try {
      const meteringEvent = {
        eventType: 'task_completed' as const,
        tenantId,
        ...(runId && { runId }),
        resourcesUsed: {
          apiCalls: 1,
          dataTransferBytes: resourceCount * 1024, // Estimate
          executionTimeMs
        },
        metadata: {
          operation,
          resourceCount
        },
        timestamp: new Date().toISOString()
      };

      // Metering would be implemented here when MeteringClient is available
      this.logInfo('M365 operation metered', meteringEvent);
    } catch (error) {
      this.logError('Failed to record metering data', error, { tenantId, operation });
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
    category: M365Error['category'] = 'internal',
    httpStatus?: number
  ): M365Error {
    const error: M365Error = {
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
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private logInfo(message: string, context?: any): void {
    console.log(JSON.stringify({
      level: 'INFO',
      service: 'M365Client',
      message,
      ...context,
      timestamp: new Date().toISOString()
    }));
  }

  private logError(message: string, error: any, context?: any): void {
    console.error(JSON.stringify({
      level: 'ERROR',
      service: 'M365Client',
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