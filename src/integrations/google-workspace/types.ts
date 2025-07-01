/**
 * Google Workspace Integration Types
 * Enterprise-grade type definitions for Google Workspace API integration
 */

// OAuth2 & Authentication Types
export interface GoogleWorkspaceCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface GoogleWorkspaceTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
  tokenType: string;
  scope: string;
}

export interface GoogleWorkspaceAuth {
  tenantId: string;
  credentials: GoogleWorkspaceCredentials;
  tokens?: GoogleWorkspaceTokens;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsed?: string;
}

// API Request/Response Types
export interface GoogleWorkspaceUser {
  id: string;
  primaryEmail: string;
  name: {
    givenName: string;
    familyName: string;
    fullName: string;
  };
  suspended: boolean;
  orgUnitPath: string;
  isAdmin: boolean;
  isDelegatedAdmin: boolean;
  lastLoginTime?: string;
  creationTime: string;
  customerId: string;
  aliases?: string[];
  phones?: Array<{
    value: string;
    type: string;
    primary?: boolean;
  }>;
  organizations?: Array<{
    name: string;
    title: string;
    department: string;
    primary?: boolean;
  }>;
}

export interface CreateUserRequest {
  primaryEmail: string;
  name: {
    givenName: string;
    familyName: string;
  };
  password: string;
  orgUnitPath?: string;
  suspended?: boolean;
  changePasswordAtNextLogin?: boolean;
  includeInGlobalAddressList?: boolean;
}

export interface UpdateUserRequest {
  userId: string;
  suspended?: boolean;
  orgUnitPath?: string;
  name?: {
    givenName?: string;
    familyName?: string;
  };
  password?: string;
  changePasswordAtNextLogin?: boolean;
}

export interface ListUsersRequest {
  customer?: string;
  domain?: string;
  maxResults?: number;
  pageToken?: string;
  query?: string;
  orderBy?: 'email' | 'familyName' | 'givenName';
  sortOrder?: 'ASCENDING' | 'DESCENDING';
  showDeleted?: boolean;
}

export interface ListUsersResponse {
  users: GoogleWorkspaceUser[];
  nextPageToken?: string;
  totalResults?: number;
}

// Integration Configuration
export interface GoogleWorkspaceConfig {
  tenantId: string;
  domain: string;
  adminEmail: string;
  rateLimits: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
    burstLimit: number;
  };
  retryConfig: {
    maxAttempts: number;
    backoffStrategy: 'exponential' | 'linear' | 'fixed';
    baseDelayMs: number;
    maxDelayMs: number;
  };
  timeouts: {
    connectionTimeoutMs: number;
    requestTimeoutMs: number;
  };
  features: {
    enableAuditLogging: boolean;
    enableMetering: boolean;
    enableCaching: boolean;
    cacheTtlSeconds: number;
  };
  failover: {
    enableFailover: boolean;
    fallbackBehavior: 'queue' | 'reject' | 'cache';
    maxQueueSize: number;
  };
}

// Operation Types
export type GoogleWorkspaceOperation = 
  | 'list_users'
  | 'get_user'
  | 'create_user'
  | 'update_user'
  | 'suspend_user'
  | 'unsuspend_user'
  | 'delete_user'
  | 'reset_password'
  | 'list_groups'
  | 'create_group'
  | 'add_member'
  | 'remove_member';

export interface GoogleWorkspaceOperationRequest {
  operation: GoogleWorkspaceOperation;
  tenantId: string;
  runId?: string;
  parameters: Record<string, any>;
  options?: {
    timeout?: number;
    retries?: number;
    priority?: 'low' | 'normal' | 'high';
  };
}

export interface GoogleWorkspaceOperationResponse<T = any> {
  success: boolean;
  data?: T;
  error?: GoogleWorkspaceError;
  metadata: {
    operation: GoogleWorkspaceOperation;
    tenantId: string;
    runId?: string;
    executionTimeMs: number;
    rateLimitRemaining?: number;
    quotaUsed?: number;
    timestamp: string;
  };
}

// Error Classifications
export interface GoogleWorkspaceError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  category: 'auth' | 'rate_limit' | 'quota' | 'validation' | 'network' | 'internal' | 'not_found' | 'permission';
  httpStatus?: number;
  googleErrorCode?: string;
  retryAfterSeconds?: number;
}

// Audit & Metering Types
export interface GoogleWorkspaceAuditEvent {
  eventId: string;
  tenantId: string;
  runId?: string;
  operation: GoogleWorkspaceOperation;
  userId?: string;
  targetResource?: string;
  parameters: Record<string, any>;
  result: 'success' | 'failure' | 'partial';
  error?: GoogleWorkspaceError;
  executionTimeMs: number;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface GoogleWorkspaceMeteringEvent {
  eventType: 'integration_call';
  tenantId: string;
  workflowId?: string;
  runId?: string;
  integration: 'google_workspace';
  operation: GoogleWorkspaceOperation;
  success: boolean;
  executionTimeMs: number;
  dataTransferBytes: number;
  quotaUnits: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Rate Limiting Types
export interface RateLimitState {
  tenantId: string;
  windowStart: number;
  requestCount: number;
  burstTokens: number;
  lastRequest: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetTime: number;
  retryAfterMs?: number;
}

// Cache Types
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt: number;
  tenantId: string;
  operation: GoogleWorkspaceOperation;
}

// Health Check Types
export interface GoogleWorkspaceHealthStatus {
  status: 'healthy' | 'unhealthy';
  tenantId: string;
  lastSuccessfulCall?: string;
  consecutiveFailures: number;
  avgResponseTimeMs: number;
  quotaUsagePercent: number;
  rateLimitStatus: 'ok' | 'throttled' | 'unknown';
  errors: GoogleWorkspaceError[];
  timestamp: string;
} 