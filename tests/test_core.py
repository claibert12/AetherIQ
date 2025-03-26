"""
Test suite for AetherIQ core functionality
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any

from aetheriq.core.automation import AutomationEngine
from aetheriq.core.analytics import AnalyticsEngine, AnalyticsConfig
from aetheriq.core.security import SecurityManager, SecurityConfig
from aetheriq.core.compliance import ComplianceManager, ComplianceConfig
from aetheriq.core.workflow import WorkflowEngine, WorkflowConfig
from aetheriq.core.integration import IntegrationManager, IntegrationConfig

@pytest.fixture
def automation_engine():
    """Create an AutomationEngine instance"""
    return AutomationEngine({})

@pytest.fixture
def analytics_engine():
    """Create an AnalyticsEngine instance"""
    return AnalyticsEngine(AnalyticsConfig())

@pytest.fixture
def security_manager():
    """Create a SecurityManager instance"""
    return SecurityManager(SecurityConfig())

@pytest.fixture
def compliance_manager():
    """Create a ComplianceManager instance"""
    return ComplianceManager(ComplianceConfig())

@pytest.fixture
def workflow_engine():
    """Create a WorkflowEngine instance"""
    return WorkflowEngine(WorkflowConfig())

@pytest.fixture
def integration_manager():
    """Create an IntegrationManager instance"""
    return IntegrationManager(IntegrationConfig())

@pytest.mark.asyncio
async def test_automation_engine(automation_engine):
    """Test AutomationEngine functionality"""
    # Test workflow creation
    workflow_id = await automation_engine.create_workflow(
        template_id="test_template",
        parameters={"param1": "value1"}
    )
    assert workflow_id is not None
    
    # Test workflow status
    status = await automation_engine.get_workflow_status(workflow_id)
    assert status is not None
    assert "status" in status

@pytest.mark.asyncio
async def test_analytics_engine(analytics_engine):
    """Test AnalyticsEngine functionality"""
    # Test data processing
    result = await analytics_engine.process_data(
        data={"key": "value"},
        data_type="test"
    )
    assert result is not None
    
    # Test report generation
    report = await analytics_engine.get_analytics_report(
        start_date=(datetime.now() - timedelta(days=7)).isoformat(),
        end_date=datetime.now().isoformat()
    )
    assert report is not None

@pytest.mark.asyncio
async def test_security_manager(security_manager):
    """Test SecurityManager functionality"""
    # Test user authentication
    token = await security_manager.authenticate_user(
        username="test_user",
        password="test_password"
    )
    assert token is not None
    
    # Test security report
    report = await security_manager.get_security_report(
        start_date=(datetime.now() - timedelta(days=7)).isoformat(),
        end_date=datetime.now().isoformat()
    )
    assert report is not None

@pytest.mark.asyncio
async def test_compliance_manager(compliance_manager):
    """Test ComplianceManager functionality"""
    # Test compliance check
    result = await compliance_manager.check_compliance(
        framework="test_framework",
        resource_id="test_resource",
        resource_type="test_type",
        data={"key": "value"}
    )
    assert result is not None
    
    # Test compliance report
    report = await compliance_manager.get_compliance_report(
        framework="test_framework",
        start_date=(datetime.now() - timedelta(days=7)).isoformat(),
        end_date=datetime.now().isoformat()
    )
    assert report is not None

@pytest.mark.asyncio
async def test_workflow_engine(workflow_engine):
    """Test WorkflowEngine functionality"""
    # Test workflow creation
    workflow_id = await workflow_engine.create_workflow(
        template_id="test_template",
        parameters={"param1": "value1"},
        priority=0
    )
    assert workflow_id is not None
    
    # Test workflow status
    status = await workflow_engine.get_workflow_status(workflow_id)
    assert status is not None
    assert "status" in status

@pytest.mark.asyncio
async def test_integration_manager(integration_manager):
    """Test IntegrationManager functionality"""
    # Test integration registration
    integration_id = await integration_manager.register_integration(
        id="test_integration",
        type="test_type",
        config={"key": "value"}
    )
    assert integration_id is not None
    
    # Test integration status
    status = await integration_manager.get_integration_status(integration_id)
    assert status is not None
    assert "status" in status

@pytest.mark.asyncio
async def test_end_to_end_workflow():
    """Test end-to-end workflow execution"""
    # Initialize all components
    automation = AutomationEngine({})
    analytics = AnalyticsEngine(AnalyticsConfig())
    security = SecurityManager(SecurityConfig())
    compliance = ComplianceManager(ComplianceConfig())
    workflow = WorkflowEngine(WorkflowConfig())
    integration = IntegrationManager(IntegrationConfig())
    
    # Create and execute a workflow
    workflow_id = await workflow.create_workflow(
        template_id="test_template",
        parameters={"param1": "value1"},
        priority=0
    )
    
    # Monitor workflow status
    status = await workflow.get_workflow_status(workflow_id)
    assert status is not None
    
    # Process analytics data
    analytics_result = await analytics.process_data(
        data={"workflow_id": workflow_id},
        data_type="workflow_execution"
    )
    assert analytics_result is not None
    
    # Check compliance
    compliance_result = await compliance.check_compliance(
        framework="test_framework",
        resource_id=workflow_id,
        resource_type="workflow",
        data={"status": status}
    )
    assert compliance_result is not None 