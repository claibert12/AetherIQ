from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from prometheus_client import Counter, Histogram, Gauge
import psutil
import json
from cryptography.fernet import Fernet

from app.models.enforcement import EnforcementAuditLog, EnforcementRule
from app.core.enforcement import AICapability, EnforcementAction, EnforcementLevel
from app.models.automation import AutomatedWorkflow, WorkflowExecution
from app.models.integration import IntegrationConfig, IntegrationMetrics
from app.core.security import SecurityConfig
from app.core.ml import ModelRegistry, ModelMetrics

# Prometheus metrics
enforcement_requests_total = Counter(
    'enforcement_requests_total',
    'Total number of enforcement requests',
    ['capability', 'action', 'organization_id']
)

enforcement_request_duration = Histogram(
    'enforcement_request_duration_seconds',
    'Time spent processing enforcement requests',
    ['capability']
)

active_rules_gauge = Gauge(
    'active_rules_total',
    'Number of active enforcement rules',
    ['capability', 'level']
)

# New metrics
ai_prediction_accuracy = Gauge(
    'ai_prediction_accuracy',
    'AI model prediction accuracy',
    ['model_version']
)

ai_latency = Histogram(
    'ai_latency_seconds',
    'AI model inference latency',
    ['model_version']
)

automation_ratio = Gauge(
    'automation_ratio',
    'Ratio of automated vs manual workflows',
    ['organization_id']
)

integration_health = Gauge(
    'integration_health',
    'Integration health status',
    ['integration_name', 'metric']
)

