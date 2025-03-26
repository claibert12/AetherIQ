from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.enforcement import AICapability, EnforcementAction, EnforcementLevel
from app.services.enforcement_service import EnforcementService
from app.db.session import get_db
from app.schemas.enforcement import (
    RuleCreate,
    RuleUpdate,
    RuleResponse,
    PolicyCreate,
    PolicyUpdate,
    PolicyResponse,
    RequestEvaluation,
    EvaluationResponse,
    AuditLogResponse
)

router = APIRouter()

@router.post("/rules/", response_model=RuleResponse)
def create_rule(
    *,
    db: Session = Depends(get_db),
    rule_in: RuleCreate
):
    """Create a new enforcement rule."""
    service = EnforcementService(db)
    rule = service.create_rule(rule_in.dict())
    return rule

@router.get("/rules/{rule_id}", response_model=RuleResponse)
def get_rule(
    *,
    db: Session = Depends(get_db),
    rule_id: str
):
    """Get a specific rule by ID."""
    service = EnforcementService(db)
    rule = service.get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule

@router.put("/rules/{rule_id}", response_model=RuleResponse)
def update_rule(
    *,
    db: Session = Depends(get_db),
    rule_id: str,
    rule_in: RuleUpdate
):
    """Update an existing rule."""
    service = EnforcementService(db)
    rule = service.update_rule(rule_id, rule_in.dict(exclude_unset=True))
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule

@router.post("/policies/", response_model=PolicyResponse)
def create_policy(
    *,
    db: Session = Depends(get_db),
    policy_in: PolicyCreate
):
    """Create a new enforcement policy."""
    service = EnforcementService(db)
    policy = service.create_policy(
        policy_data=policy_in.dict(exclude={"rule_ids"}),
        rule_ids=policy_in.rule_ids
    )
    return policy

@router.get("/policies/{policy_id}", response_model=PolicyResponse)
def get_policy(
    *,
    db: Session = Depends(get_db),
    policy_id: str
):
    """Get a specific policy by ID."""
    service = EnforcementService(db)
    policy = service.get_policy(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy

@router.put("/policies/{policy_id}", response_model=PolicyResponse)
def update_policy(
    *,
    db: Session = Depends(get_db),
    policy_id: str,
    policy_in: PolicyUpdate
):
    """Update an existing policy."""
    service = EnforcementService(db)
    policy = service.update_policy(
        policy_id=policy_id,
        policy_data=policy_in.dict(exclude={"rule_ids"}, exclude_unset=True),
        rule_ids=policy_in.rule_ids if policy_in.rule_ids is not None else None
    )
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy

@router.post("/evaluate/", response_model=EvaluationResponse)
def evaluate_request(
    *,
    db: Session = Depends(get_db),
    request_in: RequestEvaluation
):
    """Evaluate an AI request against enforcement rules and policies."""
    service = EnforcementService(db)
    action = service.evaluate_request(
        capability=request_in.capability,
        user_id=request_in.user_id,
        organization_id=request_in.organization_id,
        request_data=request_in.request_data
    )
    return {
        "action": action,
        "timestamp": datetime.utcnow(),
        "request": request_in
    }

@router.get("/audit-logs/", response_model=List[AuditLogResponse])
def get_audit_logs(
    *,
    db: Session = Depends(get_db),
    user_id: Optional[str] = None,
    organization_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = 100
):
    """Get audit logs with optional filters."""
    service = EnforcementService(db)
    logs = service.get_audit_logs(
        user_id=user_id,
        organization_id=organization_id,
        start_time=start_time,
        end_time=end_time,
        limit=limit
    )
    return logs

@router.get("/capabilities/", response_model=List[str])
def get_capabilities():
    """Get list of available AI capabilities."""
    return [capability.value for capability in AICapability]

@router.get("/enforcement-levels/", response_model=List[str])
def get_enforcement_levels():
    """Get list of available enforcement levels."""
    return [level.value for level in EnforcementLevel]

@router.get("/enforcement-actions/", response_model=List[str])
def get_enforcement_actions():
    """Get list of available enforcement actions."""
    return [action.value for action in EnforcementAction] 