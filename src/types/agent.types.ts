// AI Agent Types for AetherIQ
export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  mode: AgentMode;
  capabilities: AgentCapability[];
  config: AgentConfig;
  status: AgentStatus;
  metadata: AgentMetadata;
}

export type AgentType = 
  | 'workflow_supervisor'    // Monitors and manages workflow execution
  | 'task_optimizer'        // Optimizes task execution and resource usage
  | 'anomaly_detector'      // Detects unusual patterns in executions
  | 'suggestion_engine'     // Suggests workflow improvements
  | 'auto_recovery'         // Handles automatic error recovery
  | 'cost_optimizer'        // Optimizes resource costs
  | 'security_monitor'      // Monitors for security issues
  | 'compliance_checker';   // Ensures compliance with policies

export type AgentMode = 
  | 'supervised'    // Requires human approval for actions
  | 'autonomous'    // Can act independently within defined bounds
  | 'advisory'      // Only provides recommendations
  | 'disabled';     // Inactive

export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  permissions: AgentPermission[];
  constraints: AgentConstraint[];
}

export interface AgentPermission {
  resource: string;
  actions: string[];
  conditions?: string[];
}

export interface AgentConstraint {
  type: 'time' | 'cost' | 'resource' | 'approval' | 'custom';
  rules: any;
}

export interface AgentConfig {
  learningEnabled: boolean;
  confidenceThreshold: number;
  interventionRules: InterventionRule[];
  escalationPolicy: EscalationPolicy;
  auditSettings: AuditSettings;
}

export interface InterventionRule {
  condition: string;
  action: InterventionAction;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export type InterventionAction = 
  | 'pause_workflow'
  | 'skip_task'
  | 'retry_with_adjustment'
  | 'escalate_to_human'
  | 'apply_fallback'
  | 'terminate_execution';

export interface EscalationPolicy {
  triggers: EscalationTrigger[];
  recipients: EscalationRecipient[];
  channels: string[];
}

export interface EscalationTrigger {
  condition: string;
  threshold: number;
  timeWindow: number;
}

export interface EscalationRecipient {
  type: 'user' | 'role' | 'team';
  identifier: string;
  escalationLevel: number;
}

export interface AuditSettings {
  logAllDecisions: boolean;
  logReasoning: boolean;
  retentionDays: number;
  complianceLevel: 'basic' | 'standard' | 'strict';
}

export type AgentStatus = 
  | 'active'
  | 'inactive'
  | 'learning'
  | 'error'
  | 'maintenance';

export interface AgentMetadata {
  version: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  organizationId: string;
  performance: AgentPerformance;
}

export interface AgentPerformance {
  decisionsCount: number;
  accuracyRate: number;
  interventionRate: number;
  costSavings: number;
  timeToDecision: number;
  lastLearningUpdate: string;
}

// Agent Decision Making
export interface AgentDecision {
  id: string;
  agentId: string;
  context: DecisionContext;
  analysis: DecisionAnalysis;
  recommendation: AgentRecommendation;
  confidence: number;
  reasoning: string[];
  timestamp: string;
  executionResult?: DecisionResult;
}

export interface DecisionContext {
  workflowId?: string;
  taskId?: string;
  executionId?: string;
  organizationId: string;
  currentState: any;
  historicalData: any;
  environmentFactors: any;
}

export interface DecisionAnalysis {
  riskAssessment: RiskAssessment;
  impactAnalysis: ImpactAnalysis;
  alternativeOptions: AlternativeOption[];
  constraints: ConstraintEvaluation[];
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
  mitigations: string[];
}

export interface RiskFactor {
  type: string;
  severity: number;
  likelihood: number;
  description: string;
}

export interface ImpactAnalysis {
  costImpact: number;
  timeImpact: number;
  resourceImpact: number;
  userImpact: string;
  businessImpact: string;
}

export interface AlternativeOption {
  id: string;
  description: string;
  pros: string[];
  cons: string[];
  estimatedOutcome: any;
  confidence: number;
}

export interface ConstraintEvaluation {
  constraint: string;
  satisfied: boolean;
  reasoning: string;
}

export interface AgentRecommendation {
  action: string;
  parameters: any;
  urgency: 'low' | 'medium' | 'high' | 'immediate';
  requiredApprovals: string[];
  rollbackPlan?: string;
}

export interface DecisionResult {
  executed: boolean;
  outcome: 'success' | 'failure' | 'partial' | 'pending';
  actualImpact: any;
  feedback: AgentFeedback;
}

export interface AgentFeedback {
  rating: number; // 1-5 scale
  comments: string;
  providedBy: string;
  timestamp: string;
  improvements: string[];
} 