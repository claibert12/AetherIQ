from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime

from app.core.enforcement import (
    EnforcementEngine,
    EnforcementContext,
    EnforcementRule as CoreRule,
    EnforcementPolicy as CorePolicy,
    EnforcementAction,
    AICapability
)
from app.models.enforcement import (
    EnforcementRule as DBRule,
    EnforcementPolicy as DBPolicy,
    EnforcementAuditLog
)

class EnforcementService:
    def __init__(self, db: Session):
        self.db = db
        self.engine = EnforcementEngine()
        self._load_policies()

    def _load_policies(self) -> None:
        """Load all active policies and rules from the database into the enforcement engine."""
        db_policies = self.db.query(DBPolicy).filter(DBPolicy.is_active == True).all()
        for db_policy in db_policies:
            core_policy = CorePolicy(
                id=db_policy.id,
                name=db_policy.name,
                description=db_policy.description,
                rules=[self._db_rule_to_core(rule) for rule in db_policy.rules if rule.is_active],
                default_action=EnforcementAction(db_policy.default_action),
                created_at=db_policy.created_at,
                updated_at=db_policy.updated_at,
                is_active=db_policy.is_active
            )
            self.engine.add_policy(core_policy)

    def _db_rule_to_core(self, db_rule: DBRule) -> CoreRule:
        """Convert a database rule to a core rule."""
        return CoreRule(
            id=db_rule.id,
            name=db_rule.name,
            description=db_rule.description,
            capability=AICapability(db_rule.capability),
            level=db_rule.level,
            action=EnforcementAction(db_rule.action),
            conditions=db_rule.conditions,
            exceptions=db_rule.exceptions,
            created_at=db_rule.created_at,
            updated_at=db_rule.updated_at,
            is_active=db_rule.is_active
        )

    def create_rule(self, rule_data: Dict[str, Any]) -> DBRule:
        """Create a new enforcement rule."""
        rule_id = str(uuid4())
        db_rule = DBRule(
            id=rule_id,
            **rule_data
        )
        self.db.add(db_rule)
        self.db.commit()
        self.db.refresh(db_rule)
        return db_rule

    def create_policy(self, policy_data: Dict[str, Any], rule_ids: List[str]) -> DBPolicy:
        """Create a new enforcement policy with associated rules."""
        policy_id = str(uuid4())
        rules = self.db.query(DBRule).filter(DBRule.id.in_(rule_ids)).all()
        
        db_policy = DBPolicy(
            id=policy_id,
            **policy_data,
            rules=rules
        )
        self.db.add(db_policy)
        self.db.commit()
        self.db.refresh(db_policy)
        
        # Reload policies in the engine
        self._load_policies()
        return db_policy

    def evaluate_request(
        self,
        capability: AICapability,
        user_id: str,
        organization_id: str,
        request_data: Dict[str, Any]
    ) -> EnforcementAction:
        """Evaluate an AI request against enforcement rules and policies."""
        context = EnforcementContext(user_id, organization_id)
        action = self.engine.evaluate_request(capability, context, request_data)
        
        # Create audit log
        audit_log = EnforcementAuditLog(
            id=str(uuid4()),
            user_id=user_id,
            organization_id=organization_id,
            capability=capability.value,
            request_data=request_data,
            action_taken=action.value,
            metadata={
                "context": {
                    "user_id": context.user_id,
                    "organization_id": context.organization_id,
                    "timestamp": context.timestamp.isoformat()
                }
            }
        )
        self.db.add(audit_log)
        self.db.commit()
        
        return action

    def get_rule(self, rule_id: str) -> Optional[DBRule]:
        """Get a rule by ID."""
        return self.db.query(DBRule).filter(DBRule.id == rule_id).first()

    def get_policy(self, policy_id: str) -> Optional[DBPolicy]:
        """Get a policy by ID."""
        return self.db.query(DBPolicy).filter(DBPolicy.id == policy_id).first()

    def update_rule(self, rule_id: str, rule_data: Dict[str, Any]) -> Optional[DBRule]:
        """Update an existing rule."""
        db_rule = self.get_rule(rule_id)
        if not db_rule:
            return None

        for key, value in rule_data.items():
            setattr(db_rule, key, value)
        db_rule.updated_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(db_rule)
        
        # Reload policies to update the engine
        self._load_policies()
        return db_rule

    def update_policy(
        self,
        policy_id: str,
        policy_data: Dict[str, Any],
        rule_ids: Optional[List[str]] = None
    ) -> Optional[DBPolicy]:
        """Update an existing policy."""
        db_policy = self.get_policy(policy_id)
        if not db_policy:
            return None

        for key, value in policy_data.items():
            setattr(db_policy, key, value)

        if rule_ids is not None:
            rules = self.db.query(DBRule).filter(DBRule.id.in_(rule_ids)).all()
            db_policy.rules = rules

        db_policy.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(db_policy)
        
        # Reload policies to update the engine
        self._load_policies()
        return db_policy

    def get_audit_logs(
        self,
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100
    ) -> List[EnforcementAuditLog]:
        """Get audit logs with optional filters."""
        query = self.db.query(EnforcementAuditLog)
        
        if user_id:
            query = query.filter(EnforcementAuditLog.user_id == user_id)
        if organization_id:
            query = query.filter(EnforcementAuditLog.organization_id == organization_id)
        if start_time:
            query = query.filter(EnforcementAuditLog.timestamp >= start_time)
        if end_time:
            query = query.filter(EnforcementAuditLog.timestamp <= end_time)
            
        return query.order_by(EnforcementAuditLog.timestamp.desc()).limit(limit).all() 