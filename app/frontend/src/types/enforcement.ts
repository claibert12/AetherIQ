export enum EnforcementLevel {
    STRICT = "strict",
    MODERATE = "moderate",
    FLEXIBLE = "flexible"
}

export enum AICapability {
    NATURAL_LANGUAGE = "natural_language",
    IMAGE_GENERATION = "image_generation",
    CODE_GENERATION = "code_generation",
    DATA_ANALYSIS = "data_analysis",
    AUTOMATION = "automation"
}

export enum EnforcementAction {
    BLOCK = "block",
    WARN = "warn",
    LOG = "log",
    REQUIRE_APPROVAL = "require_approval",
    ALLOW = "allow"
}

export interface Condition {
    operator: "equals" | "contains" | "greater_than" | "less_than" | "in";
    value: any;
}

export interface EnforcementRule {
    id: string;
    name: string;
    description: string;
    capability: AICapability;
    level: EnforcementLevel;
    action: EnforcementAction;
    conditions: Record<string, Condition | any>;
    exceptions: string[];
    created_at: string;
    updated_at: string;
    is_active: boolean;
}

export interface EnforcementPolicy {
    id: string;
    name: string;
    description: string;
    rules: EnforcementRule[];
    default_action: EnforcementAction;
    created_at: string;
    updated_at: string;
    is_active: boolean;
}

export interface RequestEvaluation {
    capability: AICapability;
    user_id: string;
    organization_id: string;
    request_data: Record<string, any>;
}

export interface EvaluationResponse {
    action: EnforcementAction;
    timestamp: string;
    request: RequestEvaluation;
}

export interface AuditLog {
    id: string;
    timestamp: string;
    user_id: string;
    organization_id: string;
    capability: string;
    request_data: Record<string, any>;
    action_taken: string;
    metadata: Record<string, any>;
    applied_rule_id?: string;
    applied_policy_id?: string;
} 