from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging
from datetime import datetime

from app.core.security import get_current_user
from app.db.base import get_db
from app.db import models
from app.services.license_manager import LicenseManager, License, UserAccess

router = APIRouter()
logger = logging.getLogger(__name__)

class LicenseRequest(BaseModel):
    type: str
    user_id: int
    tenant_id: int
    features: List[str]
    cost: float
    expires_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None

class UserAccessRequest(BaseModel):
    user_id: int
    tenant_id: int
    roles: List[str]
    permissions: List[str]

class AccessViolationResponse(BaseModel):
    user_id: int
    tenant_id: int
    violation_type: str
    details: Dict[str, Any]

class LicenseAnalysisResponse(BaseModel):
    total_licenses: int
    anomalies: List[Dict[str, Any]]
    unused_licenses: List[Dict[str, Any]]
    high_risk_licenses: List[Dict[str, Any]]
    cost_optimization: Dict[str, Any]

@router.post("/licenses", response_model=Dict[str, Any])
async def create_license(
    license_request: LicenseRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Create a new license"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can create licenses"
        )
    
    try:
        # Initialize license manager
        manager = LicenseManager(db)
        
        # Create license
        license = License(
            id=f"LIC-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            type=license_request.type,
            user_id=license_request.user_id,
            tenant_id=license_request.tenant_id,
            status="active",
            assigned_at=datetime.utcnow(),
            expires_at=license_request.expires_at,
            last_used_at=None,
            usage_count=0,
            features=license_request.features,
            cost=license_request.cost,
            metadata=license_request.metadata or {}
        )
        
        # Insert license into database
        query = text("""
            INSERT INTO licenses (
                id,
                type,
                user_id,
                tenant_id,
                status,
                assigned_at,
                expires_at,
                last_used_at,
                usage_count,
                features,
                cost,
                metadata
            ) VALUES (
                :id,
                :type,
                :user_id,
                :tenant_id,
                :status,
                :assigned_at,
                :expires_at,
                :last_used_at,
                :usage_count,
                :features,
                :cost,
                :metadata
            )
        """)
        
        db.execute(query, license.dict())
        db.commit()
        
        return {
            "status": "success",
            "message": "License created successfully",
            "license": license.dict()
        }
    except Exception as e:
        logger.error(f"Failed to create license: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create license: {str(e)}"
        )

@router.get("/licenses/analysis", response_model=LicenseAnalysisResponse)
async def analyze_licenses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Analyze license usage and identify anomalies"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can analyze licenses"
        )
    
    try:
        # Initialize license manager
        manager = LicenseManager(db)
        
        # Analyze license usage
        result = await manager.analyze_license_usage()
        
        if result["status"] == "error":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["message"]
            )
        
        return result
    except Exception as e:
        logger.error(f"License analysis failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"License analysis failed: {str(e)}"
        )

@router.post("/access", response_model=Dict[str, Any])
async def manage_user_access(
    access_request: UserAccessRequest,
    action: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Manage user access and roles"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can manage user access"
        )
    
    try:
        # Initialize license manager
        manager = LicenseManager(db)
        
        # Manage user access
        result = await manager.manage_user_access(
            user_id=access_request.user_id,
            tenant_id=access_request.tenant_id,
            action=action,
            roles=access_request.roles,
            permissions=access_request.permissions
        )
        
        if result["status"] == "error":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["error"]
            )
        
        return result
    except Exception as e:
        logger.error(f"User access management failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"User access management failed: {str(e)}"
        )

@router.get("/violations", response_model=List[AccessViolationResponse])
async def check_access_violations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Check for access violations and policy breaches"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can check access violations"
        )
    
    try:
        # Initialize license manager
        manager = LicenseManager(db)
        
        # Check for violations
        result = await manager.check_access_violations()
        
        if result["status"] == "error":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result["error"]
            )
        
        return result["violations"]
    except Exception as e:
        logger.error(f"Access violation check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Access violation check failed: {str(e)}"
        )

@router.get("/licenses/{license_id}", response_model=Dict[str, Any])
async def get_license_details(
    license_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get detailed information about a specific license"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view license details"
        )
    
    try:
        query = text("""
            SELECT 
                l.*,
                ua.roles,
                ua.permissions,
                ua.access_patterns,
                ua.risk_score
            FROM licenses l
            LEFT JOIN user_access ua ON l.user_id = ua.user_id AND l.tenant_id = ua.tenant_id
            WHERE l.id = :license_id
        """)
        
        result = db.execute(query, {"license_id": license_id}).first()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="License not found"
            )
        
        return {
            "license": dict(result),
            "user_access": {
                "roles": result.roles,
                "permissions": result.permissions,
                "access_patterns": result.access_patterns,
                "risk_score": result.risk_score
            }
        }
    except Exception as e:
        logger.error(f"Failed to get license details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get license details: {str(e)}"
        )

@router.put("/licenses/{license_id}/status", response_model=Dict[str, Any])
async def update_license_status(
    license_id: str,
    status: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update the status of a license"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can update license status"
        )
    
    try:
        query = text("""
            UPDATE licenses
            SET status = :status,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :license_id
        """)
        
        db.execute(query, {
            "license_id": license_id,
            "status": status
        })
        db.commit()
        
        return {
            "status": "success",
            "message": f"License status updated to {status}",
            "license_id": license_id
        }
    except Exception as e:
        logger.error(f"Failed to update license status: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update license status: {str(e)}"
        ) 