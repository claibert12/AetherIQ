from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging

from app.core.security import get_current_user
from app.db.base import get_db
from app.db import models
from app.services.db_optimization import DatabaseOptimizer

router = APIRouter()
logger = logging.getLogger(__name__)

class QueryOptimizationRequest(BaseModel):
    query: str
    params: Optional[Dict[str, Any]] = None

class PerformanceMetricsRequest(BaseModel):
    days: Optional[int] = 30
    metrics: Optional[List[str]] = None

@router.post("/optimize", response_model=Dict[str, Any])
async def optimize_query(
    request: QueryOptimizationRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Optimize a database query using AI"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can optimize queries"
        )
    
    try:
        # Initialize database optimizer
        optimizer = DatabaseOptimizer(db, {})
        
        # Optimize query
        result = optimizer.optimize_query(request.query, request.params)
        
        return result
    except Exception as e:
        logger.error(f"Query optimization failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to optimize query: {str(e)}"
        )

@router.get("/metrics", response_model=Dict[str, Any])
async def get_performance_metrics(
    request: PerformanceMetricsRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get database performance metrics"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view performance metrics"
        )
    
    try:
        # Initialize database optimizer
        optimizer = DatabaseOptimizer(db, {})
        
        # Get performance metrics
        metrics = optimizer.get_performance_metrics()
        
        return metrics
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get performance metrics: {str(e)}"
        )

@router.get("/health", response_model=Dict[str, Any])
async def get_database_health(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get database health status"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view database health"
        )
    
    try:
        # Get database health metrics
        result = db.execute("SELECT * FROM v_database_health").first()
        
        return {
            "check_time": result.check_time,
            "active_connections": result.active_connections,
            "idle_connections": result.idle_connections,
            "waiting_connections": result.waiting_connections,
            "cache_hit_ratio": result.cache_hit_ratio,
            "tables_needing_vacuum": result.tables_needing_vacuum
        }
    except Exception as e:
        logger.error(f"Failed to get database health: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get database health: {str(e)}"
        )

@router.get("/replica-status", response_model=Dict[str, Any])
async def get_replica_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get database replica status"""
    if current_user.role not in [models.UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view replica status"
        )
    
    try:
        # Get replica status
        result = db.execute("SELECT check_replica_status()").scalar()
        
        return result
    except Exception as e:
        logger.error(f"Failed to get replica status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get replica status: {str(e)}"
        )

@router.post("/maintenance", response_model=Dict[str, Any])
async def run_maintenance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Run database maintenance tasks"""
    if current_user.role not in [models.UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can run maintenance tasks"
        )
    
    try:
        # Run maintenance tasks
        db.execute("SELECT maintain_tables()")
        db.execute("SELECT maintain_indexes()")
        db.execute("SELECT refresh_materialized_views()")
        db.commit()
        
        return {
            "status": "success",
            "message": "Maintenance tasks completed successfully"
        }
    except Exception as e:
        logger.error(f"Maintenance tasks failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to run maintenance tasks: {str(e)}"
        ) 