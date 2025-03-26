from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.monitoring import MonitoringService
from app.core.enforcement import AICapability, EnforcementAction, EnforcementLevel
from app.schemas.monitoring import (
    MetricsResponse,
    AIPerformanceMetrics,
    SecurityMetrics,
    AutomationMetrics,
    IntegrationHealthMetrics,
    RiskAlert
)

router = APIRouter()

@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    time_range: str = Query("24h", description="Time range for metrics (1h, 24h, 7d, 30d)"),
    organization_id: Optional[str] = Query(None, description="Filter by organization ID"),
    db: Session = Depends(get_db)
):
    """Get comprehensive platform metrics including enforcement, AI performance, security, and automation."""
    monitoring_service = MonitoringService(db)
    
    # Convert time range to days for the service method
    days = {
        "1h": 1/24,
        "24h": 1,
        "7d": 7,
        "30d": 30
    }.get(time_range, 1)
    
    try:
        metrics = monitoring_service.get_enforcement_stats(
            start_time=datetime.utcnow() - timedelta(days=days),
            organization_id=organization_id
        )
        
        # Check for critical issues and generate risk alerts
        risk_alerts = []
        
        # Check AI performance
        if metrics["ai_performance"]["prediction_accuracy"] < 85:
            risk_alerts.append(RiskAlert(
                severity="warning",
                category="ai_performance",
                message="AI prediction accuracy below threshold",
                metric_value=metrics["ai_performance"]["prediction_accuracy"],
                threshold=85.0
            ))
        
        # Check security metrics
        if metrics["security_metrics"]["encryption_status"] != "AES-256":
            risk_alerts.append(RiskAlert(
                severity="critical",
                category="security",
                message="Non-standard encryption in use",
                metric_value=metrics["security_metrics"]["encryption_status"],
                threshold="AES-256"
            ))
        
        if metrics["security_metrics"]["audit_log_completeness"] < 95:
            risk_alerts.append(RiskAlert(
                severity="warning",
                category="security",
                message="Audit log completeness below threshold",
                metric_value=metrics["security_metrics"]["audit_log_completeness"],
                threshold=95.0
            ))
        
        # Check integration health
        for integration in metrics["integration_health"]:
            if integration["status"] == "unhealthy":
                risk_alerts.append(RiskAlert(
                    severity="critical",
                    category="integration",
                    message=f"Integration {integration['name']} is unhealthy",
                    metric_value=integration["success_rate"],
                    threshold=90.0
                ))
        
        # Add risk alerts to the response
        metrics["risk_alerts"] = risk_alerts
        
        return metrics
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching metrics: {str(e)}"
        )

@router.get("/ai-performance", response_model=AIPerformanceMetrics)
async def get_ai_performance(
    db: Session = Depends(get_db)
):
    """Get detailed AI model performance metrics."""
    monitoring_service = MonitoringService(db)
    return monitoring_service.get_ai_performance_metrics()

@router.get("/security", response_model=SecurityMetrics)
async def get_security_metrics(
    db: Session = Depends(get_db)
):
    """Get detailed security and compliance metrics."""
    monitoring_service = MonitoringService(db)
    return monitoring_service.get_security_metrics()

@router.get("/automation", response_model=AutomationMetrics)
async def get_automation_metrics(
    db: Session = Depends(get_db)
):
    """Get detailed automation effectiveness metrics."""
    monitoring_service = MonitoringService(db)
    return monitoring_service.get_automation_metrics()

@router.get("/integration-health", response_model=List[IntegrationHealthMetrics])
async def get_integration_health(
    db: Session = Depends(get_db)
):
    """Get health metrics for all integrations."""
    monitoring_service = MonitoringService(db)
    return monitoring_service.get_integration_health()

@router.get("/capabilities")
async def get_capabilities():
    """Get list of available AI capabilities."""
    return [capability.value for capability in AICapability]

@router.get("/enforcement-levels")
async def get_enforcement_levels():
    """Get list of available enforcement levels."""
    return [level.value for level in EnforcementLevel]

@router.get("/enforcement-actions")
async def get_enforcement_actions():
    """Get list of available enforcement actions."""
    return [action.value for action in EnforcementAction] 