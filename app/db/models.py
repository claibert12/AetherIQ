from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, JSON, Enum, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.db.base import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    users = relationship("User", back_populates="tenant")
    workflows = relationship("Workflow", back_populates="tenant")
    integrations = relationship("Integration", back_populates="tenant")

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    role = Column(Enum(UserRole))
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    created_workflows = relationship("Workflow", back_populates="created_by")
    integrations = relationship("Integration", back_populates="created_by")

class WorkflowStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    definition = Column(JSON, nullable=False)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.DRAFT)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    last_optimized_at = Column(DateTime)
    optimization_score = Column(Float)
    risk_score = Column(Float)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="workflows")
    created_by = relationship("User", back_populates="created_workflows")
    executions = relationship("WorkflowExecution", back_populates="workflow")

class WorkflowExecutionStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime)
    status = Column(String, nullable=False)  # pending, running, completed, failed
    input_data = Column(JSON)
    output_data = Column(JSON)
    error_message = Column(String)
    execution_time = Column(Float)  # in seconds
    resource_usage = Column(JSON)  # CPU, memory, etc.
    optimization_suggestions = Column(JSON)
    risk_alerts = Column(JSON)
    
    # Relationships
    workflow = relationship("Workflow", back_populates="executions")

class OptimizationSuggestion(Base):
    __tablename__ = "optimization_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"))
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    suggestion_type = Column(String)  # e.g., "performance", "cost", "reliability"
    description = Column(String)
    potential_impact = Column(JSON)  # Estimated impact metrics
    created_at = Column(DateTime, default=datetime.utcnow)
    is_applied = Column(Boolean, default=False)
    applied_at = Column(DateTime)
    
    # Relationships
    workflow = relationship("Workflow")
    tenant = relationship("Tenant")

class Integration(Base):
    __tablename__ = "integrations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    type = Column(String)  # erp, itsm, security
    provider = Column(String)  # sap, oracle, servicenow, etc.
    base_url = Column(String)
    credentials = Column(JSON)  # Encrypted credentials
    settings = Column(JSON)  # Integration-specific settings
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    last_sync = Column(DateTime)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="integrations")
    created_by = relationship("User", back_populates="integrations")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String, nullable=False)  # encrypt, decrypt, key_rotation
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    resource_type = Column(String, nullable=False)  # encryption, key_rotation
    resource_id = Column(Integer)  # Optional reference to specific resource
    details = Column(JSON)  # Additional operation details
    status = Column(String, nullable=False)  # success, failed
    timestamp = Column(DateTime, nullable=False)
    
    # Relationships
    user = relationship("User")
    tenant = relationship("Tenant")

class ForensicAuditLog(Base):
    __tablename__ = "forensic_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action_type = Column(String, nullable=False)  # workflow_execution, integration_sync, etc.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    details = Column(JSON)  # Non-sensitive details
    encrypted_details = Column(JSON)  # Encrypted sensitive details
    risk_score = Column(Float, nullable=False, default=0.0)
    security_status = Column(String, nullable=False)  # normal, suspicious, blocked
    action_count = Column(Integer, nullable=False, default=1)
    resource_count = Column(Integer, nullable=False, default=0)
    data_size = Column(Integer, nullable=False, default=0)
    failure_count = Column(Integer, nullable=False, default=0)
    unique_users = Column(Integer, nullable=False, default=1)
    unique_resources = Column(Integer, nullable=False, default=0)
    hash = Column(String, nullable=False)  # Cryptographic hash for immutability
    
    # Relationships
    user = relationship("User")
    tenant = relationship("Tenant") 