/**
 * Google Workspace Integration Module
 * 
 * Enterprise-grade Google Workspace Admin SDK integration with:
 * - Multi-tenant OAuth2 authentication
 * - Comprehensive rate limiting and quota management
 * - Full error handling and classification
 * - Automatic retries with exponential backoff
 * - Complete audit logging and metering
 * - Type-safe operations with Zod validation
 * - Configurable timeouts and failover logic
 */

// Main service exports
export { GoogleWorkspaceService } from './service';
export { GoogleWorkspaceClient } from './client';
export { GoogleWorkspaceAuthManager } from './auth-manager';
export { GoogleWorkspaceRateLimiter } from './rate-limiter';

// Type exports
export * from './types';

// Re-export commonly used types for convenience
export type {
  GoogleWorkspaceConfig,
  GoogleWorkspaceCredentials,
  GoogleWorkspaceUser,
  GoogleWorkspaceOperationResponse,
  GoogleWorkspaceError,
  CreateUserRequest,
  UpdateUserRequest,
  ListUsersRequest,
  ListUsersResponse,
  GoogleWorkspaceHealthStatus
} from './types';

// Create singleton instance for easy access
let _googleWorkspaceService: GoogleWorkspaceService | null = null;

/**
 * Get singleton instance of Google Workspace service
 */
export function getGoogleWorkspaceService(): GoogleWorkspaceService {
  if (!_googleWorkspaceService) {
    _googleWorkspaceService = new GoogleWorkspaceService();
  }
  return _googleWorkspaceService;
}

/**
 * Create new Google Workspace service instance
 */
export function createGoogleWorkspaceService(): GoogleWorkspaceService {
  return new GoogleWorkspaceService();
} 