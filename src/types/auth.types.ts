// Authentication and Authorization Types
export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  roles: Role[];
  permissions: Permission[];
  status: UserStatus;
  profile: UserProfile;
  preferences: UserPreferences;
  metadata: UserMetadata;
}

export type UserStatus = 
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'pending_verification'
  | 'locked';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  type: RoleType;
  organizationId?: string;
}

export type RoleType = 
  | 'system'        // Built-in system roles
  | 'organization'  // Organization-specific roles
  | 'custom';       // Custom user-defined roles

export interface Permission {
  id: string;
  resource: string;
  action: string;
  conditions?: PermissionCondition[];
  scope: PermissionScope;
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in';
  value: any;
}

export type PermissionScope = 
  | 'global'        // System-wide access
  | 'organization'  // Organization-wide access
  | 'team'         // Team-specific access
  | 'self';        // Self-only access

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
  timezone: string;
  locale: string;
  phoneNumber?: string;
  department?: string;
  jobTitle?: string;
}

export interface UserPreferences {
  notifications: NotificationPreferences;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
}

export interface NotificationPreferences {
  email: EmailNotificationSettings;
  inApp: boolean;
  slack?: SlackNotificationSettings;
}

export interface EmailNotificationSettings {
  enabled: boolean;
  workflowUpdates: boolean;
  systemAlerts: boolean;
  billingUpdates: boolean;
  securityAlerts: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
}

export interface SlackNotificationSettings {
  enabled: boolean;
  webhookUrl: string;
  channel: string;
  events: string[];
}

export interface UserMetadata {
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  loginCount: number;
  emailVerified: boolean;
  mfaEnabled: boolean;
  passwordLastChanged?: string;
  invitedBy?: string;
}

// Authentication Tokens and Sessions
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string[];
  issuedAt: number;
}

export interface TokenPayload {
  sub: string;          // User ID
  org: string;          // Organization ID
  roles: string[];      // Role IDs
  permissions: string[]; // Permission strings
  iat: number;          // Issued at
  exp: number;          // Expires at
  jti: string;          // JWT ID
}

export interface Session {
  id: string;
  userId: string;
  organizationId: string;
  deviceInfo: DeviceInfo;
  location?: LocationInfo;
  startedAt: string;
  lastActivity: string;
  expiresAt: string;
  status: SessionStatus;
}

export type SessionStatus = 
  | 'active'
  | 'expired'
  | 'revoked'
  | 'suspended';

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  browser: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  ipAddress: string;
}

export interface LocationInfo {
  country: string;
  region: string;
  city: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// Organizations and Teams
export interface Organization {
  id: string;
  name: string;
  domain: string;
  plan: SubscriptionPlan;
  settings: OrganizationSettings;
  metadata: OrganizationMetadata;
  features: OrganizationFeature[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid';
  limits: PlanLimits;
}

export interface PlanLimits {
  maxUsers: number;
  maxWorkflows: number;
  maxExecutionsPerMonth: number;
  maxStorageGB: number;
  maxIntegrations: number;
}

export interface OrganizationSettings {
  ssoEnabled: boolean;
  mfaRequired: boolean;
  passwordPolicy: PasswordPolicy;
  sessionPolicy: SessionPolicy;
  auditSettings: AuditSettings;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number;
  preventReuse: number;
}

export interface SessionPolicy {
  maxDuration: number;
  inactivityTimeout: number;
  maxConcurrentSessions: number;
  ipRestrictions?: string[];
}

export interface AuditSettings {
  enabled: boolean;
  retentionDays: number;
  events: AuditEventType[];
}

export type AuditEventType = 
  | 'user_login'
  | 'user_logout'
  | 'password_change'
  | 'role_change'
  | 'permission_change'
  | 'workflow_create'
  | 'workflow_execute'
  | 'integration_add'
  | 'settings_change';

export interface OrganizationMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  industry?: string;
  size: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  country: string;
}

export interface OrganizationFeature {
  name: string;
  enabled: boolean;
  config?: any;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  members: TeamMember[];
  permissions: Permission[];
  metadata: TeamMetadata;
}

export interface TeamMember {
  userId: string;
  role: TeamRole;
  joinedAt: string;
  addedBy: string;
}

export type TeamRole = 
  | 'member'
  | 'admin'
  | 'owner';

export interface TeamMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// API Keys and Service Accounts
export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  organizationId: string;
  createdBy: string;
  permissions: Permission[];
  restrictions: ApiKeyRestriction[];
  status: ApiKeyStatus;
  metadata: ApiKeyMetadata;
}

export type ApiKeyStatus = 
  | 'active'
  | 'revoked'
  | 'expired';

export interface ApiKeyRestriction {
  type: 'ip_address' | 'rate_limit' | 'time_window';
  config: any;
}

export interface ApiKeyMetadata {
  createdAt: string;
  expiresAt?: string;
  lastUsed?: string;
  usageCount: number;
  description?: string;
} 