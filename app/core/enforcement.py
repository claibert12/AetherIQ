from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class EnforcementLevel(Enum):
    STRICT = "strict"  # No exceptions allowed
    MODERATE = "moderate"  # Some exceptions with approval
    FLEXIBLE = "flexible"  # Suggestions only

class AICapability(Enum):
    NATURAL_LANGUAGE = "natural_language"
    IMAGE_GENERATION = "image_generation"
    CODE_GENERATION = "code_generation"
    DATA_ANALYSIS = "data_analysis"
    AUTOMATION = "automation"

class EnforcementAction(Enum):
    BLOCK = "block"
    WARN = "warn"
    LOG = "log"
    REQUIRE_APPROVAL = "require_approval"
    ALLOW = "allow"

class EnforcementRule(BaseModel):
    id: str
    name: str
    description: str
    capability: AICapability
    level: EnforcementLevel
    action: EnforcementAction
    conditions: Dict[str, Any]
    exceptions: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class EnforcementPolicy(BaseModel):
    id: str
    name: str
    description: str
    rules: List[EnforcementRule]
    default_action: EnforcementAction = EnforcementAction.BLOCK
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class EnforcementContext:
    def __init__(self, user_id: str, organization_id: str):
        self.user_id = user_id
        self.organization_id = organization_id
        self.timestamp = datetime.utcnow()
        self.metadata: Dict[str, Any] = {}

class EnforcementEngine:
    def __init__(self):
        self.policies: List[EnforcementPolicy] = []
        self.active_rules: Dict[str, EnforcementRule] = {}

    def add_policy(self, policy: EnforcementPolicy) -> None:
        self.policies.append(policy)
        for rule in policy.rules:
            if rule.is_active:
                self.active_rules[rule.id] = rule

    def remove_policy(self, policy_id: str) -> None:
        self.policies = [p for p in self.policies if p.id != policy_id]
        self.active_rules = {
            rule_id: rule 
            for rule_id, rule in self.active_rules.items()
            if any(rule in policy.rules for policy in self.policies)
        }

    def evaluate_request(
        self,
        capability: AICapability,
        context: EnforcementContext,
        request_data: Dict[str, Any]
    ) -> EnforcementAction:
        applicable_rules = [
            rule for rule in self.active_rules.values()
            if rule.capability == capability
        ]

        if not applicable_rules:
            return EnforcementAction.BLOCK

        # Apply rules in order of enforcement level strictness
        for level in EnforcementLevel:
            level_rules = [rule for rule in applicable_rules if rule.level == level]
            for rule in level_rules:
                if self._matches_conditions(rule, context, request_data):
                    if context.user_id in rule.exceptions:
                        continue
                    return rule.action

        # If no rules match, use the most restrictive policy's default action
        strictest_policy = max(
            self.policies,
            key=lambda p: EnforcementLevel[p.rules[0].level.value].value if p.rules else 0
        )
        return strictest_policy.default_action

    def _matches_conditions(
        self,
        rule: EnforcementRule,
        context: EnforcementContext,
        request_data: Dict[str, Any]
    ) -> bool:
        # Implement condition matching logic here
        # This should check all conditions specified in the rule against the context and request data
        for key, condition in rule.conditions.items():
            if key in request_data:
                if isinstance(condition, dict):
                    if not self._evaluate_condition(condition, request_data[key]):
                        return False
                elif request_data[key] != condition:
                    return False
        return True

    def _evaluate_condition(self, condition: Dict[str, Any], value: Any) -> bool:
        # Implement complex condition evaluation logic here
        # This should handle operators like greater than, less than, contains, etc.
        operator = condition.get("operator")
        target = condition.get("value")

        if operator == "equals":
            return value == target
        elif operator == "contains":
            return target in value
        elif operator == "greater_than":
            return value > target
        elif operator == "less_than":
            return value < target
        elif operator == "in":
            return value in target
        return False

# Create a global enforcement engine instance
enforcement_engine = EnforcementEngine() 