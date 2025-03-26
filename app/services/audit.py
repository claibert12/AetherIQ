from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from app.db import models

class AuditService:
    def __init__(self, db: Session):
        self.db = db
    
    def log_encryption_operation(
        self,
        operation_type: str,
        user_id: int,
        tenant_id: int,
        resource_type: str,
        resource_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
        status: str = "success"
    ):
        """Log encryption-related operations"""
        audit_log = models.AuditLog(
            operation_type=operation_type,
            user_id=user_id,
            tenant_id=tenant_id,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            status=status,
            timestamp=datetime.utcnow()
        )
        
        self.db.add(audit_log)
        self.db.commit()
    
    def get_encryption_audit_logs(
        self,
        tenant_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        operation_type: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> list:
        """Retrieve encryption audit logs with filters"""
        query = self.db.query(models.AuditLog).filter(
            models.AuditLog.tenant_id == tenant_id,
            models.AuditLog.resource_type.in_(["encryption", "key_rotation"])
        )
        
        if start_date:
            query = query.filter(models.AuditLog.timestamp >= start_date)
        if end_date:
            query = query.filter(models.AuditLog.timestamp <= end_date)
        if operation_type:
            query = query.filter(models.AuditLog.operation_type == operation_type)
        if user_id:
            query = query.filter(models.AuditLog.user_id == user_id)
            
        return query.order_by(models.AuditLog.timestamp.desc()).all()
    
    def get_encryption_audit_summary(
        self,
        tenant_id: int,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get summary of encryption operations"""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        logs = self.get_encryption_audit_logs(
            tenant_id=tenant_id,
            start_date=start_date
        )
        
        summary = {
            "total_operations": len(logs),
            "successful_operations": len([l for l in logs if l.status == "success"]),
            "failed_operations": len([l for l in logs if l.status == "failed"]),
            "operation_types": {},
            "daily_operations": {}
        }
        
        # Count operation types
        for log in logs:
            summary["operation_types"][log.operation_type] = \
                summary["operation_types"].get(log.operation_type, 0) + 1
            
            # Count daily operations
            date_key = log.timestamp.date().isoformat()
            summary["daily_operations"][date_key] = \
                summary["daily_operations"].get(date_key, 0) + 1
        
        return summary 