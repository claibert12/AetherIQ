import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { RateLimitState, RateLimitResult, GoogleWorkspaceConfig } from './types';

/**
 * Google Workspace Rate Limiter
 * 
 * Implements multi-tenant rate limiting with:
 * - Per-tenant configurable limits
 * - Token bucket algorithm with burst capacity
 * - Sliding window rate limiting
 * - Persistent state in DynamoDB
 * - Automatic cleanup of expired entries
 */
export class GoogleWorkspaceRateLimiter {
  private docClient: DynamoDBDocumentClient;
  private rateLimitTable: string;

  constructor() {
    const client = new DynamoDBClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    this.docClient = DynamoDBDocumentClient.from(client);
    this.rateLimitTable = process.env.GOOGLE_WORKSPACE_RATE_LIMIT_TABLE || 'google_workspace_rate_limits';
  }

  /**
   * Check if request is allowed and update rate limit state
   */
  async checkRateLimit(
    tenantId: string, 
    config: GoogleWorkspaceConfig
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowSizeMs = 60 * 1000; // 1 minute sliding window
    
    try {
      // Get current rate limit state
      const state = await this.getRateLimitState(tenantId);
      
      // Calculate current window
      const windowStart = Math.floor(now / windowSizeMs) * windowSizeMs;
      
      // Reset window if needed
      let currentState = state;
      if (!currentState || currentState.windowStart !== windowStart) {
        currentState = {
          tenantId,
          windowStart,
          requestCount: 0,
          burstTokens: config.rateLimits.burstLimit,
          lastRequest: now
        };
      }

      // Check per-second rate limit
      const timeSinceLastRequest = now - currentState.lastRequest;
      const secondsSinceLastRequest = timeSinceLastRequest / 1000;
      
      // Replenish burst tokens based on time passed
      const tokensToAdd = Math.floor(secondsSinceLastRequest * (config.rateLimits.requestsPerSecond / 60));
      currentState.burstTokens = Math.min(
        config.rateLimits.burstLimit,
        currentState.burstTokens + tokensToAdd
      );

      // Check if request can be allowed
      const canProceed = this.canMakeRequest(currentState, config, now);
      
      if (canProceed.allowed) {
        // Update state for successful request
        currentState.requestCount += 1;
        currentState.burstTokens = Math.max(0, currentState.burstTokens - 1);
        currentState.lastRequest = now;
        
        // Save updated state
        await this.saveRateLimitState(currentState);
      }

      return canProceed;

    } catch (error: any) {
      // On error, allow request but log the issue
      this.logError('Rate limit check failed', error, { tenantId });
      return {
        allowed: true,
        remaining: config.rateLimits.requestsPerMinute,
        limit: config.rateLimits.requestsPerMinute,
        resetTime: Math.floor((now + 60000) / 1000)
      };
    }
  }

