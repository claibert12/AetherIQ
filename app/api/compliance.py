from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging

from app.core.security import get_current_user
from app.db.base import get_db
from app.db import models
from app.services.compliance import ComplianceChecker

router = APIRouter()
logger = logging.getLogger(__name__)

class ComplianceCheckRequest(BaseModel):
    workflow_data: Dict[str, Any]
    user_id: int
    tenant_id: int

class ComplianceReport(BaseModel):
    status: str
    timestamp: str
    workflow_id: Optional[int]
    user_id: int
    tenant_id: int
    violations: Dict[str, List[Dict[str, Any]]]
    risk_scores: Dict[str, float]
    overall_risk_score: float
    anomaly_score: float
    recommendations: List[Dict[str, Any]]

@router.post("/check", response_model=ComplianceReport)
async def check_compliance(
    request: ComplianceCheckRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Check workflow compliance against all policies"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can check compliance"
        )
    
    try:
        # Initialize compliance checker
        checker = ComplianceChecker(db, {})
        
        # Check compliance
        report = checker.check_compliance(
            request.workflow_data,
            request.user_id,
            request.tenant_id
        )
        
        return report
    except Exception as e:
        logger.error(f"Compliance check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check compliance: {str(e)}"
        )

@router.get("/violations", response_model=List[Dict[str, Any]])
async def get_compliance_violations(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    policy_name: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get compliance violations with filtering"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view violations"
        )
    
    try:
        query = """
            SELECT 
                policy_name,
                violation_type,
                severity,
                description,
                affected_data,
                timestamp,
                risk_score,
                remediation_steps
            FROM compliance_violations
            WHERE 1=1
        """
        params = {}
        
        if start_date:
            query += " AND timestamp >= :start_date"
            params["start_date"] = start_date
        
        if end_date:
            query += " AND timestamp <= :end_date"
            params["end_date"] = end_date
        
        if policy_name:
            query += " AND policy_name = :policy_name"
            params["policy_name"] = policy_name
        
        if severity:
            query += " AND severity = :severity"
            params["severity"] = severity
        
        query += " ORDER BY timestamp DESC"
        
        result = db.execute(query, params).fetchall()
        
        return [
            {
                "policy_name": row.policy_name,
                "violation_type": row.violation_type,
                "severity": row.severity,
                "description": row.description,
                "affected_data": row.affected_data,
                "timestamp": row.timestamp,
                "risk_score": row.risk_score,
                "remediation_steps": row.remediation_steps
            }
            for row in result
        ]
    except Exception as e:
        logger.error(f"Failed to get compliance violations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get compliance violations: {str(e)}"
        )

@router.get("/metrics", response_model=Dict[str, Any])
async def get_compliance_metrics(
    days: Optional[int] = 30,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get compliance metrics and statistics"""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and managers can view metrics"
        )
    
    try:
        query = """
            SELECT 
                policy_name,
                COUNT(*) as total_violations,
                AVG(risk_score) as avg_risk_score,
                MAX(risk_score) as max_risk_score,
                COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_violations,
                COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_violations,
                COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_violations,
                COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_violations
            FROM compliance_violations
            WHERE timestamp > NOW() - INTERVAL ':days days'
            GROUP BY policy_name
        """
        
        result = db.execute(query, {"days": days}).fetchall()
        
        return {
            "metrics": [
                {
                    "policy_name": row.policy_name,
                    "total_violations": row.total_violations,
                    "avg_risk_score": float(row.avg_risk_score),
                    "max_risk_score": float(row.max_risk_score),
                    "critical_violations": row.critical_violations,
                    "high_violations": row.high_violations,
                    "medium_violations": row.medium_violations,
                    "low_violations": row.low_violations
                }
                for row in result
            ]
        }
    except Exception as e:
        logger.error(f"Failed to get compliance metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get compliance metrics: {str(e)}"
        ) 