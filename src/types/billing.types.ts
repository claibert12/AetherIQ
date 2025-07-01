// Billing and Usage Metering Types
export interface UsageRecord {
  id: string;
  organizationId: string;
  userId?: string;
  workflowId?: string;
  taskId?: string;
  timestamp: string;
  usageType: UsageType;
  quantity: number;
  unit: UsageUnit;
  cost: number;
  currency: string;
  metadata: UsageMetadata;
}

export type UsageType = 
  | 'workflow_execution'
  | 'task_execution'
  | 'data_processing'
  | 'storage'
  | 'api_calls'
  | 'compute_time'
  | 'bandwidth'
  | 'ai_operations'
  | 'integration_calls'
  | 'user_seats';

export type UsageUnit = 
  | 'execution'
  | 'milliseconds'
  | 'megabytes'
  | 'gigabytes'
  | 'requests'
  | 'operations'
  | 'users'
  | 'seats';

export interface UsageMetadata {
  region: string;
  service: string;
  instanceType?: string;
  duration?: number;
  resourceTags: Record<string, string>;
  billingTags: Record<string, string>;
}

// Billing Plans and Tiers
export interface BillingPlan {
  id: string;
  name: string;
  tier: BillingTier;
  pricing: PricingModel;
  limits: UsageLimits;
  features: PlanFeature[];
  validity: PlanValidity;
}

export type BillingTier = 
  | 'free'
  | 'starter'
  | 'professional'
  | 'enterprise'
  | 'custom';

export interface PricingModel {
  type: 'fixed' | 'usage_based' | 'hybrid' | 'custom';
  baseFee?: number;
  usageRates: UsageRate[];
  discounts?: Discount[];
}

export interface UsageRate {
  usageType: UsageType;
  unit: UsageUnit;
  rate: number;
  currency: string;
  tiers?: TierPricing[];
}

export interface TierPricing {
  min: number;
  max?: number;
  rate: number;
}

export interface Discount {
  type: 'percentage' | 'fixed_amount' | 'free_tier';
  value: number;
  appliesTo: UsageType[];
  conditions?: DiscountCondition[];
}

export interface DiscountCondition {
  type: 'minimum_usage' | 'contract_term' | 'volume' | 'loyalty';
  threshold: number;
  period?: string;
}

export interface UsageLimits {
  workflowExecutions?: number;
  taskExecutions?: number;
  storageGB?: number;
  apiCalls?: number;
  computeHours?: number;
  users?: number;
  integrations?: number;
}

export interface PlanFeature {
  id: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
}

export interface PlanValidity {
  startDate: string;
  endDate?: string;
  autoRenew: boolean;
  gracePeriodDays: number;
}

// Billing Cycles and Invoices
export interface BillingCycle {
  id: string;
  organizationId: string;
  period: BillingPeriod;
  startDate: string;
  endDate: string;
  status: BillingCycleStatus;
  usage: UsageSummary;
  costs: CostBreakdown;
  invoice?: Invoice;
}

export type BillingPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type BillingCycleStatus = 
  | 'active'
  | 'pending_calculation'
  | 'calculated'
  | 'invoiced'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface UsageSummary {
  totalExecutions: number;
  totalComputeTime: number;
  totalStorageUsed: number;
  totalApiCalls: number;
  totalUsers: number;
  byService: Record<string, ServiceUsage>;
}

export interface ServiceUsage {
  executions: number;
  computeTime: number;
  cost: number;
}

export interface CostBreakdown {
  baseFee: number;
  usageFees: number;
  overage: number;
  discounts: number;
  taxes: number;
  total: number;
  currency: string;
  details: CostDetail[];
}

export interface CostDetail {
  category: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  organizationId: string;
  billingCycleId: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  amount: number;
  currency: string;
  lineItems: InvoiceLineItem[];
  paymentDetails?: PaymentDetails;
}

export type InvoiceStatus = 
  | 'draft'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'refunded';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  taxable: boolean;
}

export interface PaymentDetails {
  method: PaymentMethod;
  transactionId?: string;
  paidDate?: string;
  paidAmount?: number;
  fees?: number;
}

export type PaymentMethod = 
  | 'credit_card'
  | 'bank_transfer'
  | 'invoice'
  | 'purchase_order'
  | 'crypto';

// Cost Analytics and Optimization
export interface CostAnalytics {
  organizationId: string;
  period: AnalyticsPeriod;
  trends: CostTrend[];
  forecasts: CostForecast[];
  recommendations: CostRecommendation[];
  budgetAlerts: BudgetAlert[];
}

export interface AnalyticsPeriod {
  start: string;
  end: string;
  granularity: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export interface CostTrend {
  service: string;
  usageType: UsageType;
  data: TrendDataPoint[];
  growth: number;
  seasonality?: SeasonalityPattern;
}

export interface TrendDataPoint {
  timestamp: string;
  value: number;
  cost: number;
}

export interface SeasonalityPattern {
  pattern: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  peaks: string[];
  valleys: string[];
}

export interface CostForecast {
  service: string;
  usageType: UsageType;
  predictedCost: number;
  confidence: number;
  factors: ForecastFactor[];
}

export interface ForecastFactor {
  name: string;
  impact: number;
  description: string;
}

export interface CostRecommendation {
  type: RecommendationType;
  title: string;
  description: string;
  potentialSavings: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  actions: RecommendationAction[];
}

export type RecommendationType = 
  | 'optimize_workflow'
  | 'reduce_storage'
  | 'consolidate_resources'
  | 'upgrade_plan'
  | 'downgrade_plan'
  | 'optimize_schedule'
  | 'reduce_retries';

export interface RecommendationAction {
  description: string;
  automated: boolean;
  estimatedSavings: number;
}

export interface BudgetAlert {
  id: string;
  type: 'threshold' | 'forecast' | 'anomaly';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  currentSpend: number;
  budgetLimit: number;
  projectedSpend?: number;
  recommendations: string[];
} 