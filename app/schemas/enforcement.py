from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime
from app.core.enforcement import EnforcementLevel, AICapability, EnforcementAction

# Rule Schemas
class RuleBase(BaseModel):
    name: str
    description: str
    capability: AICapability
    level: EnforcementLevel
    action: EnforcementAction
    conditions: Dict[str, Any]
    exceptions: List[str] = Field(default_factory=list)
    is_active: bool = True

class RuleCreate(RuleBase):
    pass

class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    capability: Optional[AICapability] = None
    level: Optional[EnforcementLevel] = None
    action: Optional[EnforcementAction] = None
    conditions: Optional[Dict[str, Any]] = None
    exceptions: Optional[List[str]] = None
    is_active: Optional[bool] = None

class RuleResponse(RuleBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Policy Schemas
class PolicyBase(BaseModel):
    name: str
    description: str
    default_action: EnforcementAction = EnforcementAction.BLOCK
    is_active: bool = True

class PolicyCreate(PolicyBase):
    rule_ids: List[str]

class PolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_action: Optional[EnforcementAction] = None
    is_active: Optional[bool] = None
    rule_ids: Optional[List[str]] = None

class PolicyResponse(PolicyBase):
    id: str
    rules: List[RuleResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Request Evaluation Schemas
class RequestEvaluation(BaseModel):
    capability: AICapability
    user_id: str
    organization_id: str
    request_data: Dict[str, Any]

class EvaluationResponse(BaseModel):
    action: EnforcementAction
    timestamp: datetime
    request: RequestEvaluation

# Audit Log Schemas
class AuditLogBase(BaseModel):
    user_id: str
    organization_id: str
    capability: str
    request_data: Dict[str, Any]
    action_taken: str
    metadata: Dict[str, Any]

class AuditLogResponse(AuditLogBase):
    id: str
    timestamp: datetime
    applied_rule_id: Optional[str] = None
    applied_policy_id: Optional[str] = None

    class Config:
        from_attributes = True 