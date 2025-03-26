import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from sqlalchemy.orm import Session

from app.core.enforcement import AICapability, EnforcementAction, EnforcementLevel
from app.services.monitoring import MonitoringService
from app.models.enforcement import EnforcementRule, EnforcementAuditLog

@pytest.fixture
def monitoring_service(db_session: Session):
    return MonitoringService(db_session)

@pytest.fixture
def sample_audit_logs(db_session: Session, sample_rule: EnforcementRule):
    """Create sample audit logs for testing."""
    logs = []
    for i in range(10):
        log = EnforcementAuditLog(
            id=str(uuid4()),
            timestamp=datetime.utcnow() - timedelta(hours=i),
            user_id="test_user",
            organization_id="test_org",
            capability=AICapability.NATURAL_LANGUAGE.value,
            request_data={"content": f"Test request {i}"},
            applied_rule_id=sample_rule.id,
            action_taken=EnforcementAction.BLOCK.value if i % 2 == 0 else EnforcementAction.WARN.value,
            metadata={}
        )
        logs.append(log)
    
    db_session.add_all(logs)
    db_session.commit()
    return logs

def test_get_enforcement_stats(monitoring_service: MonitoringService, sample_audit_logs):
    """Test getting enforcement statistics."""
    stats = monitoring_service.get_enforcement_stats(
        start_time=datetime.utcnow() - timedelta(days=1)
    )
    
    assert stats["total_requests"] == 10
    assert stats["actions"][EnforcementAction.BLOCK.value] == 5
    assert stats["actions"][EnforcementAction.WARN.value] == 5
    assert stats["capabilities"][AICapability.NATURAL_LANGUAGE.value] == 10

def test_get_organization_stats(monitoring_service: MonitoringService, sample_audit_logs):
    """Test getting organization-specific statistics."""
    stats = monitoring_service.get_organization_stats(
        organization_id="test_org",
        days=1
    )
    
    assert stats["total_requests"] == 10
    assert len(stats["daily_requests"]) > 0
    assert len(stats["common_patterns"]) > 0

def test_get_rule_effectiveness(monitoring_service: MonitoringService, sample_audit_logs):
    """Test analyzing rule effectiveness."""
    effectiveness = monitoring_service.get_rule_effectiveness(days=1)
    
    assert len(effectiveness) > 0
    first_rule = effectiveness[0]
    assert "rule_id" in first_rule
    assert "effectiveness_score" in first_rule
    assert first_rule["blocks"] == 5
    assert first_rule["warnings"] == 5

def test_update_active_rules_metrics(monitoring_service: MonitoringService, db_session: Session):
    """Test updating active rules metrics."""
    # Create some rules with different capabilities and levels
    rules = []
    for capability in [AICapability.NATURAL_LANGUAGE, AICapability.IMAGE_GENERATION]:
        for level in [EnforcementLevel.STRICT, EnforcementLevel.MODERATE]:
            rule = EnforcementRule(
                id=str(uuid4()),
                name=f"Test Rule {capability.value} {level.value}",
                description="Test rule",
                capability=capability.value,
                level=level.value,
                action=EnforcementAction.BLOCK.value,
                conditions={},
                exceptions=[],
                is_active=True
            )
            rules.append(rule)
    
    db_session.add_all(rules)
    db_session.commit()
    
    # Update metrics
    monitoring_service.update_active_rules_metrics()
    
    # The metrics should be updated in Prometheus
    # In a real test, we would verify the Prometheus metrics
    # For now, we just verify the function runs without errors
    pass

def test_record_request(monitoring_service: MonitoringService):
    """Test recording request metrics."""
    monitoring_service.record_request(
        capability=AICapability.NATURAL_LANGUAGE,
        action=EnforcementAction.BLOCK,
        organization_id="test_org",
        duration=0.1
    )
    
    # In a real test, we would verify the Prometheus metrics
    # For now, we just verify the function runs without errors
    pass 