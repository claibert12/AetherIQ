import { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import axios, { AxiosResponse } from 'axios';
import { 
  M365Credentials, 
  M365Tokens, 
  M365Auth, 
  M365Error,
  M365_ENDPOINTS 
} from './types';

/**
 * Microsoft 365 Authentication Manager
 * 
 * Handles OAuth2 authentication flow for Microsoft 365 integration.
 * Provides multi-tenant support with secure token storage and automatic refresh.
 */
export class M365AuthManager {
  private dynamoClient: DynamoDBClient;
  private tableName: string;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.tableName = process.env.M365_AUTH_TABLE || 'aetheriq-m365-auth';
  }

  /**
   * Generate OAuth2 authorization URL for tenant
   */
  generateAuthUrl(tenantId: string, credentials: M365Credentials): string {
    const params = new URLSearchParams({
      client_id: credentials.clientId,
      response_type: 'code',
      redirect_uri: credentials.redirectUri,
      scope: credentials.scopes.join(' '),
      state: tenantId,
      response_mode: 'query',
      prompt: 'consent'
    });

    const authUrl = `${M365_ENDPOINTS.AUTH_BASE}/${credentials.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
    
    this.logInfo('Generated OAuth2 authorization URL', { 
      tenantId, 
      clientId: credentials.clientId,
      scopes: credentials.scopes 
    });
    
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    tenantId: string, 
    authorizationCode: string, 
    credentials: M365Credentials
  ): Promise<M365Tokens> {
    try {
      const tokenEndpoint = `${M365_ENDPOINTS.AUTH_BASE}/${credentials.tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code: authorizationCode,
        redirect_uri: credentials.redirectUri,
        grant_type: 'authorization_code',
        scope: credentials.scopes.join(' ')
      });

      const response: AxiosResponse = await axios.post(tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      const tokenData = response.data;
      const tokens: M365Tokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
        tokenType: tokenData.token_type || 'Bearer',
        scope: tokenData.scope
      };

      // Store tokens securely
      await this.storeAuth(tenantId, tokens);

      this.logInfo('Successfully exchanged authorization code for tokens', { 
        tenantId,
        expiresAt: new Date(tokens.expiresAt).toISOString(),
        scopes: tokens.scope
      });

      return tokens;
    } catch (error: any) {
      const authError = this.createAuthError(
        'TOKEN_EXCHANGE_FAILED',
        `Failed to exchange authorization code: ${error.response?.data?.error_description || error.message}`,
        error.response?.data || error,
        false
      );
      
      this.logError('Token exchange failed', authError, { tenantId });
      throw authError;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(tenantId: string, refreshToken: string, credentials: M365Credentials): Promise<M365Tokens> {
    try {
      const tokenEndpoint = `${M365_ENDPOINTS.AUTH_BASE}/${credentials.tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: credentials.scopes.join(' ')
      });

      const response: AxiosResponse = await axios.post(tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      const tokenData = response.data;
      const tokens: M365Tokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken, // Some responses don't include new refresh token
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
        tokenType: tokenData.token_type || 'Bearer',
        scope: tokenData.scope
      };

      // Update stored tokens
      await this.storeAuth(tenantId, tokens);

      this.logInfo('Successfully refreshed access tokens', { 
        tenantId,
        expiresAt: new Date(tokens.expiresAt).toISOString()
      });

      return tokens;
    } catch (error: any) {
      const authError = this.createAuthError(
        'TOKEN_REFRESH_FAILED',
        `Failed to refresh tokens: ${error.response?.data?.error_description || error.message}`,
        error.response?.data || error,
        false
      );
      
      this.logError('Token refresh failed', authError, { tenantId });
      throw authError;
    }
  }

  /**
   * Get valid access token (refresh if necessary)
   */
  async getValidTokens(tenantId: string, credentials: M365Credentials): Promise<M365Tokens> {
    try {
      const auth = await this.getStoredAuth(tenantId);
      
      if (!auth || !auth.tokens) {
        throw this.createAuthError(
          'NO_AUTH_FOUND',
          `No authentication found for tenant: ${tenantId}`,
          { tenantId },
          false
        );
      }

      // Check if token is expired (with 5 minute buffer)
      const bufferMs = 5 * 60 * 1000; // 5 minutes
      const isExpired = Date.now() >= (auth.tokens.expiresAt - bufferMs);

      if (isExpired) {
        this.logInfo('Access token expired, refreshing', { 
          tenantId,
          expiresAt: new Date(auth.tokens.expiresAt).toISOString()
        });
        
        return await this.refreshTokens(tenantId, auth.tokens.refreshToken, credentials);
      }

      return auth.tokens;
    } catch (error: any) {
      if (error.code === 'NO_AUTH_FOUND') {
        throw error;
      }
      
      const authError = this.createAuthError(
        'TOKEN_VALIDATION_FAILED',
        `Failed to get valid tokens: ${error.message}`,
        error,
        true
      );
      
      this.logError('Token validation failed', authError, { tenantId });
      throw authError;
    }
  }

  /**
   * Validate authentication for tenant
   */
  async validateAuth(tenantId: string): Promise<boolean> {
    try {
      const auth = await this.getStoredAuth(tenantId);
      
      if (!auth || !auth.tokens || !auth.isValid) {
        return false;
      }

      // Check if tokens are not expired
      const isValid = Date.now() < auth.tokens.expiresAt;
      
      if (!isValid) {
        // Mark as invalid in storage
        await this.markAuthInvalid(tenantId);
      }

      return isValid;
    } catch (error: any) {
      this.logError('Auth validation error', error, { tenantId });
      return false;
    }
  }

  /**
   * Revoke authentication and cleanup
   */
  async revokeAuth(tenantId: string): Promise<void> {
    try {
      const auth = await this.getStoredAuth(tenantId);
      
      if (auth && auth.tokens) {
        // Attempt to revoke tokens with Microsoft
        try {
          const revokeEndpoint = `${M365_ENDPOINTS.AUTH_BASE}/common/oauth2/v2.0/logout`;
          await axios.post(revokeEndpoint, {
            token: auth.tokens.accessToken
          }, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000
          });
        } catch (revokeError) {
          // Log but don't fail - cleanup local storage regardless
          this.logError('Failed to revoke M365 tokens', revokeError, { tenantId });
        }
      }

      // Remove from DynamoDB
      await this.deleteStoredAuth(tenantId);

      this.logInfo('Successfully revoked authentication', { tenantId });
    } catch (error: any) {
      const authError = this.createAuthError(
        'REVOKE_FAILED',
        `Failed to revoke authentication: ${error.message}`,
        error,
        false
      );
      
      this.logError('Failed to revoke M365 tokens', authError, { tenantId });
      throw authError;
    }
  }

  /**
   * Store authentication data in DynamoDB
   */
  private async storeAuth(tenantId: string, tokens: M365Tokens): Promise<void> {
    const auth: M365Auth = {
      tenantId,
      tokens,
      lastRefreshed: new Date().toISOString(),
      isValid: true
    };

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall({
        ...auth,
        ttl: Math.floor((tokens.expiresAt + (24 * 60 * 60 * 1000)) / 1000) // TTL 24h after token expires
      })
    });

    await this.dynamoClient.send(command);
  }

  /**
   * Get stored authentication data from DynamoDB
   */
  private async getStoredAuth(tenantId: string): Promise<M365Auth | null> {
    try {
      const command = new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ tenantId })
      });

      const result = await this.dynamoClient.send(command);
      
      if (!result.Item) {
        return null;
      }

      const auth = unmarshall(result.Item) as M365Auth;
      return auth;
    } catch (error: any) {
      this.logError('Failed to get stored auth', error, { tenantId });
      return null;
    }
  }

  /**
   * Delete stored authentication data
   */
  private async deleteStoredAuth(tenantId: string): Promise<void> {
    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({ tenantId })
    });

    await this.dynamoClient.send(command);
  }

  /**
   * Mark authentication as invalid
   */
  private async markAuthInvalid(tenantId: string): Promise<void> {
    const auth = await this.getStoredAuth(tenantId);
    if (auth) {
      auth.isValid = false;
      await this.storeAuth(tenantId, auth.tokens);
    }
  }

  /**
   * Create standardized authentication error
   */
  private createAuthError(
    code: string,
    message: string,
    details: any = {},
    retryable: boolean = false
  ): M365Error {
    return {
      code,
      message,
      details,
      retryable,
      category: 'auth'
    };
  }

  private logInfo(message: string, context?: any): void {
    console.log(JSON.stringify({
      level: 'INFO',
      service: 'M365AuthManager',
      message,
      ...context,
      timestamp: new Date().toISOString()
    }));
  }

  private logError(message: string, error: any, context?: any): void {
    console.error(JSON.stringify({
      level: 'ERROR',
      service: 'M365AuthManager',
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