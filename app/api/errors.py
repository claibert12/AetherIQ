from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging
from datetime import datetime
from sqlalchemy import text

from app.core.security import get_current_user
from app.db.base import get_db
from app.db import models
from app.services.error_handler import ErrorHandler, ErrorPattern, RetryStrategy

router = APIRouter()
logger = logging.getLogger(__name__)

class ErrorReport(BaseModel):
    error_type: str
    error_message: str
    stack_trace: str
    context: Dict[str, Any]
    workflow_id: int

class ErrorRecoveryResponse(BaseModel):
    status: str
    pattern: Dict[str, Any]
    strategy: Dict[str, Any]
    recovery_result: Dict[str, Any]

class ErrorPatternResponse(BaseModel):
    id: int
    error_type: str
    error_message: str
    severity: str
    workflow_id: int
    retry_count: int
    resolution_status: str
    timestamp: str
    created_at: str

class ErrorMetrics(BaseModel):
    total_errors: int
    critical_errors: int
    high_errors: int
    medium_errors: int
    low_errors: int
    resolved_errors: int
    pending_errors: int
    failed_errors: int
    average_resolution_time: float

@router.post("/recovery", response_model=ErrorRecoveryResponse)
async def report_error(
    error_report: ErrorReport,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Report a workflow error and initiate recovery"""
    try:
        # Initialize error handler
        handler = ErrorHandler(db)
        
        # Create exception object
        error = Exception(error_report.error_message)
        error.__traceback__ = error_report.stack_trace
        
        # Handle error
        result = await handler.handle_error(
            error=error,
            workflow_id=error_report.workflow_id,
            context=error_report.context
        )
        
        return result
    except Exception as e:
        logger.error(f"Error recovery failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error recovery failed: {str(e)}"
        )

@router.get("/patterns", response_model=List[ErrorPatternResponse])
async def get_error_patterns(
    workflow_id: Optional[int] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get error patterns with optional filtering"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view error patterns"
        )
    
    try:
        # Build query
        query = text("""
            SELECT 
                id,
                error_type,
                error_message,
                severity,
                workflow_id,
                retry_count,
                resolution_status,
                timestamp,
                created_at
            FROM error_patterns
            WHERE 1=1
        """)
        
        params = {}
        
        if workflow_id:
            query += " AND workflow_id = :workflow_id"
            params["workflow_id"] = workflow_id
        
        if severity:
            query += " AND severity = :severity"
            params["severity"] = severity
        
        if status:
            query += " AND resolution_status = :status"
            params["status"] = status
        
        query += " ORDER BY timestamp DESC"
        
        # Execute query
        result = db.execute(query, params).fetchall()
        
        return [
            ErrorPatternResponse(
                id=row.id,
                error_type=row.error_type,
                error_message=row.error_message,
                severity=row.severity,
                workflow_id=row.workflow_id,
                retry_count=row.retry_count,
                resolution_status=row.resolution_status,
                timestamp=row.timestamp.isoformat(),
                created_at=row.created_at.isoformat()
            )
            for row in result
        ]
    except Exception as e:
        logger.error(f"Failed to get error patterns: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get error patterns: {str(e)}"
        )

@router.get("/metrics", response_model=ErrorMetrics)
async def get_error_metrics(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get error metrics and statistics"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view error metrics"
        )
    
    try:
        # Get error counts by severity
        query = text("""
            SELECT 
                COUNT(*) as total_errors,
                COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_errors,
                COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_errors,
                COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_errors,
                COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_errors,
                COUNT(CASE WHEN resolution_status = 'resolved' THEN 1 END) as resolved_errors,
                COUNT(CASE WHEN resolution_status = 'pending' THEN 1 END) as pending_errors,
                COUNT(CASE WHEN resolution_status = 'failed' THEN 1 END) as failed_errors,
                AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_resolution_time
            FROM error_patterns
            WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL ':days days'
        """)
        
        result = db.execute(query, {"days": days}).first()
        
        return ErrorMetrics(
            total_errors=result.total_errors,
            critical_errors=result.critical_errors,
            high_errors=result.high_errors,
            medium_errors=result.medium_errors,
            low_errors=result.low_errors,
            resolved_errors=result.resolved_errors,
            pending_errors=result.pending_errors,
            failed_errors=result.failed_errors,
            average_resolution_time=result.avg_resolution_time or 0.0
        )
    except Exception as e:
        logger.error(f"Failed to get error metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get error metrics: {str(e)}"
        )

@router.post("/patterns/{pattern_id}/resolve")
async def resolve_error_pattern(
    pattern_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Mark an error pattern as resolved"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can resolve error patterns"
        )
    
    try:
        # Update error pattern status
        query = text("""
            UPDATE error_patterns
            SET resolution_status = 'resolved',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :pattern_id
        """)
        
        db.execute(query, {"pattern_id": pattern_id})
        db.commit()
        
        return {"status": "success", "message": "Error pattern marked as resolved"}
    except Exception as e:
        logger.error(f"Failed to resolve error pattern: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve error pattern: {str(e)}"
        )

@router.post("/patterns/{pattern_id}/retry")
async def retry_error_pattern(
    pattern_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retry recovery for an error pattern"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can retry error patterns"
        )
    
    try:
        # Get error pattern
        query = text("""
            SELECT 
                error_type,
                error_message,
                stack_trace,
                context,
                workflow_id,
                severity
            FROM error_patterns
            WHERE id = :pattern_id
        """)
        
        result = db.execute(query, {"pattern_id": pattern_id}).first()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Error pattern not found"
            )
        
        # Initialize error handler
        handler = ErrorHandler(db)
        
        # Create error pattern
        pattern = ErrorPattern(
            error_type=result.error_type,
            error_message=result.error_message,
            stack_trace=result.stack_trace,
            context=result.context,
            timestamp=datetime.utcnow(),
            severity=result.severity,
            workflow_id=result.workflow_id,
            retry_count=0,
            resolution_status="pending"
        )
        
        # Get retry strategy
        strategy = handler._get_retry_strategy(pattern, False)
        
        # Execute retry strategy
        recovery_result = await handler._execute_retry_strategy(pattern, strategy)
        
        return {
            "status": "success",
            "pattern": pattern.dict(),
            "strategy": strategy.dict(),
            "recovery_result": recovery_result
        }
    except Exception as e:
        logger.error(f"Failed to retry error pattern: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retry error pattern: {str(e)}"
        ) 