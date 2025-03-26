from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel
import logging

from app.core.security import get_current_user
from app.db.base import get_db
from app.db import models
from app.services.failover import FailoverManager

router = APIRouter()
logger = logging.getLogger(__name__)

class FailoverStatus(BaseModel):
    node_id: str
    role: str
    active_nodes: List[Dict[str, Any]]
    last_heartbeat: str
    failed_jobs: int
    node_load: float
    node_capabilities: Dict[str, int]

class FailoverNotification(BaseModel):
    type: str
    new_primary: str
    timestamp: str

@router.get("/status", response_model=FailoverStatus)
async def get_failover_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get current failover status"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view failover status"
        )
    
    try:
        # Initialize failover manager
        manager = FailoverManager(db, {})
        
        # Get failover status
        status = manager.get_failover_status()
        
        return status
    except Exception as e:
        logger.error(f"Failed to get failover status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get failover status: {str(e)}"
        )

@router.post("/notify")
async def notify_failover(
    notification: FailoverNotification,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Handle failover notification"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can handle failover notifications"
        )
    
    try:
        # Initialize failover manager
        manager = FailoverManager(db, {})
        
        # Update node status based on notification
        if notification.new_primary != manager._get_current_node_status()["node_id"]:
            manager._update_node_status("standby")
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Failed to handle failover notification: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to handle failover notification: {str(e)}"
        )

@router.post("/force-failover")
async def force_failover(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Force failover to this node"""
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can force failover"
        )
    
    try:
        # Initialize failover manager
        manager = FailoverManager(db, {})
        
        # Force failover
        await manager._initiate_failover()
        
        return {"status": "success", "message": "Failover initiated"}
    except Exception as e:
        logger.error(f"Failed to force failover: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to force failover: {str(e)}"
        )

@router.get("/failed-jobs")
async def get_failed_jobs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get list of failed jobs"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view failed jobs"
        )
    
    try:
        # Initialize failover manager
        manager = FailoverManager(db, {})
        
        # Get failed jobs
        failed_jobs = manager._get_failed_jobs()
        
        return {
            "failed_jobs": [
                {
                    "job_id": job.job_id,
                    "workflow_id": job.workflow_id,
                    "status": job.status,
                    "retry_count": job.retry_count,
                    "max_retries": job.max_retries,
                    "priority": job.priority,
                    "last_checkpoint": job.last_checkpoint.isoformat(),
                    "created_at": job.created_at.isoformat(),
                    "updated_at": job.updated_at.isoformat()
                }
                for job in failed_jobs
            ]
        }
    except Exception as e:
        logger.error(f"Failed to get failed jobs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get failed jobs: {str(e)}"
        )

@router.post("/recover-job/{job_id}")
async def recover_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Recover a specific failed job"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can recover jobs"
        )
    
    try:
        # Initialize failover manager
        manager = FailoverManager(db, {})
        
        # Get job details
        failed_jobs = manager._get_failed_jobs()
        job = next((j for j in failed_jobs if j.job_id == job_id), None)
        
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found or not failed"
            )
        
        # Recover job
        await manager._recover_job(job)
        
        return {"status": "success", "message": f"Job {job_id} recovery initiated"}
    except Exception as e:
        logger.error(f"Failed to recover job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to recover job: {str(e)}"
        ) 