from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from datetime import datetime
from pydantic import BaseModel

from app.core.security import oauth2_scheme, get_current_user
from app.db.base import get_db
from app.db import models
from app.services.encryption import EncryptionService
from app.services.audit import AuditService

router = APIRouter()

class EncryptionRequest(BaseModel):
    data: Dict[str, Any]
    metadata: Dict[str, Any] = {}

class DecryptionRequest(BaseModel):
    encrypted_package: Dict[str, Any]

class KeyRotationRequest(BaseModel):
    new_master_key: str

@router.post("/encrypt", response_model=Dict[str, Any])
async def encrypt_data(
    request: EncryptionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Encrypt data using AES-256"""
    try:
        # Initialize encryption service
        encryption_service = EncryptionService(current_user.tenant.master_key)
        
        # Encrypt the data
        encrypted_package = encryption_service.encrypt_data(
            data=request.data,
            metadata=request.metadata
        )
        
        # Log the operation
        audit_service = AuditService(db)
        audit_service.log_encryption_operation(
            operation_type="encrypt",
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            resource_type="encryption",
            details={
                "data_size": len(str(request.data)),
                "metadata": request.metadata
            }
        )
        
        return encrypted_package
    except Exception as e:
        # Log failed operation
        audit_service = AuditService(db)
        audit_service.log_encryption_operation(
            operation_type="encrypt",
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            resource_type="encryption",
            details={"error": str(e)},
            status="failed"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Encryption failed: {str(e)}"
        )

@router.post("/decrypt", response_model=Dict[str, Any])
async def decrypt_data(
    request: DecryptionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Decrypt data using AES-256"""
    try:
        # Initialize encryption service
        encryption_service = EncryptionService(current_user.tenant.master_key)
        
        # Decrypt the data
        decrypted_data = encryption_service.decrypt_data(request.encrypted_package)
        
        # Log the operation
        audit_service = AuditService(db)
        audit_service.log_encryption_operation(
            operation_type="decrypt",
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            resource_type="encryption",
            details={
                "data_size": len(str(decrypted_data)),
                "metadata": request.encrypted_package.get("encryption_metadata", {})
            }
        )
        
        return decrypted_data
    except Exception as e:
        # Log failed operation
        audit_service = AuditService(db)
        audit_service.log_encryption_operation(
            operation_type="decrypt",
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            resource_type="encryption",
            details={"error": str(e)},
            status="failed"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Decryption failed: {str(e)}"
        )

@router.post("/rotate-key")
async def rotate_encryption_key(
    request: KeyRotationRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Rotate the encryption key"""
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can rotate encryption keys"
        )
    
    try:
        # Initialize encryption service
        encryption_service = EncryptionService(current_user.tenant.master_key)
        
        # Rotate the key
        encryption_service.rotate_key(request.new_master_key)
        
        # Update tenant's master key
        current_user.tenant.master_key = request.new_master_key
        db.commit()
        
        # Log the operation
        audit_service = AuditService(db)
        audit_service.log_encryption_operation(
            operation_type="key_rotation",
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            resource_type="key_rotation",
            details={"rotated_by": current_user.email}
        )
        
        return {"message": "Encryption key rotated successfully"}
    except Exception as e:
        # Log failed operation
        audit_service = AuditService(db)
        audit_service.log_encryption_operation(
            operation_type="key_rotation",
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            resource_type="key_rotation",
            details={"error": str(e)},
            status="failed"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Key rotation failed: {str(e)}"
        )

@router.get("/audit-logs", response_model=List[Dict[str, Any]])
async def get_encryption_audit_logs(
    start_date: datetime = None,
    end_date: datetime = None,
    operation_type: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get encryption audit logs"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view audit logs"
        )
    
    audit_service = AuditService(db)
    logs = audit_service.get_encryption_audit_logs(
        tenant_id=current_user.tenant_id,
        start_date=start_date,
        end_date=end_date,
        operation_type=operation_type
    )
    
    return [
        {
            "id": log.id,
            "operation_type": log.operation_type,
            "user_id": log.user_id,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "status": log.status,
            "timestamp": log.timestamp.isoformat()
        }
        for log in logs
    ]

@router.get("/audit-summary", response_model=Dict[str, Any])
async def get_encryption_audit_summary(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get summary of encryption operations"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view audit summaries"
        )
    
    audit_service = AuditService(db)
    return audit_service.get_encryption_audit_summary(
        tenant_id=current_user.tenant_id,
        days=days
    ) 