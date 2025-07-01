import { DynamoDBClient, GetItemCommand, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { 
  M365Config, 
  RateLimitState, 
  RateLimitResult,
  M365Error 
} from './types';

/**
 * Microsoft 365 Rate Limiter
 * 
 * Implements token bucket and sliding window rate limiting for Microsoft 365 API calls.
 * Provides per-tenant rate limiting with persistent state storage in DynamoDB.
 */
export class M365RateLimiter {
  private dynamoClient: DynamoDBClient;
  private tableName: string;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.tableName = process.env.M365_RATE_LIMIT_TABLE || 'aetheriq-m365-rate-limits';
  }

  /**
   * Check if request is allowed under rate limits
   */
  async checkRateLimit(tenantId: string, config: M365Config): Promise<RateLimitResult> {
    try {
      const now = Date.now();
      const currentWindow = Math.floor(now / (60 * 1000)); // 1-minute windows
      
      // Get current rate limit state
      let state = await this.getRateLimitState(tenantId);
      
      if (!state) {
        // Initialize new state
        state = {
          tenantId,
          requestCount: 0,
          windowStart: currentWindow,
          lastRequest: now,
          burstTokens: config.rateLimits.burstLimit
        };
      }

      // Check if we're in a new window
      if (currentWindow > state.windowStart) {
        // Reset for new window
        state.requestCount = 0;
        state.windowStart = currentWindow;
        state.burstTokens = Math.min(
          config.rateLimits.burstLimit,
          state.burstTokens + Math.floor((currentWindow - state.windowStart) * (config.rateLimits.requestsPerMinute / 60))
        );
      }

      // Refill burst tokens based on time elapsed
      const timeSinceLastRequest = now - state.lastRequest;
      const tokensToAdd = Math.floor(timeSinceLastRequest / 1000) * (config.rateLimits.requestsPerSecond);
      state.burstTokens = Math.min(config.rateLimits.burstLimit, state.burstTokens + tokensToAdd);

      // Check per-second rate limit (burst)
      if (state.burstTokens < 1) {
        const retryAfterMs = Math.ceil(1000 / config.rateLimits.requestsPerSecond);
        await this.updateRateLimitState(state);
        
        return {
          allowed: false,
          remaining: 0,
          limit: config.rateLimits.requestsPerSecond,
          resetTime: Math.floor((now + retryAfterMs) / 1000),
          retryAfterMs
        };
      }

      // Check per-minute rate limit
      if (state.requestCount >= config.rateLimits.requestsPerMinute) {
        const windowEndMs = (state.windowStart + 1) * 60 * 1000;
        const retryAfterMs = windowEndMs - now;
        
        return {
          allowed: false,
          remaining: 0,
          limit: config.rateLimits.requestsPerMinute,
          resetTime: Math.floor(windowEndMs / 1000),
          retryAfterMs
        };
      }

      // Allow request - consume tokens
      state.requestCount++;
      state.burstTokens--;
      state.lastRequest = now;
      
      await this.updateRateLimitState(state);

      return {
        allowed: true,
        remaining: Math.min(
          config.rateLimits.requestsPerMinute - state.requestCount,
          state.burstTokens
        ),
        limit: config.rateLimits.requestsPerMinute,
        resetTime: Math.floor(((state.windowStart + 1) * 60 * 1000) / 1000)
      };

    } catch (error: any) {
      this.logError('Rate limit check failed', error, { tenantId });
      
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: config.rateLimits.requestsPerMinute,
        limit: config.rateLimits.requestsPerMinute,
        resetTime: Math.floor((Date.now() + 60000) / 1000)
      };
    }
  }

  /**
   * Get current rate limit status for tenant
   */
  async getRateLimitStatus(tenantId: string, config: M365Config): Promise<RateLimitResult> {
    try {
      const now = Date.now();
      const currentWindow = Math.floor(now / (60 * 1000));
      
      const state = await this.getRateLimitState(tenantId);
      
      if (!state) {
        return {
          allowed: true,
          remaining: config.rateLimits.requestsPerMinute,
          limit: config.rateLimits.requestsPerMinute,
          resetTime: Math.floor(((currentWindow + 1) * 60 * 1000) / 1000)
        };
      }

      // Calculate remaining requests
      let remaining = config.rateLimits.requestsPerMinute - state.requestCount;
      
      // If we're in a new window, reset count
      if (currentWindow > state.windowStart) {
        remaining = config.rateLimits.requestsPerMinute;
      }

      // Consider burst tokens
      const timeSinceLastRequest = now - state.lastRequest;
      const tokensToAdd = Math.floor(timeSinceLastRequest / 1000) * (config.rateLimits.requestsPerSecond);
      const currentBurstTokens = Math.min(config.rateLimits.burstLimit, state.burstTokens + tokensToAdd);
      
      remaining = Math.min(remaining, currentBurstTokens);

      return {
        allowed: remaining > 0,
        remaining: Math.max(0, remaining),
        limit: config.rateLimits.requestsPerMinute,
        resetTime: Math.floor(((currentWindow + 1) * 60 * 1000) / 1000)
      };

    } catch (error: any) {
      this.logError('Failed to get rate limit status', error, { tenantId });
      
      return {
        allowed: true,
        remaining: config.rateLimits.requestsPerMinute,
        limit: config.rateLimits.requestsPerMinute,
        resetTime: Math.floor((Date.now() + 60000) / 1000)
      };
    }
  }

  /**
   * Reset rate limits for tenant (admin function)
   */
  async resetRateLimit(tenantId: string): Promise<void> {
    try {
      const command = new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ tenantId })
      });

      await this.dynamoClient.send(command);
      
      this.logInfo('Rate limits reset successfully', { tenantId });
    } catch (error: any) {
      this.logError('Failed to reset rate limits', error, { tenantId });
      throw this.createRateLimitError(
        'RESET_FAILED',
        `Failed to reset rate limits: ${error.message}`,
        error,
        false
      );
    }
  }

  /**
   * Cleanup expired rate limit entries
   */
  async cleanupExpiredEntries(): Promise<void> {
    try {
      // This would typically use a DynamoDB scan with TTL
      // For now, we rely on DynamoDB TTL to handle cleanup automatically
      this.logInfo('Rate limit cleanup completed');
    } catch (error: any) {
      this.logError('Failed to cleanup expired rate limit entries', error);
    }
  }

  /**
   * Get rate limit state from DynamoDB
   */
  private async getRateLimitState(tenantId: string): Promise<RateLimitState | null> {
    try {
      const command = new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ tenantId })
      });

      const result = await this.dynamoClient.send(command);
      
      if (!result.Item) {
        return null;
      }

      const state = unmarshall(result.Item) as RateLimitState;
      return state;
    } catch (error: any) {
      this.logError('Failed to get rate limit state', error, { tenantId });
      return null;
    }
  }

  /**
   * Update rate limit state in DynamoDB
   */
  private async updateRateLimitState(state: RateLimitState): Promise<void> {
    try {
      const ttl = Math.floor((Date.now() + (2 * 60 * 60 * 1000)) / 1000); // TTL 2 hours from now
      
      const command = new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          ...state,
          ttl
        })
      });

      await this.dynamoClient.send(command);
    } catch (error: any) {
      this.logError('Failed to update rate limit state', error, { tenantId: state.tenantId });
      // Don't throw - rate limiting should not block requests
    }
  }

  /**
   * Create standardized rate limit error
   */
  private createRateLimitError(
    code: string,
    message: string,
    details: any = {},
    retryable: boolean = true
  ): M365Error {
    return {
      code,
      message,
      details,
      retryable,
      category: 'rate_limit'
    };
  }

  private logInfo(message: string, context?: any): void {
    console.log(JSON.stringify({
      level: 'INFO',
      service: 'M365RateLimiter',
      message,
      ...context,
      timestamp: new Date().toISOString()
    }));
  }

  private logError(message: string, error: any, context?: any): void {
    console.error(JSON.stringify({
      level: 'ERROR',
      service: 'M365RateLimiter',
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