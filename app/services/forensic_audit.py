from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import numpy as np
from sklearn.ensemble import IsolationForest
from app.db import models
from app.services.encryption import EncryptionService

class ForensicAuditService:
    def __init__(self, db: Session, encryption_service: EncryptionService):
        self.db = db
        self.encryption_service = encryption_service
        self.anomaly_detector = IsolationForest(
            contamination=0.1,
            random_state=42
        )
        self._initialize_anomaly_detector()
    
    def _initialize_anomaly_detector(self):
        """Initialize anomaly detection model with historical data"""
        # Get recent audit logs for training
        recent_logs = self.db.query(models.ForensicAuditLog)\
            .order_by(models.ForensicAuditLog.timestamp.desc())\
            .limit(1000)\
            .all()
        
        if recent_logs:
            # Extract features for anomaly detection
            features = self._extract_features(recent_logs)
            self.anomaly_detector.fit(features)
    
    def _extract_features(self, logs: List[models.ForensicAuditLog]) -> np.ndarray:
        """Extract numerical features for anomaly detection"""
        features = []
        for log in logs:
            feature_vector = [
                log.timestamp.hour,  # Time of day
                log.timestamp.weekday(),  # Day of week
                log.risk_score,  # Risk score
                log.action_count,  # Number of actions
                log.resource_count,  # Number of resources affected
                log.data_size,  # Size of data involved
                log.failure_count,  # Number of failures
                log.unique_users,  # Number of unique users
                log.unique_resources  # Number of unique resources
            ]
            features.append(feature_vector)
        return np.array(features)
    
    def log_action(
        self,
        action_type: str,
        user_id: int,
        tenant_id: int,
        details: Dict[str, Any],
        risk_score: float = 0.0,
        security_status: str = "normal"
    ) -> models.ForensicAuditLog:
        """Log an action with forensic details"""
        # Calculate action metrics
        action_count = details.get("action_count", 1)
        resource_count = len(details.get("affected_resources", []))
        data_size = len(str(details))
        failure_count = details.get("failure_count", 0)
        unique_users = len(details.get("involved_users", []))
        unique_resources = len(set(details.get("affected_resources", [])))
        
        # Create audit log entry
        audit_log = models.ForensicAuditLog(
            action_type=action_type,
            user_id=user_id,
            tenant_id=tenant_id,
            timestamp=datetime.utcnow(),
            details=details,
            risk_score=risk_score,
            security_status=security_status,
            action_count=action_count,
            resource_count=resource_count,
            data_size=data_size,
            failure_count=failure_count,
            unique_users=unique_users,
            unique_resources=unique_resources
        )
        
        # Encrypt sensitive details
        encrypted_details = self.encryption_service.encrypt_data(
            data=details,
            metadata={
                "action_type": action_type,
                "timestamp": audit_log.timestamp.isoformat()
            }
        )
        audit_log.encrypted_details = encrypted_details
        
        # Detect anomalies
        features = self._extract_features([audit_log])
        anomaly_score = self.anomaly_detector.score_samples(features)[0]
        
        # Update security status based on anomaly score
        if anomaly_score < -0.5:  # Strong anomaly
            audit_log.security_status = "suspicious"
        elif anomaly_score < -0.8:  # Very strong anomaly
            audit_log.security_status = "blocked"
        
        self.db.add(audit_log)
        self.db.commit()
        
        return audit_log
    
    def get_audit_logs(
        self,
        tenant_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        action_type: Optional[str] = None,
        security_status: Optional[str] = None,
        user_id: Optional[int] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Retrieve audit logs with forensic details"""
        query = self.db.query(models.ForensicAuditLog).filter(
            models.ForensicAuditLog.tenant_id == tenant_id
        )
        
        if start_date:
            query = query.filter(models.ForensicAuditLog.timestamp >= start_date)
        if end_date:
            query = query.filter(models.ForensicAuditLog.timestamp <= end_date)
        if action_type:
            query = query.filter(models.ForensicAuditLog.action_type == action_type)
        if security_status:
            query = query.filter(models.ForensicAuditLog.security_status == security_status)
        if user_id:
            query = query.filter(models.ForensicAuditLog.user_id == user_id)
        
        logs = query.order_by(models.ForensicAuditLog.timestamp.desc()).limit(limit).all()
        
        # Decrypt and format logs
        formatted_logs = []
        for log in logs:
            try:
                decrypted_details = self.encryption_service.decrypt_data(log.encrypted_details)
                formatted_log = {
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
                    "unique_resources": log.unique_resources
                }
                formatted_logs.append(formatted_log)
            except Exception as e:
                # Log decryption failure but continue processing other logs
                continue
        
        return formatted_logs
    
    def get_security_metrics(
        self,
        tenant_id: int,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get security metrics and anomaly statistics"""
        start_date = datetime.utcnow() - timedelta(days=days)
        
        logs = self.db.query(models.ForensicAuditLog).filter(
            models.ForensicAuditLog.tenant_id == tenant_id,
            models.ForensicAuditLog.timestamp >= start_date
        ).all()
        
        metrics = {
            "total_actions": len(logs),
            "suspicious_actions": len([l for l in logs if l.security_status == "suspicious"]),
            "blocked_actions": len([l for l in logs if l.security_status == "blocked"]),
            "average_risk_score": np.mean([l.risk_score for l in logs]) if logs else 0,
            "action_types": {},
            "security_status_distribution": {},
            "daily_activity": {}
        }
        
        # Calculate distributions
        for log in logs:
            # Action type distribution
            metrics["action_types"][log.action_type] = \
                metrics["action_types"].get(log.action_type, 0) + 1
            
            # Security status distribution
            metrics["security_status_distribution"][log.security_status] = \
                metrics["security_status_distribution"].get(log.security_status, 0) + 1
            
            # Daily activity
            date_key = log.timestamp.date().isoformat()
            metrics["daily_activity"][date_key] = \
                metrics["daily_activity"].get(date_key, 0) + 1
        
        return metrics 