class MonitoringService:
    def __init__(self, db: Session):
        self.db = db
        self.model_registry = ModelRegistry()
        self.security_config = SecurityConfig()

    def record_request(
        self,
        capability: AICapability,
        action: EnforcementAction,
        organization_id: str,
        duration: float
    ) -> None:
        """Record metrics for an enforcement request."""
        enforcement_requests_total.labels(
            capability=capability.value,
            action=action.value,
            organization_id=organization_id
        ).inc()

        enforcement_request_duration.labels(
            capability=capability.value
        ).observe(duration)

    def update_active_rules_metrics(self) -> None:
        """Update metrics for active rules."""
        # Reset all gauges
        active_rules_gauge._metrics.clear()

        # Count active rules by capability and level
        counts = (
            self.db.query(
                EnforcementRule.capability,
                EnforcementRule.level,
                func.count(EnforcementRule.id)
            )
            .filter(EnforcementRule.is_active == True)
            .group_by(EnforcementRule.capability, EnforcementRule.level)
            .all()
        )

        for capability, level, count in counts:
            active_rules_gauge.labels(
                capability=capability,
                level=level
            ).set(count)

    def get_ai_performance_metrics(self) -> Dict[str, any]:
        """Get AI model performance metrics."""
        current_model = self.model_registry.get_current_model()
        metrics = ModelMetrics.get_latest(current_model.version)
        
        return {
            "prediction_accuracy": metrics.accuracy * 100,
            "average_latency": metrics.average_latency_ms,
            "model_version": current_model.version,
            "training_status": current_model.status
        }

    def get_security_metrics(self) -> Dict[str, any]:
        """Get security and compliance metrics."""
        config = self.security_config.get_current_config()
        audit_completeness = self._calculate_audit_log_completeness()
        
        return {
            "encryption_status": config.encryption_algorithm,
            "unauthorized_attempts": self._count_unauthorized_attempts(),
            "compliance_status": {
                "SOC2": config.is_soc2_compliant(),
                "GDPR": config.is_gdpr_compliant(),
                "HIPAA": config.is_hipaa_compliant()
            },
            "audit_log_completeness": audit_completeness
        }

    def get_automation_metrics(self) -> Dict[str, any]:
        """Get automation effectiveness metrics."""
        automated = self.db.query(func.count(AutomatedWorkflow.id))\
            .filter(AutomatedWorkflow.is_active == True).scalar()
        
        manual = self.db.query(func.count(AutomatedWorkflow.id))\
            .filter(AutomatedWorkflow.is_active == False).scalar()
        
        suggestions = self.db.query(func.count(AutomatedWorkflow.id))\
            .filter(AutomatedWorkflow.status == 'suggested').scalar()
        
        # Calculate efficiency gain
        current_period = self.db.query(func.avg(WorkflowExecution.duration))\
            .filter(WorkflowExecution.timestamp >= datetime.utcnow() - timedelta(days=30)).scalar()
        
        previous_period = self.db.query(func.avg(WorkflowExecution.duration))\
            .filter(
                WorkflowExecution.timestamp >= datetime.utcnow() - timedelta(days=60),
                WorkflowExecution.timestamp < datetime.utcnow() - timedelta(days=30)
            ).scalar()
        
        efficiency_gain = ((previous_period - current_period) / previous_period * 100) if previous_period else 0
        
        return {
            "automated_workflows": automated,
            "manual_workflows": manual,
            "automation_suggestions": suggestions,
            "efficiency_gain": efficiency_gain
        }

    def get_integration_health(self) -> List[Dict[str, any]]:
        """Get health metrics for all integrations."""
        metrics = (
            self.db.query(
                IntegrationConfig,
                IntegrationMetrics
            )
            .join(IntegrationMetrics)
            .filter(IntegrationConfig.is_active == True)
            .all()
        )
        
        return [{
            "name": config.name,
            "status": self._calculate_integration_status(metric),
            "latency": metric.average_latency_ms,
            "success_rate": metric.success_rate * 100
        } for config, metric in metrics]

    def get_enforcement_stats(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        organization_id: Optional[str] = None
    ) -> Dict[str, any]:
        """Get enforcement statistics for a given time period."""
        query = self.db.query(EnforcementAuditLog)

        if start_time:
            query = query.filter(EnforcementAuditLog.timestamp >= start_time)
        if end_time:
            query = query.filter(EnforcementAuditLog.timestamp <= end_time)
        if organization_id:
            query = query.filter(EnforcementAuditLog.organization_id == organization_id)

        total_requests = query.count()
        
        # Get counts by action
        action_counts = (
            query.with_entities(
                EnforcementAuditLog.action_taken,
                func.count(EnforcementAuditLog.id)
            )
            .group_by(EnforcementAuditLog.action_taken)
            .all()
        )
        
        # Get counts by capability
        capability_counts = (
            query.with_entities(
                EnforcementAuditLog.capability,
                func.count(EnforcementAuditLog.id)
            )
            .group_by(EnforcementAuditLog.capability)
            .all()
        )

        # Get daily request counts
        daily_requests = (
            query.with_entities(
                func.date_trunc('day', EnforcementAuditLog.timestamp).label('day'),
                func.count(EnforcementAuditLog.id)
            )
            .group_by('day')
            .order_by('day')
            .all()
        )

        return {
            "total_requests": total_requests,
            "actions": {
                action: count
                for action, count in action_counts
            },
            "capabilities": {
                capability: count
                for capability, count in capability_counts
            },
            "daily_requests": [
                {
                    "date": day.isoformat(),
                    "count": count
                }
                for day, count in daily_requests
            ],
            "ai_performance": self.get_ai_performance_metrics(),
            "security_metrics": self.get_security_metrics(),
            "automation_metrics": self.get_automation_metrics(),
            "integration_health": self.get_integration_health()
        }

    def _calculate_audit_log_completeness(self) -> float:
        """Calculate the completeness of audit logs."""
        total_events = self.db.query(func.count(EnforcementAuditLog.id)).scalar()
        complete_events = self.db.query(func.count(EnforcementAuditLog.id))\
            .filter(
                EnforcementAuditLog.metadata.isnot(None),
                EnforcementAuditLog.request_data.isnot(None)
            ).scalar()
        
        return (complete_events / total_events * 100) if total_events > 0 else 100

    def _count_unauthorized_attempts(self) -> int:
        """Count unauthorized access attempts in the last 24 hours."""
        return self.db.query(func.count(EnforcementAuditLog.id))\
            .filter(
                EnforcementAuditLog.timestamp >= datetime.utcnow() - timedelta(hours=24),
                EnforcementAuditLog.action_taken == EnforcementAction.BLOCK.value,
                EnforcementAuditLog.metadata['reason'].astext == 'unauthorized_access'
            ).scalar()

    def _calculate_integration_status(self, metrics: IntegrationMetrics) -> str:
        """Calculate integration status based on metrics."""
        if metrics.success_rate >= 0.98 and metrics.average_latency_ms < 1000:
            return "healthy"
        elif metrics.success_rate >= 0.90 and metrics.average_latency_ms < 2000:
            return "degraded"
        else:
            return "unhealthy" 