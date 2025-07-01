// Integration Types for External Systems
export interface Integration {
  id: string;
  name: string;
  type: IntegrationType;
  version: string;
  status: IntegrationStatus;
  config: IntegrationConfig;
  credentials: IntegrationCredentials;
  capabilities: IntegrationCapability[];
  healthCheck: HealthCheckConfig;
  metadata: IntegrationMetadata;
}

export type IntegrationType = 
  | 'google_workspace'
  | 'microsoft365'
  | 'salesforce'
  | 'slack'
  | 'jira'
  | 'confluence'
  | 'github'
  | 'gitlab'
  | 'aws'
  | 'azure'
  | 'gcp'
  | 'webhook'
  | 'database'
  | 'api_rest'
  | 'api_graphql'
  | 'email_smtp'
  | 'ftp'
  | 'custom';

export type IntegrationStatus = 
  | 'active'
  | 'inactive'
  | 'error'
  | 'testing'
  | 'maintenance'
  | 'deprecated';

export interface IntegrationConfig {
  baseUrl?: string;
  apiVersion?: string;
  timeout: number;
  rateLimits: RateLimitConfig;
  retryPolicy: RetryPolicy;
  endpoints: EndpointConfig[];
  webhookSettings?: WebhookSettings;
  customHeaders?: Record<string, string>;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface EndpointConfig {
  name: string;
  path: string;
  method: HttpMethod;
  description: string;
  parameters: EndpointParameter[];
  responseSchema?: any;
  rateLimitOverride?: Partial<RateLimitConfig>;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface EndpointParameter {
  name: string;
  type: 'path' | 'query' | 'header' | 'body';
  dataType: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  validation?: ParameterValidation;
}

export interface ParameterValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: any[];
}

export interface WebhookSettings {
  enabled: boolean;
  url?: string;
  secret?: string;
  events: string[];
  retryPolicy: WebhookRetryPolicy;
}

export interface WebhookRetryPolicy {
  maxAttempts: number;
  delayMs: number;
  exponentialBackoff: boolean;
}

export interface IntegrationCredentials {
  type: CredentialType;
  config: CredentialConfig;
  expiresAt?: string;
  refreshToken?: string;
  scopes?: string[];
}

export type CredentialType = 
  | 'oauth2'
  | 'api_key'
  | 'bearer_token'
  | 'basic_auth'
  | 'certificate'
  | 'custom';

export interface CredentialConfig {
  [key: string]: any;
  // OAuth2 specific
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenUrl?: string;
  authUrl?: string;
  // API Key specific
  apiKey?: string;
  apiSecret?: string;
  keyLocation?: 'header' | 'query' | 'body';
  keyName?: string;
  // Basic Auth specific
  username?: string;
  password?: string;
  // Certificate specific
  certificate?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface IntegrationCapability {
  name: string;
  description: string;
  operations: CapabilityOperation[];
  dataTypes: DataTypeMapping[];
  limitations?: string[];
}

export interface CapabilityOperation {
  name: string;
  type: 'read' | 'write' | 'delete' | 'list' | 'search' | 'webhook';
  endpoint: string;
  description: string;
  inputSchema?: any;
  outputSchema?: any;
}

export interface DataTypeMapping {
  internal: string;
  external: string;
  transformation?: string;
}

export interface HealthCheckConfig {
  enabled: boolean;
  endpoint: string;
  interval: number;
  timeout: number;
  expectedStatus: number;
  retries: number;
}

export interface IntegrationMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  organizationId: string;
  tags: string[];
  documentation?: string;
  supportContact?: string;
  version: string;
  lastHealthCheck?: HealthCheckResult;
  usage: IntegrationUsage;
}

export interface HealthCheckResult {
  timestamp: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  error?: string;
  details?: any;
}

export interface IntegrationUsage {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: string;
  dailyUsage: UsageDataPoint[];
}

export interface UsageDataPoint {
  date: string;
  requests: number;
  errors: number;
  averageResponseTime: number;
}

// Integration Events and Logs
export interface IntegrationEvent {
  id: string;
  integrationId: string;
  type: IntegrationEventType;
  timestamp: string;
  data: any;
  metadata: EventMetadata;
}

export type IntegrationEventType = 
  | 'request_sent'
  | 'response_received'
  | 'error_occurred'
  | 'rate_limit_hit'
  | 'credential_expired'
  | 'health_check_failed'
  | 'webhook_received'
  | 'configuration_changed';

export interface EventMetadata {
  requestId: string;
  userId?: string;
  workflowId?: string;
  taskId?: string;
  endpoint?: string;
  httpStatus?: number;
  responseTime?: number;
  error?: string;
}

// Platform-Specific Types
export interface GoogleWorkspaceConfig extends IntegrationConfig {
  domain: string;
  adminEmail: string;
  serviceAccountKey: string;
  delegatedUser?: string;
}

export interface Microsoft365Config extends IntegrationConfig {
  tenantId: string;
  applicationId: string;
  applicationSecret: string;
  directoryId?: string;
}

export interface SalesforceConfig extends IntegrationConfig {
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  securityToken: string;
  sandbox: boolean;
} 