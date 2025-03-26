from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class DailyRequest(BaseModel):
    date: str = Field(..., description="ISO formatted date")
    count: int = Field(..., description="Number of requests for the day")

class CommonPattern(BaseModel):
    capability: str = Field(..., description="AI capability type")
    action: str = Field(..., description="Enforcement action taken")
    count: int = Field(..., description="Number of occurrences")

class AIPerformanceMetrics(BaseModel):
    prediction_accuracy: float = Field(..., description="Model prediction accuracy percentage", ge=0, le=100)
    average_latency: float = Field(..., description="Average model inference latency in milliseconds", ge=0)
    model_version: str = Field(..., description="Current model version identifier")
    training_status: str = Field(..., description="Current model training status")

class SecurityMetrics(BaseModel):
    encryption_status: str = Field(..., description="Current encryption algorithm in use")
    unauthorized_attempts: int = Field(..., description="Number of unauthorized access attempts in last 24h", ge=0)
    compliance_status: Dict[str, bool] = Field(..., description="Compliance status for various standards")
    audit_log_completeness: float = Field(..., description="Percentage of complete audit logs", ge=0, le=100)

class AutomationMetrics(BaseModel):
    automated_workflows: int = Field(..., description="Number of active automated workflows", ge=0)
    manual_workflows: int = Field(..., description="Number of manual workflows", ge=0)
    automation_suggestions: int = Field(..., description="Number of pending automation suggestions", ge=0)
    efficiency_gain: float = Field(..., description="Efficiency improvement percentage vs previous period")

class IntegrationHealthMetrics(BaseModel):
    name: str = Field(..., description="Integration name")
    status: str = Field(..., description="Current health status (healthy, degraded, unhealthy)")
    latency: float = Field(..., description="Average latency in milliseconds", ge=0)
    success_rate: float = Field(..., description="Success rate percentage", ge=0, le=100)

class RiskAlert(BaseModel):
    severity: str = Field(..., description="Alert severity level (critical, warning, info)")
    category: str = Field(..., description="Alert category (ai_performance, security, automation, integration)")
    message: str = Field(..., description="Alert message")
    metric_value: float = Field(..., description="Current value that triggered the alert")
    threshold: float = Field(..., description="Threshold value that was exceeded")

class MetricsResponse(BaseModel):
    total_requests: int = Field(..., description="Total number of requests in the period", ge=0)
    actions: Dict[str, int] = Field(..., description="Count of requests by enforcement action")
    capabilities: Dict[str, int] = Field(..., description="Count of requests by AI capability")
    daily_requests: List[DailyRequest] = Field(..., description="Daily request counts")
    common_patterns: List[CommonPattern] = Field(..., description="Most common request patterns")
    ai_performance: AIPerformanceMetrics = Field(..., description="AI model performance metrics")
    security_metrics: SecurityMetrics = Field(..., description="Security and compliance metrics")
    automation_metrics: AutomationMetrics = Field(..., description="Automation effectiveness metrics")
    integration_health: List[IntegrationHealthMetrics] = Field(..., description="Integration health metrics")
    risk_alerts: List[RiskAlert] = Field(..., description="Active risk alerts") 