/**
 * Microsoft 365 Integration Types
 * 
 * Complete type definitions for Microsoft 365 user management integration.
 * Includes OAuth2 authentication, user management, error handling, rate limiting,
 * and enterprise features like audit logging and metering.
 */

// ============================================================================
// Authentication & OAuth2 Types
// ============================================================================

export interface M365Credentials {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
}

export interface M365Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  scope: string;
}

export interface M365Auth {
  tenantId: string;
  tokens: M365Tokens;
  lastRefreshed: string;
  isValid: boolean;
}

// ============================================================================
// Microsoft 365 User Types
// ============================================================================

export interface M365UserName {
  givenName: string;
  surname: string;
  displayName: string;
}

export interface M365User {
  id: string;
  userPrincipalName: string;
  displayName: string;
  givenName: string;
  surname: string;
  mail?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones: string[];
  accountEnabled: boolean;
  usageLocation?: string;
  preferredLanguage?: string;
  createdDateTime: string;
  lastSignInDateTime?: string;
  assignedLicenses: Array<{
    skuId?: string;
    disabledPlans?: string[];
  }>;
  assignedPlans: Array<{
    assignedDateTime?: string;
    capabilityStatus?: string;
    service?: string;
    servicePlanId?: string;
  }>;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateUserRequest {
  userPrincipalName: string;
  displayName: string;
  givenName: string;
  surname: string;
  mailNickname: string;
  passwordProfile: {
    password: string;
    forceChangePasswordNextSignIn: boolean;
  };
  accountEnabled: boolean;
  usageLocation?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones?: string[];
}

export interface UpdateUserRequest {
  id: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones?: string[];
  accountEnabled?: boolean;
  usageLocation?: string;
  passwordProfile?: {
    password: string;
    forceChangePasswordNextSignIn: boolean;
  };
}

export interface ListUsersRequest {
  filter?: string;
  search?: string;
  orderBy?: string;
  select?: string[];
  top?: number;
  skip?: number;
}

export interface ListUsersResponse {
  users: M365User[];
  nextLink?: string;
  totalCount?: number;
}

// ============================================================================
// Error Handling Types
// ============================================================================

export interface M365Error {
  code: string;
  message: string;
  details: any;
  retryable: boolean;
  category: 'auth' | 'rate_limit' | 'quota' | 'validation' | 'network' | 'internal' | 'not_found' | 'permission';
  httpStatus?: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface M365Config {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  rateLimits: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
    burstLimit: number;
  };
  retryConfig: {
    maxAttempts: number;
    backoffStrategy: 'linear' | 'exponential';
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
    fallbackBehavior: 'queue' | 'reject';
    maxQueueSize: number;
  };
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitState {
  tenantId: string;
  requestCount: number;
  windowStart: number;
  lastRequest: number;
  burstTokens: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetTime: number;
  retryAfterMs?: number;
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface M365HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  tenantId: string;
  lastSuccessfulCall?: string;
  consecutiveFailures: number;
  avgResponseTimeMs: number;
  quotaUsagePercent: number;
  rateLimitStatus: 'ok' | 'throttled' | 'exceeded';
  errors: M365Error[];
  timestamp: string;
}

// ============================================================================
// Operation Types
// ============================================================================

export interface M365OperationRequest {
  operation: 'list_users' | 'get_user' | 'create_user' | 'update_user' | 'delete_user' | 'disable_user' | 'enable_user';
  tenantId: string;
  runId?: string;
  parameters: any;
}

export interface M365OperationResponse<T = any> {
  success: boolean;
  data?: T;
  error?: M365Error;
  metadata: {
    operation: M365OperationRequest['operation'];
    tenantId: string;
    runId?: string;
    executionTimeMs: number;
    timestamp: string;
  };
}

// ============================================================================
// Audit & Metering Types
// ============================================================================

export interface M365AuditEvent {
  eventId: string;
  tenantId: string;
  operation: string;
  parameters: any;
  runId?: string;
  userId?: string;
  result: 'success' | 'failure';
  error?: M365Error;
  timestamp: string;
  executionTimeMs: number;
}

export interface M365MeteringEvent {
  eventType: 'integration_call';
  tenantId: string;
  operation: string;
  runId?: string;
  resourcesUsed: {
    apiCalls: number;
    dataTransferBytes: number;
    executionTimeMs: number;
  };
  timestamp: string;
}

// ============================================================================
// Batch Operations Types
// ============================================================================

export interface BatchUserOperation {
  operation: 'create' | 'update' | 'delete' | 'enable' | 'disable';
  userKey?: string;
  userData?: CreateUserRequest | UpdateUserRequest;
}

export interface BatchOperationResult {
  index: number;
  operation: string;
  success: boolean;
  data?: any;
  error?: M365Error;
}

// ============================================================================
// Utility Types
// ============================================================================

export type M365UserKey = string; // Can be user ID or userPrincipalName
export type M365GraphScope = 
  | 'User.Read.All'
  | 'User.ReadWrite.All'
  | 'Directory.Read.All'
  | 'Directory.ReadWrite.All'
  | 'Group.Read.All'
  | 'Group.ReadWrite.All';

// ============================================================================
// Constants
// ============================================================================

export const M365_ENDPOINTS = {
  GRAPH_BASE: 'https://graph.microsoft.com/v1.0',
  AUTH_BASE: 'https://login.microsoftonline.com',
  USERS: '/users',
  ME: '/me'
} as const;

export const M365_DEFAULT_SCOPES: M365GraphScope[] = [
  'User.Read.All',
  'User.ReadWrite.All',
  'Directory.Read.All'
];

export const M365_ERROR_CODES = {
  // Authentication errors
  INVALID_TOKEN: 'InvalidAuthenticationToken',
  TOKEN_EXPIRED: 'TokenExpired',
  INSUFFICIENT_PERMISSIONS: 'Forbidden',
  
  // Rate limiting
  TOO_MANY_REQUESTS: 'TooManyRequests',
  THROTTLED: 'Request_ThrottledTemporarily',
  
  // User management errors
  USER_NOT_FOUND: 'Request_ResourceNotFound',
  USER_ALREADY_EXISTS: 'Request_BadRequest',
  INVALID_USER_DATA: 'Request_BadRequest',
  
  // Network errors
  SERVICE_UNAVAILABLE: 'ServiceUnavailable',
  TIMEOUT: 'RequestTimeout',
  
  // Internal errors
  INTERNAL_SERVER_ERROR: 'InternalServerError',
  UNKNOWN_ERROR: 'UnknownError'
} as const; 