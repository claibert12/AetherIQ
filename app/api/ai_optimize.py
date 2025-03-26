from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime

from app.core.security import oauth2_scheme
from app.db.base import get_db
from app.db import models
from app.services.ai_optimization import WorkflowOptimizer

router = APIRouter()

@router.post("/ai-optimize/workflow/{workflow_id}/analyze", response_model=Dict[str, Any])
async def analyze_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    """Analyze workflow and generate optimization suggestions"""
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
    
    # Get workflow executions
    executions = db.query(models.WorkflowExecution)\
        .filter(models.WorkflowExecution.workflow_id == workflow_id)\
        .order_by(models.WorkflowExecution.started_at.desc())\
        .limit(100)\
        .all()
    
    # Initialize optimizer
    optimizer = WorkflowOptimizer()
    
    # Train model if we have enough data
    if len(executions) >= 10:
        optimizer.train(executions)
    
    # Generate suggestions
    suggestions = optimizer.generate_optimization_suggestions(
        workflow=workflow.__dict__,
        executions=[e.__dict__ for e in executions]
    )
    
    # Calculate risk score
    risk_score = optimizer.calculate_risk_score(
        workflow=workflow.__dict__,
        executions=[e.__dict__ for e in executions]
    )
    
    return {
        "workflow_id": workflow_id,
        "timestamp": datetime.utcnow().isoformat(),
        "risk_score": risk_score,
        "suggestions": suggestions,
        "execution_stats": {
            "total_executions": len(executions),
            "success_rate": len([e for e in executions if e.status == "completed"]) / len(executions) if executions else 0,
            "average_duration": sum((e.completed_at - e.started_at).total_seconds() for e in executions) / len(executions) if executions else 0
        }
    }

@router.post("/ai-optimize/workflow/{workflow_id}/predict", response_model=Dict[str, Any])
async def predict_workflow_performance(
    workflow_id: int,
    input_data: Dict[str, Any],
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    """Predict workflow performance for given input data"""
    user = db.query(models.User).filter(models.User.id == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    workflow = db.query(models.Workflow)\
        .filter(
            models.Workflow.id == workflow_id,
            models.Workflow.tenant_id == user.tenant_id
        )\
        .first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Get recent executions for training
    executions = db.query(models.WorkflowExecution)\
        .filter(models.WorkflowExecution.workflow_id == workflow_id)\
        .order_by(models.WorkflowExecution.started_at.desc())\
        .limit(100)\
        .all()
    
    if len(executions) < 10:
        raise HTTPException(
            status_code=400,
            detail="Not enough historical data for prediction"
        )
    
    # Initialize and train optimizer
    optimizer = WorkflowOptimizer()
    optimizer.train(executions)
    
    # Prepare input data for prediction
    execution_data = {
        "input_data_size": len(str(input_data)),
        "output_data_size": 0,  # Will be updated after execution
        "has_error": 0,
        "status_encoded": 0,
        "started_at": datetime.utcnow(),
        "completed_at": None,
        "error_message": None,
        "status": "pending"
    }
    
    # Get prediction
    predicted_time = optimizer.predict_execution_time(execution_data)
    
    return {
        "workflow_id": workflow_id,
        "timestamp": datetime.utcnow().isoformat(),
        "predicted_execution_time": predicted_time,
        "confidence": 0.85,  # This could be calculated based on model performance
        "input_data_size": execution_data["input_data_size"]
    }

@router.get("/ai-optimize/workflow/{workflow_id}/bottlenecks", response_model=List[Dict[str, Any]])
async def get_workflow_bottlenecks(
    workflow_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    """Get current workflow bottlenecks"""
    user = db.query(models.User).filter(models.User.id == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    workflow = db.query(models.Workflow)\
        .filter(
            models.Workflow.id == workflow_id,
            models.Workflow.tenant_id == user.tenant_id
        )\
        .first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Get recent executions
    executions = db.query(models.WorkflowExecution)\
        .filter(models.WorkflowExecution.workflow_id == workflow_id)\
        .order_by(models.WorkflowExecution.started_at.desc())\
        .limit(100)\
        .all()
    
    # Initialize optimizer
    optimizer = WorkflowOptimizer()
    
    # Analyze bottlenecks
    bottlenecks = optimizer.analyze_bottlenecks([e.__dict__ for e in executions])
    
    return bottlenecks 