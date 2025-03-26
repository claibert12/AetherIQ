from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None
    definition: Dict[str, Any]
    status: str = "active"
    optimization_config: Optional[Dict[str, Any]] = None

class WorkflowCreate(WorkflowBase):
    tenant_id: int

class WorkflowUpdate(WorkflowBase):
    pass

class WorkflowResponse(WorkflowBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class WorkflowMetrics(BaseModel):
    workflow_id: int
    name: str
    total_executions: int
    avg_execution_time: float
    max_execution_time: float
    min_execution_time: float
    failed_executions: int
    tenant_id: int

class WorkflowExecution(BaseModel):
    id: int
    workflow_id: int
    started_at: datetime
    completed_at: Optional[datetime]
    status: str
    input_data: Dict[str, Any]
    output_data: Optional[Dict[str, Any]]
    error_message: Optional[str]
    execution_time: Optional[float]
    resource_usage: Dict[str, Any]
    optimization_suggestions: Optional[Dict[str, Any]]
    risk_alerts: Optional[Dict[str, Any]]
    tenant_id: int

class WorkflowOptimization(BaseModel):
    id: int
    workflow_id: int
    workflow_name: str
    optimization_plan: Dict[str, Any]
    status: str
    applied_at: datetime
    results: Optional[Dict[str, Any]] 