  /**
   * Get rate limit state for tenant
   */
  private async getRateLimitState(tenantId: string): Promise<RateLimitState | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.rateLimitTable,
        Key: { tenantId }
      }));

      return result.Item ? (result.Item as RateLimitState) : null;
    } catch (error: any) {
      this.logError('Failed to get rate limit state', error, { tenantId });
      return null;
    }
  }

  /**
   * Save rate limit state for tenant
   */
  private async saveRateLimitState(state: RateLimitState): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + (2 * 60 * 60); // 2 hours TTL

    try {
      await this.docClient.send(new PutCommand({
        TableName: this.rateLimitTable,
        Item: {
          ...state,
          ttl
        }
      }));
    } catch (error: any) {
      this.logError('Failed to save rate limit state', error, { tenantId: state.tenantId });
    }
  }

  /**
   * Determine if request can proceed based on rate limits
   */
  private canMakeRequest(
    state: RateLimitState, 
    config: GoogleWorkspaceConfig, 
    now: number
  ): RateLimitResult {
    const windowSizeMs = 60 * 1000; // 1 minute
    const windowEnd = state.windowStart + windowSizeMs;
    const resetTime = Math.floor(windowEnd / 1000);

    // Check per-minute limit
    if (state.requestCount >= config.rateLimits.requestsPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        limit: config.rateLimits.requestsPerMinute,
        resetTime,
        retryAfterMs: windowEnd - now
      };
    }

    // Check per-second limit (using burst tokens)
    if (state.burstTokens <= 0) {
      const nextTokenTime = state.lastRequest + (1000 / config.rateLimits.requestsPerSecond);
      return {
        allowed: false,
        remaining: 0,
        limit: config.rateLimits.requestsPerMinute,
        resetTime,
        retryAfterMs: Math.max(0, nextTokenTime - now)
      };
    }

    // Request can proceed
    return {
      allowed: true,
      remaining: Math.min(
        config.rateLimits.requestsPerMinute - state.requestCount - 1,
        state.burstTokens - 1
      ),
      limit: config.rateLimits.requestsPerMinute,
      resetTime
    };
  }

  /**
   * Get current rate limit status for tenant
   */
  async getRateLimitStatus(
    tenantId: string, 
    config: GoogleWorkspaceConfig
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const state = await this.getRateLimitState(tenantId);
    
    if (!state) {
      return {
        allowed: true,
        remaining: config.rateLimits.requestsPerMinute,
        limit: config.rateLimits.requestsPerMinute,
        resetTime: Math.floor((now + 60000) / 1000)
      };
    }

    return this.canMakeRequest(state, config, now);
  }

  /**
   * Reset rate limits for tenant (admin function)
   */
  async resetRateLimit(tenantId: string): Promise<void> {
    try {
      await this.docClient.send(new UpdateCommand({
        TableName: this.rateLimitTable,
        Key: { tenantId },
        UpdateExpression: 'REMOVE requestCount, burstTokens SET windowStart = :windowStart, lastRequest = :now',
        ExpressionAttributeValues: {
          ':windowStart': Math.floor(Date.now() / 60000) * 60000,
          ':now': Date.now()
        }
      }));

      this.logInfo('Rate limit reset', { tenantId });
    } catch (error: any) {
      this.logError('Failed to reset rate limit', error, { tenantId });
      throw error;
    }
  }

  /**
   * Get rate limit metrics for monitoring
   */
  async getRateLimitMetrics(tenantId: string): Promise<{
    currentUsage: number;
    burstTokensRemaining: number;
    windowStart: number;
    lastRequest: number;
  } | null> {
    const state = await this.getRateLimitState(tenantId);
    
    if (!state) {
      return null;
    }

    return {
      currentUsage: state.requestCount,
      burstTokensRemaining: state.burstTokens,
      windowStart: state.windowStart,
      lastRequest: state.lastRequest
    };
  }

  /**
   * Calculate optimal retry delay based on rate limits
   */
  calculateRetryDelay(rateLimitResult: RateLimitResult): number {
    if (rateLimitResult.allowed) {
      return 0;
    }

    if (rateLimitResult.retryAfterMs) {
      // Add small jitter to prevent thundering herd
      const jitter = Math.random() * 1000;
      return rateLimitResult.retryAfterMs + jitter;
    }

    // Default retry delay
    return 1000 + (Math.random() * 2000); // 1-3 seconds with jitter
  }

  /**
   * Check if tenant is currently throttled
   */
  async isThrottled(tenantId: string, config: GoogleWorkspaceConfig): Promise<boolean> {
    const status = await this.getRateLimitStatus(tenantId, config);
    return !status.allowed;
  }

  private logInfo(message: string, context?: any): void {
    console.log(JSON.stringify({
      level: 'INFO',
      service: 'GoogleWorkspaceRateLimiter',
      message,
      ...context,
      timestamp: new Date().toISOString()
    }));
  }

  private logError(message: string, error: any, context?: any): void {
    console.error(JSON.stringify({
      level: 'ERROR',
      service: 'GoogleWorkspaceRateLimiter',
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