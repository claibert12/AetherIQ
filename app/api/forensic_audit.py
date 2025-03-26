from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.core.security import get_current_user
from app.db.base import get_db
from app.db import models
from app.services.forensic_audit import ForensicAuditService
from app.services.encryption import EncryptionService

router = APIRouter()

class AuditLogRequest(BaseModel):
    action_type: str
    details: Dict[str, Any]
    risk_score: float = 0.0
    security_status: str = "normal"

@router.post("/logs", response_model=Dict[str, Any])
async def create_audit_log(
    request: AuditLogRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new forensic audit log entry"""
    try:
        # Initialize services
        encryption_service = EncryptionService(current_user.tenant.master_key)
        audit_service = ForensicAuditService(db, encryption_service)
        
        # Log the action
        audit_log = audit_service.log_action(
            action_type=request.action_type,
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            details=request.details,
            risk_score=request.risk_score,
            security_status=request.security_status
        )
        
        return {
            "id": audit_log.id,
            "action_type": audit_log.action_type,
            "timestamp": audit_log.timestamp.isoformat(),
            "security_status": audit_log.security_status,
            "risk_score": audit_log.risk_score
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create audit log: {str(e)}"
        )

@router.get("/logs", response_model=List[Dict[str, Any]])
async def get_audit_logs(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    action_type: Optional[str] = None,
    security_status: Optional[str] = None,
    user_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get forensic audit logs with filtering"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view audit logs"
        )
    
    try:
        # Initialize services
        encryption_service = EncryptionService(current_user.tenant.master_key)
        audit_service = ForensicAuditService(db, encryption_service)
        
        # Get logs
        logs = audit_service.get_audit_logs(
            tenant_id=current_user.tenant_id,
            start_date=start_date,
            end_date=end_date,
            action_type=action_type,
            security_status=security_status,
            user_id=user_id,
            limit=limit
        )
        
        return logs
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve audit logs: {str(e)}"
        )

@router.get("/metrics", response_model=Dict[str, Any])
async def get_security_metrics(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get security metrics and anomaly statistics"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view security metrics"
        )
    
    try:
        # Initialize services
        encryption_service = EncryptionService(current_user.tenant.master_key)
        audit_service = ForensicAuditService(db, encryption_service)
        
        # Get metrics
        metrics = audit_service.get_security_metrics(
            tenant_id=current_user.tenant_id,
            days=days
        )
        
        return metrics
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve security metrics: {str(e)}"
        )

@router.get("/logs/{log_id}", response_model=Dict[str, Any])
async def get_audit_log_details(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get detailed information about a specific audit log entry"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view audit log details"
        )
    
    try:
        # Get the log entry
        log = db.query(models.ForensicAuditLog).filter(
            models.ForensicAuditLog.id == log_id,
            models.ForensicAuditLog.tenant_id == current_user.tenant_id
        ).first()
        
        if not log:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Audit log not found"
            )
        
        # Initialize encryption service
        encryption_service = EncryptionService(current_user.tenant.master_key)
        
        # Decrypt sensitive details
        decrypted_details = encryption_service.decrypt_data(log.encrypted_details)
        
        return {
            "id": log.id,
            "action_type": log.action_type,
            "user_id": log.user_id,
            "timestamp": log.timestamp.isoformat(),
            "details": decrypted_details,
            "risk_score": log.risk_score,
            "security_status": log.security_status,
            "action_count": log.action_count,
            "resource_count": log.resource_count,
            "data_size": log.data_size,
            "failure_count": log.failure_count,
            "unique_users": log.unique_users,
            "unique_resources": log.unique_resources,
            "hash": log.hash
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve audit log details: {str(e)}"
        ) 