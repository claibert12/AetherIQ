/**
 * Microsoft 365 Integration Module
 * 
 * Enterprise-grade Microsoft 365 user management integration with:
 * - Multi-tenant OAuth2 authentication
 * - Type-safe CRUD operations
 * - Rate limiting and retry logic
 * - Audit logging and metering
 * - Batch operations and health monitoring
 */

// Core service and client exports
export { M365Service } from './service';
export { M365Client } from './client';
export { M365AuthManager } from './auth-manager';
export { M365RateLimiter } from './rate-limiter';

// Type exports for external consumption
export type {
  // Configuration types
  M365Config,
  M365Credentials,
  M365Tokens,
  M365Auth,
  
  // User types
  M365User,
  CreateUserRequest,
  UpdateUserRequest,
  ListUsersRequest,
  ListUsersResponse,
  
  // Operation types
  M365OperationRequest,
  M365OperationResponse,
  BatchUserOperation,
  BatchOperationResult,
  
  // Error and status types
  M365Error,
  M365HealthStatus,
  RateLimitResult,
  RateLimitState,
  
  // Audit and metering types
  M365AuditEvent
} from './types';

// Constants for external use
export { M365_ENDPOINTS, M365_ERROR_CODES } from './types'; 