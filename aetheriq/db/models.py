"""
Database models for AetherIQ platform
"""

from datetime import datetime
import uuid
from typing import List, Optional
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.dialects.postgresql import UUID
import enum

Base = declarative_base()

class UserRole(enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"

class WorkflowStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class IntegrationType(enum.Enum):
    API = "api"
    DATABASE = "database"
    MESSAGE_QUEUE = "message_queue"
    FILE_SYSTEM = "file_system"
    CUSTOM = "custom"

class User(Base):
    """User model for authentication and authorization"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    workflows = relationship("Workflow", back_populates="owner")
    audit_logs = relationship("AuditLog", back_populates="user")

class Workflow(Base):
    """Workflow model for automation processes"""
    __tablename__ = "workflows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String)
    template_id = Column(String, nullable=False)
    parameters = Column(JSON)
    status = Column(SQLEnum(WorkflowStatus), nullable=False, default=WorkflowStatus.PENDING)
    priority = Column(Integer, default=0)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    # Relationships
    owner = relationship("User", back_populates="workflows")
    tasks = relationship("WorkflowTask", back_populates="workflow")
    analytics = relationship("Analytics", back_populates="workflow")

class WorkflowTask(Base):
    """Individual task within a workflow"""
    __tablename__ = "workflow_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"))
    name = Column(String, nullable=False)
    task_type = Column(String, nullable=False)
    parameters = Column(JSON)
    status = Column(SQLEnum(WorkflowStatus), nullable=False, default=WorkflowStatus.PENDING)
    result = Column(JSON)
    error_message = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    # Relationships
    workflow = relationship("Workflow", back_populates="tasks")

class Integration(Base):
    """External system integration configuration"""
    __tablename__ = "integrations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String)
    integration_type = Column(SQLEnum(IntegrationType), nullable=False)
    config = Column(JSON, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_health_check = Column(DateTime)
    health_status = Column(Boolean)

    # Relationships
    audit_logs = relationship("AuditLog", back_populates="integration")

class Analytics(Base):
    """Analytics data for workflows and system performance"""
    __tablename__ = "analytics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"))
    metric_name = Column(String, nullable=False)
    metric_value = Column(JSON, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    metadata = Column(JSON)

    # Relationships
    workflow = relationship("Workflow", back_populates="analytics")

class AuditLog(Base):
    """Audit logging for security and compliance"""
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    integration_id = Column(UUID(as_uuid=True), ForeignKey("integrations.id"))
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=False)
    resource_id = Column(String)
    details = Column(JSON)
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String)
    user_agent = Column(String)

    # Relationships
    user = relationship("User", back_populates="audit_logs")
    integration = relationship("Integration", back_populates="audit_logs")

class ComplianceCheck(Base):
    """Compliance check results"""
    __tablename__ = "compliance_checks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    framework = Column(String, nullable=False)
    resource_type = Column(String, nullable=False)
    resource_id = Column(String, nullable=False)
    check_result = Column(Boolean, nullable=False)
    details = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    remediation_steps = Column(JSON)
    severity = Column(String)

class SystemMetrics(Base):
    """System performance metrics"""
    __tablename__ = "system_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    metric_name = Column(String, nullable=False)
    metric_value = Column(JSON, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    metadata = Column(JSON) 