"""
Base Pydantic schemas for data validation
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, validator

class BaseSchema(BaseModel):
    """Base schema with common configuration"""
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            UUID: lambda v: str(v)
        }

class UserBase(BaseSchema):
    """Base schema for User data"""
    email: EmailStr
    full_name: Optional[str] = None
    role: str = Field(..., pattern="^(admin|manager|user)$")
    is_active: bool = True

class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: str = Field(..., min_length=8)

class UserUpdate(UserBase):
    """Schema for updating a user"""
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8)

class User(UserBase):
    """Schema for User model"""
    id: UUID
    created_at: datetime
    updated_at: datetime

class WorkflowBase(BaseSchema):
    """Base schema for Workflow data"""
    name: str
    description: Optional[str] = None
    template_id: str
    parameters: Optional[Dict[str, Any]] = None
    priority: int = 0

class WorkflowCreate(WorkflowBase):
    """Schema for creating a new workflow"""
    pass

class WorkflowUpdate(BaseSchema):
    """Schema for updating a workflow"""
    name: Optional[str] = None
    description: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    priority: Optional[int] = None
    status: Optional[str] = Field(None, pattern="^(pending|running|completed|failed|cancelled)$")

class Workflow(WorkflowBase):
    """Schema for Workflow model"""
    id: UUID
    status: str
    owner_id: UUID
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class WorkflowTaskBase(BaseSchema):
    """Base schema for WorkflowTask data"""
    name: str
    task_type: str
    parameters: Optional[Dict[str, Any]] = None

class WorkflowTaskCreate(WorkflowTaskBase):
    """Schema for creating a new workflow task"""
    workflow_id: UUID

class WorkflowTaskUpdate(BaseSchema):
    """Schema for updating a workflow task"""
    name: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    status: Optional[str] = Field(None, pattern="^(pending|running|completed|failed|cancelled)$")
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

class WorkflowTask(WorkflowTaskBase):
    """Schema for WorkflowTask model"""
    id: UUID
    workflow_id: UUID
    status: str
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class IntegrationBase(BaseSchema):
    """Base schema for Integration data"""
    name: str
    description: Optional[str] = None
    integration_type: str = Field(..., pattern="^(api|database|message_queue|file_system|custom)$")
    config: Dict[str, Any]

class IntegrationCreate(IntegrationBase):
    """Schema for creating a new integration"""
    pass

class IntegrationUpdate(BaseSchema):
    """Schema for updating an integration"""
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class Integration(IntegrationBase):
    """Schema for Integration model"""
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_health_check: Optional[datetime] = None
    health_status: Optional[bool] = None

class AnalyticsBase(BaseSchema):
    """Base schema for Analytics data"""
    metric_name: str
    metric_value: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None

class AnalyticsCreate(AnalyticsBase):
    """Schema for creating new analytics data"""
    workflow_id: UUID

class Analytics(AnalyticsBase):
    """Schema for Analytics model"""
    id: UUID
    workflow_id: UUID
    timestamp: datetime

class AuditLogBase(BaseSchema):
    """Base schema for AuditLog data"""
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class AuditLogCreate(AuditLogBase):
    """Schema for creating a new audit log"""
    user_id: UUID
    integration_id: Optional[UUID] = None

class AuditLog(AuditLogBase):
    """Schema for AuditLog model"""
    id: UUID
    user_id: UUID
    integration_id: Optional[UUID] = None
    timestamp: datetime

class ComplianceCheckBase(BaseSchema):
    """Base schema for ComplianceCheck data"""
    framework: str
    resource_type: str
    resource_id: str
    check_result: bool
    details: Optional[Dict[str, Any]] = None
    remediation_steps: Optional[Dict[str, Any]] = None
    severity: Optional[str] = None

class ComplianceCheckCreate(ComplianceCheckBase):
    """Schema for creating a new compliance check"""
    pass

class ComplianceCheck(ComplianceCheckBase):
    """Schema for ComplianceCheck model"""
    id: UUID
    created_at: datetime

class SystemMetricsBase(BaseSchema):
    """Base schema for SystemMetrics data"""
    metric_name: str
    metric_value: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None

class SystemMetricsCreate(SystemMetricsBase):
    """Schema for creating new system metrics"""
    pass

class SystemMetrics(SystemMetricsBase):
    """Schema for SystemMetrics model"""
    id: UUID
    timestamp: datetime 