import pytest
from datetime import datetime
from uuid import uuid4
from sqlalchemy.orm import Session

from app.core.enforcement import (
    AICapability,
    EnforcementLevel,
    EnforcementAction,
    EnforcementContext
)
from app.services.enforcement_service import EnforcementService
from app.models.enforcement import EnforcementRule, EnforcementPolicy, EnforcementAuditLog

@pytest.fixture
def db_session():
    # This should be replaced with your actual test database session
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def enforcement_service(db_session: Session):
    return EnforcementService(db_session)

@pytest.fixture
def sample_rule(db_session: Session):
    rule = EnforcementRule(
        id=str(uuid4()),
        name="Test Rule",
        description="A test rule",
        capability=AICapability.NATURAL_LANGUAGE.value,
        level=EnforcementLevel.MODERATE.value,
        action=EnforcementAction.WARN.value,
        conditions={
            "content_type": {
                "operator": "equals",
                "value": "text"
            }
        },
        exceptions=[]
    )
    db_session.add(rule)
    db_session.commit()
    return rule

@pytest.fixture
def sample_policy(db_session: Session, sample_rule: EnforcementRule):
    policy = EnforcementPolicy(
        id=str(uuid4()),
        name="Test Policy",
        description="A test policy",
        default_action=EnforcementAction.BLOCK.value,
        rules=[sample_rule]
    )
    db_session.add(policy)
    db_session.commit()
    return policy

def test_create_rule(enforcement_service: EnforcementService):
    rule_data = {
        "name": "Test Rule",
        "description": "A test rule",
        "capability": AICapability.NATURAL_LANGUAGE.value,
        "level": EnforcementLevel.MODERATE.value,
        "action": EnforcementAction.WARN.value,
        "conditions": {
            "content_type": {
                "operator": "equals",
                "value": "text"
            }
        },
        "exceptions": []
    }
    
    rule = enforcement_service.create_rule(rule_data)
    assert rule.name == rule_data["name"]
    assert rule.capability == rule_data["capability"]
    assert rule.conditions == rule_data["conditions"]

def test_create_policy(enforcement_service: EnforcementService, sample_rule: EnforcementRule):
    policy_data = {
        "name": "Test Policy",
        "description": "A test policy",
        "default_action": EnforcementAction.BLOCK.value,
    }
    
    policy = enforcement_service.create_policy(policy_data, [sample_rule.id])
    assert policy.name == policy_data["name"]
    assert policy.default_action == policy_data["default_action"]
    assert len(policy.rules) == 1
    assert policy.rules[0].id == sample_rule.id

def test_evaluate_request_matching_rule(enforcement_service: EnforcementService, sample_policy: EnforcementPolicy):
    request_data = {
        "content_type": "text",
        "text": "Hello, world!"
    }
    
    action = enforcement_service.evaluate_request(
        capability=AICapability.NATURAL_LANGUAGE,
        user_id="test_user",
        organization_id="test_org",
        request_data=request_data
    )
    
    assert action == EnforcementAction.WARN

def test_evaluate_request_no_matching_rule(enforcement_service: EnforcementService, sample_policy: EnforcementPolicy):
    request_data = {
        "content_type": "image",
        "url": "https://example.com/image.jpg"
    }
    
    action = enforcement_service.evaluate_request(
        capability=AICapability.IMAGE_GENERATION,
        user_id="test_user",
        organization_id="test_org",
        request_data=request_data
    )
    
    assert action == EnforcementAction.BLOCK

def test_evaluate_request_with_exception(enforcement_service: EnforcementService, db_session: Session, sample_rule: EnforcementRule):
    # Add an exception to the rule
    sample_rule.exceptions = ["test_user"]
    db_session.commit()
    
    request_data = {
        "content_type": "text",
        "text": "Hello, world!"
    }
    
    action = enforcement_service.evaluate_request(
        capability=AICapability.NATURAL_LANGUAGE,
        user_id="test_user",
        organization_id="test_org",
        request_data=request_data
    )
    
    # Should fall through to the next applicable rule or default action
    assert action == EnforcementAction.BLOCK

def test_audit_log_creation(enforcement_service: EnforcementService, sample_policy: EnforcementPolicy, db_session: Session):
    request_data = {
        "content_type": "text",
        "text": "Hello, world!"
    }
    
    enforcement_service.evaluate_request(
        capability=AICapability.NATURAL_LANGUAGE,
        user_id="test_user",
        organization_id="test_org",
        request_data=request_data
    )
    
    # Check that an audit log was created
    audit_log = db_session.query(EnforcementAuditLog).first()
    assert audit_log is not None
    assert audit_log.user_id == "test_user"
    assert audit_log.organization_id == "test_org"
    assert audit_log.capability == AICapability.NATURAL_LANGUAGE.value
    assert audit_log.request_data == request_data

def test_update_rule(enforcement_service: EnforcementService, sample_rule: EnforcementRule):
    update_data = {
        "name": "Updated Rule",
        "level": EnforcementLevel.STRICT.value
    }
    
    updated_rule = enforcement_service.update_rule(sample_rule.id, update_data)
    assert updated_rule.name == update_data["name"]
    assert updated_rule.level == update_data["level"]
    # Original data should be preserved
    assert updated_rule.capability == sample_rule.capability

def test_update_policy(enforcement_service: EnforcementService, sample_policy: EnforcementPolicy):
    update_data = {
        "name": "Updated Policy",
        "default_action": EnforcementAction.WARN.value
    }
    
    updated_policy = enforcement_service.update_policy(sample_policy.id, update_data)
    assert updated_policy.name == update_data["name"]
    assert updated_policy.default_action == update_data["default_action"]
    # Original data should be preserved
    assert len(updated_policy.rules) == len(sample_policy.rules)

def test_get_audit_logs(enforcement_service: EnforcementService, sample_policy: EnforcementPolicy):
    # Create some audit logs
    for i in range(5):
        request_data = {
            "content_type": "text",
            "text": f"Test {i}"
        }
        enforcement_service.evaluate_request(
            capability=AICapability.NATURAL_LANGUAGE,
            user_id="test_user",
            organization_id="test_org",
            request_data=request_data
        )
    
    # Test filtering
    logs = enforcement_service.get_audit_logs(
        user_id="test_user",
        organization_id="test_org",
        limit=3
    )
    
    assert len(logs) == 3
    assert all(log.user_id == "test_user" for log in logs)
    assert all(log.organization_id == "test_org" for log in logs) 