import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import axios from 'axios';
import { 
  GoogleWorkspaceAuth, 
  GoogleWorkspaceCredentials, 
  GoogleWorkspaceTokens,
  GoogleWorkspaceError 
} from './types';

/**
 * Google Workspace OAuth2 Authentication Manager
 * 
 * Handles:
 * - OAuth2 authorization flow
 * - Multi-tenant credential storage
 * - Automatic token refresh
 * - Secure token storage in DynamoDB
 * - Token validation and expiry handling
 */
export class GoogleWorkspaceAuthManager {
  private docClient: DynamoDBDocumentClient;
  private authTable: string;
  private readonly GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private readonly GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

  constructor() {
    const client = new DynamoDBClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.authTable = process.env.GOOGLE_WORKSPACE_AUTH_TABLE || 'google_workspace_auth';
  }

  /**
   * Generate OAuth2 authorization URL for tenant setup
   */
  generateAuthUrl(
    tenantId: string, 
    credentials: GoogleWorkspaceCredentials,
    state?: string
  ): string {
    const params = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: credentials.redirectUri,
      response_type: 'code',
      scope: credentials.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: state || tenantId,
      include_granted_scopes: 'true'
    });

    return `${this.GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    tenantId: string,
    authorizationCode: string,
    credentials: GoogleWorkspaceCredentials
  ): Promise<GoogleWorkspaceTokens> {
    try {
      const response = await axios.post(this.GOOGLE_TOKEN_URL, {
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code: authorizationCode,
        grant_type: 'authorization_code',
        redirect_uri: credentials.redirectUri
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      const tokens: GoogleWorkspaceTokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: Date.now() + (response.data.expires_in * 1000),
        tokenType: response.data.token_type || 'Bearer',
        scope: response.data.scope || credentials.scopes.join(' ')
      };

      // Store auth configuration
      await this.storeAuth(tenantId, credentials, tokens);

      this.logInfo('OAuth2 tokens exchanged successfully', { 
        tenantId, 
        expiresAt: new Date(tokens.expiresAt).toISOString() 
      });

      return tokens;

    } catch (error: any) {
      const authError = this.createAuthError(
        'TOKEN_EXCHANGE_FAILED',
        `Failed to exchange authorization code: ${error.message}`,
        { tenantId, error: error.response?.data },
        false,
        error.response?.status
      );

      this.logError('Token exchange failed', authError, { tenantId });
      throw authError;
    }
  }

  /**
   * Get valid access token for tenant (with automatic refresh)
   */
  async getValidToken(tenantId: string): Promise<string> {
    const auth = await this.getAuth(tenantId);
    if (!auth || !auth.tokens) {
      throw this.createAuthError(
        'NO_AUTH_CONFIGURED',
        `No authentication configured for tenant: ${tenantId}`,
        { tenantId },
        false
      );
    }

    if (!auth.isActive) {
      throw this.createAuthError(
        'AUTH_DISABLED',
        `Authentication disabled for tenant: ${tenantId}`,
        { tenantId },
        false
      );
    }

    // Check if token needs refresh (refresh 5 minutes before expiry)
    const refreshThreshold = Date.now() + (5 * 60 * 1000);
    if (auth.tokens.expiresAt < refreshThreshold) {
      this.logInfo('Token needs refresh', { 
        tenantId, 
        expiresAt: new Date(auth.tokens.expiresAt).toISOString() 
      });

      const newTokens = await this.refreshTokens(tenantId, auth);
      return newTokens.accessToken;
    }

    // Update last used timestamp
    await this.updateLastUsed(tenantId);

    return auth.tokens.accessToken;
  }

  /**
   * Refresh access tokens using refresh token
   */
  async refreshTokens(tenantId: string, auth: GoogleWorkspaceAuth): Promise<GoogleWorkspaceTokens> {
    if (!auth.tokens?.refreshToken) {
      throw this.createAuthError(
        'NO_REFRESH_TOKEN',
        `No refresh token available for tenant: ${tenantId}`,
        { tenantId },
        false
      );
    }

    try {
      const response = await axios.post(this.GOOGLE_TOKEN_URL, {
        client_id: auth.credentials.clientId,
        client_secret: auth.credentials.clientSecret,
        refresh_token: auth.tokens.refreshToken,
        grant_type: 'refresh_token'
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      const newTokens: GoogleWorkspaceTokens = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || auth.tokens.refreshToken, // Keep existing if not provided
        expiresAt: Date.now() + (response.data.expires_in * 1000),
        tokenType: response.data.token_type || 'Bearer',
        scope: response.data.scope || auth.tokens.scope
      };

      // Update stored tokens
      await this.updateTokens(tenantId, newTokens);

      this.logInfo('Tokens refreshed successfully', { 
        tenantId, 
        expiresAt: new Date(newTokens.expiresAt).toISOString() 
      });

      return newTokens;

    } catch (error: any) {
      // If refresh fails, mark auth as inactive
      await this.deactivateAuth(tenantId);

      const authError = this.createAuthError(
        'TOKEN_REFRESH_FAILED',
        `Failed to refresh tokens: ${error.message}`,
        { tenantId, error: error.response?.data },
        false,
        error.response?.status
      );

      this.logError('Token refresh failed', authError, { tenantId });
      throw authError;
    }
  }

  /**
   * Store authentication configuration and tokens
   */
  async storeAuth(
    tenantId: string, 
    credentials: GoogleWorkspaceCredentials, 
    tokens: GoogleWorkspaceTokens
  ): Promise<void> {
    const now = new Date().toISOString();

    // Store auth configuration with tokens
    const authRecord: GoogleWorkspaceAuth = {
      tenantId,
      credentials,
      tokens,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    try {
      await this.docClient.send(new PutCommand({
        TableName: this.authTable,
        Item: authRecord
      }));

      this.logInfo('Auth configuration stored', { tenantId });
    } catch (error: any) {
      throw this.createAuthError(
        'STORAGE_ERROR',
        `Failed to store auth configuration: ${error.message}`,
        { tenantId },
        true
      );
    }
  }

  /**
   * Get authentication configuration for tenant
   */
  async getAuth(tenantId: string): Promise<GoogleWorkspaceAuth | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.authTable,
        Key: { tenantId }
      }));

      return result.Item ? (result.Item as GoogleWorkspaceAuth) : null;
    } catch (error: any) {
      throw this.createAuthError(
        'RETRIEVAL_ERROR',
        `Failed to retrieve auth configuration: ${error.message}`,
        { tenantId },
        true
      );
    }
  }

  /**
   * Update stored tokens
   */
  private async updateTokens(tenantId: string, tokens: GoogleWorkspaceTokens): Promise<void> {
    try {
      await this.docClient.send(new UpdateCommand({
        TableName: this.authTable,
        Key: { tenantId },
        UpdateExpression: 'SET tokens = :tokens, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':tokens': tokens,
          ':updatedAt': new Date().toISOString()
        },
        ConditionExpression: 'attribute_exists(tenantId)'
      }));
    } catch (error: any) {
      throw this.createAuthError(
        'TOKEN_UPDATE_ERROR',
        `Failed to update tokens: ${error.message}`,
        { tenantId },
        true
      );
    }
  }

  /**
   * Update last used timestamp
   */
  private async updateLastUsed(tenantId: string): Promise<void> {
    try {
      await this.docClient.send(new UpdateCommand({
        TableName: this.authTable,
        Key: { tenantId },
        UpdateExpression: 'SET lastUsed = :lastUsed',
        ExpressionAttributeValues: {
          ':lastUsed': new Date().toISOString()
        },
        ConditionExpression: 'attribute_exists(tenantId)'
      }));
    } catch (error: any) {
      // Non-critical error, just log it
      this.logError('Failed to update last used timestamp', error, { tenantId });
    }
  }

  /**
   * Deactivate authentication (on refresh failure)
   */
  async deactivateAuth(tenantId: string): Promise<void> {
    try {
      await this.docClient.send(new UpdateCommand({
        TableName: this.authTable,
        Key: { tenantId },
        UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':isActive': false,
          ':updatedAt': new Date().toISOString()
        },
        ConditionExpression: 'attribute_exists(tenantId)'
      }));

      this.logInfo('Auth deactivated due to token refresh failure', { tenantId });
    } catch (error: any) {
      this.logError('Failed to deactivate auth', error, { tenantId });
    }
  }

  /**
   * Revoke authentication and remove stored data
   */
  async revokeAuth(tenantId: string): Promise<void> {
    const auth = await this.getAuth(tenantId);
    if (!auth?.tokens?.accessToken) {
      return; // Nothing to revoke
    }

    try {
      // Revoke tokens with Google
      await axios.post('https://oauth2.googleapis.com/revoke', null, {
        params: {
          token: auth.tokens.accessToken
        },
        timeout: 10000
      });

      this.logInfo('Google tokens revoked successfully', { tenantId });
    } catch (error: any) {
      this.logError('Failed to revoke Google tokens', error, { tenantId });
      // Continue with local cleanup even if Google revocation fails
    }

    try {
      // Remove from DynamoDB
      await this.docClient.send(new DeleteCommand({
        TableName: this.authTable,
        Key: { tenantId }
      }));

      this.logInfo('Auth configuration removed', { tenantId });
    } catch (error: any) {
      throw this.createAuthError(
        'REVOCATION_ERROR',
        `Failed to remove auth configuration: ${error.message}`,
        { tenantId },
        true
      );
    }
  }

  /**
   * Validate current authentication status
   */
  async validateAuth(tenantId: string): Promise<boolean> {
    try {
      const token = await this.getValidToken(tenantId);
      
      // Test token with a simple API call
      await axios.get('https://www.googleapis.com/admin/directory/v1/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          domain: 'example.com', // This will fail but validates token format
          maxResults: 1
        },
        timeout: 10000
      });

      return true;
    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 401) {
        // Auth issue
        return false;
      }
      if (error.response?.status === 400) {
        // Bad request (expected for domain validation), but token is valid
        return true;
      }
      
      // Other errors might be network issues
      this.logError('Auth validation error', error, { tenantId });
      return false;
    }
  }

  /**
   * Create standardized auth error
   */
  private createAuthError(
    code: string,
    message: string,
    details: any = {},
    retryable: boolean = false,
    httpStatus?: number
  ): GoogleWorkspaceError {
    return {
      code,
      message,
      details,
      retryable,
      category: 'auth',
      httpStatus,
      timestamp: new Date().toISOString()
    } as GoogleWorkspaceError;
  }

  private logInfo(message: string, context?: any): void {
    console.log(JSON.stringify({
      level: 'INFO',
      service: 'GoogleWorkspaceAuthManager',
      message,
      ...context,
      timestamp: new Date().toISOString()
    }));
  }

  private logError(message: string, error: any, context?: any): void {
    console.error(JSON.stringify({
      level: 'ERROR',
      service: 'GoogleWorkspaceAuthManager',
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