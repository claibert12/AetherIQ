from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.security import oauth2_scheme
from app.db.base import get_db
from app.db import models
from app.core.security import verify_password

router = APIRouter()

@router.post("/workflows/", response_model=dict)
async def create_workflow(
    workflow_data: dict,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    # Get current user from token
    user = db.query(models.User).filter(models.User.id == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create new workflow
    workflow = models.Workflow(
        name=workflow_data["name"],
        description=workflow_data.get("description", ""),
        definition=workflow_data["definition"],
        tenant_id=user.tenant_id,
        created_by_id=user.id
    )
    
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    
    return {
        "id": workflow.id,
        "name": workflow.name,
        "status": workflow.status,
        "created_at": workflow.created_at
    }

@router.get("/workflows/", response_model=List[dict])
async def list_workflows(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    # Get current user from token
    user = db.query(models.User).filter(models.User.id == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get workflows for tenant
    workflows = db.query(models.Workflow)\
        .filter(models.Workflow.tenant_id == user.tenant_id)\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return [
        {
            "id": w.id,
            "name": w.name,
            "description": w.description,
            "status": w.status,
            "created_at": w.created_at,
            "updated_at": w.updated_at
        }
        for w in workflows
    ]

@router.get("/workflows/{workflow_id}", response_model=dict)
async def get_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    # Get current user from token
    user = db.query(models.User).filter(models.User.id == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get workflow
    workflow = db.query(models.Workflow)\
        .filter(
            models.Workflow.id == workflow_id,
            models.Workflow.tenant_id == user.tenant_id
        )\
        .first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return {
        "id": workflow.id,
        "name": workflow.name,
        "description": workflow.description,
        "definition": workflow.definition,
        "status": workflow.status,
        "created_at": workflow.created_at,
        "updated_at": workflow.updated_at
    }

@router.put("/workflows/{workflow_id}", response_model=dict)
async def update_workflow(
    workflow_id: int,
    workflow_data: dict,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    # Get current user from token
    user = db.query(models.User).filter(models.User.id == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get workflow
    workflow = db.query(models.Workflow)\
        .filter(
            models.Workflow.id == workflow_id,
            models.Workflow.tenant_id == user.tenant_id
        )\
        .first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Update workflow
    for key, value in workflow_data.items():
        setattr(workflow, key, value)
    
    db.commit()
    db.refresh(workflow)
    
    return {
        "id": workflow.id,
        "name": workflow.name,
        "description": workflow.description,
        "status": workflow.status,
        "updated_at": workflow.updated_at
    }

@router.post("/workflows/{workflow_id}/execute", response_model=dict)
async def execute_workflow(
    workflow_id: int,
    input_data: dict,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    # Get current user from token
    user = db.query(models.User).filter(models.User.id == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get workflow
    workflow = db.query(models.Workflow)\
        .filter(
            models.Workflow.id == workflow_id,
            models.Workflow.tenant_id == user.tenant_id
        )\
        .first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if workflow.status != models.WorkflowStatus.ACTIVE:
        raise HTTPException(
            status_code=400,
            detail="Workflow is not active"
        )
    
    # Create workflow execution
    execution = models.WorkflowExecution(
        workflow_id=workflow.id,
        input_data=input_data,
        status=models.WorkflowExecutionStatus.PENDING,
        started_at=datetime.utcnow()
    )
    
    db.add(execution)
    db.commit()
    db.refresh(execution)
    
    # TODO: Trigger workflow execution in background task
    
    return {
        "execution_id": execution.id,
        "status": execution.status,
        "started_at": execution.started_at
    } 