from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
import numpy as np
from sklearn.ensemble import IsolationForest
from pydantic import BaseModel

class CompliancePolicy(BaseModel):
    name: str
    type: str  # GDPR, SOC2, HIPAA, etc.
    rules: List[Dict[str, Any]]
    retention_period: int  # days
    risk_threshold: float

class ComplianceViolation(BaseModel):
    policy_name: str
    violation_type: str
    severity: str  # low, medium, high, critical
    description: str
    affected_data: List[str]
    timestamp: datetime
    risk_score: float
    remediation_steps: List[str]

class ComplianceChecker:
    def __init__(self, db: Session, config: Dict[str, Any]):
        self.db = db
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.anomaly_detector = IsolationForest(contamination=0.1)
        self._initialize_policies()
        self._initialize_anomaly_detector()
    
    def _initialize_policies(self):
        """Initialize compliance policies"""
        self.policies = {
            "GDPR": CompliancePolicy(
                name="GDPR",
                type="privacy",
                rules=[
                    {
                        "type": "data_access",
                        "condition": "user_consent",
                        "action": "block"
                    },
                    {
                        "type": "data_retention",
                        "condition": "max_days",
                        "value": 730,  # 2 years
                        "action": "delete"
                    }
                ],
                retention_period=730,
                risk_threshold=0.7
            ),
            "SOC2": CompliancePolicy(
                name="SOC2",
                type="security",
                rules=[
                    {
                        "type": "access_control",
                        "condition": "role_based",
                        "action": "enforce"
                    },
                    {
                        "type": "audit_logging",
                        "condition": "comprehensive",
                        "action": "require"
                    }
                ],
                retention_period=365,
                risk_threshold=0.8
            ),
            "HIPAA": CompliancePolicy(
                name="HIPAA",
                type="healthcare",
                rules=[
                    {
                        "type": "phi_access",
                        "condition": "authorized_only",
                        "action": "restrict"
                    },
                    {
                        "type": "data_encryption",
                        "condition": "at_rest",
                        "action": "enforce"
                    }
                ],
                retention_period=1825,  # 5 years
                risk_threshold=0.9
            }
        }
    
    def _initialize_anomaly_detector(self):
        """Initialize the anomaly detection model"""
        try:
            # Get historical compliance data
            historical_data = self._get_historical_compliance_data()
            if historical_data:
                # Train the anomaly detector
                self._train_anomaly_detector(historical_data)
        except Exception as e:
            self.logger.error(f"Failed to initialize anomaly detector: {str(e)}")
    
    def _get_historical_compliance_data(self) -> List[Dict[str, Any]]:
        """Retrieve historical compliance data"""
        query = text("""
            SELECT 
                policy_name,
                violation_type,
                severity,
                risk_score,
                timestamp
            FROM compliance_violations
            WHERE timestamp > NOW() - INTERVAL '90 days'
        """)
        return self.db.execute(query).fetchall()
    
    def _train_anomaly_detector(self, historical_data: List[Dict[str, Any]]):
        """Train the anomaly detection model"""
        features = []
        
        for record in historical_data:
            feature_vector = [
                self._get_severity_score(record['severity']),
                record['risk_score'],
                self._get_policy_risk_weight(record['policy_name'])
            ]
            features.append(feature_vector)
        
        if features:
            self.anomaly_detector.fit(features)
    
    def _get_severity_score(self, severity: str) -> float:
        """Convert severity to numerical score"""
        severity_map = {
            "low": 0.25,
            "medium": 0.5,
            "high": 0.75,
            "critical": 1.0
        }
        return severity_map.get(severity.lower(), 0.5)
    
    def _get_policy_risk_weight(self, policy_name: str) -> float:
        """Get risk weight for policy"""
        policy = self.policies.get(policy_name)
        if policy:
            return policy.risk_threshold
        return 0.5
    
    def check_compliance(
        self,
        workflow_data: Dict[str, Any],
        user_id: int,
        tenant_id: int
    ) -> Dict[str, Any]:
        """Check workflow compliance against all policies"""
        violations = []
        risk_scores = {}
        
        try:
            # Check each policy
            for policy_name, policy in self.policies.items():
                # Check policy rules
                policy_violations = self._check_policy_rules(
                    policy,
                    workflow_data,
                    user_id,
                    tenant_id
                )
                
                if policy_violations:
                    violations.extend(policy_violations)
                
                # Calculate risk score
                risk_scores[policy_name] = self._calculate_risk_score(
                    policy,
                    policy_violations
                )
            
            # Detect anomalies
            anomaly_score = self._detect_anomalies(risk_scores)
            
            # Generate compliance report
            report = self._generate_compliance_report(
                violations,
                risk_scores,
                anomaly_score,
                workflow_data,
                user_id,
                tenant_id
            )
            
            # Log compliance check
            self._log_compliance_check(report)
            
            return report
        except Exception as e:
            self.logger.error(f"Compliance check failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    def _check_policy_rules(
        self,
        policy: CompliancePolicy,
        workflow_data: Dict[str, Any],
        user_id: int,
        tenant_id: int
    ) -> List[ComplianceViolation]:
        """Check workflow against policy rules"""
        violations = []
        
        try:
            for rule in policy.rules:
                if rule["type"] == "data_access":
                    violation = self._check_data_access_rule(
                        rule,
                        workflow_data,
                        user_id,
                        tenant_id
                    )
                    if violation:
                        violations.append(violation)
                
                elif rule["type"] == "data_retention":
                    violation = self._check_retention_rule(
                        rule,
                        workflow_data,
                        tenant_id
                    )
                    if violation:
                        violations.append(violation)
                
                elif rule["type"] == "access_control":
                    violation = self._check_access_control_rule(
                        rule,
                        workflow_data,
                        user_id
                    )
                    if violation:
                        violations.append(violation)
                
                elif rule["type"] == "phi_access":
                    violation = self._check_phi_access_rule(
                        rule,
                        workflow_data,
                        user_id
                    )
                    if violation:
                        violations.append(violation)
        except Exception as e:
            self.logger.error(f"Policy rule check failed: {str(e)}")
        
        return violations
    
    def _check_data_access_rule(
        self,
        rule: Dict[str, Any],
        workflow_data: Dict[str, Any],
        user_id: int,
        tenant_id: int
    ) -> Optional[ComplianceViolation]:
        """Check data access compliance"""
        try:
            # Check user consent
            if rule["condition"] == "user_consent":
                has_consent = self._check_user_consent(user_id, workflow_data)
                if not has_consent:
                    return ComplianceViolation(
                        policy_name="GDPR",
                        violation_type="data_access",
                        severity="high",
                        description="User consent not obtained for data access",
                        affected_data=self._get_affected_data(workflow_data),
                        timestamp=datetime.utcnow(),
                        risk_score=0.8,
                        remediation_steps=[
                            "Obtain explicit user consent",
                            "Document consent details",
                            "Update access controls"
                        ]
                    )
        except Exception as e:
            self.logger.error(f"Data access rule check failed: {str(e)}")
        
        return None
    
    def _check_retention_rule(
        self,
        rule: Dict[str, Any],
        workflow_data: Dict[str, Any],
        tenant_id: int
    ) -> Optional[ComplianceViolation]:
        """Check data retention compliance"""
        try:
            max_days = rule["value"]
            data_age = self._get_data_age(workflow_data)
            
            if data_age > max_days:
                return ComplianceViolation(
                    policy_name="GDPR",
                    violation_type="data_retention",
                    severity="medium",
                    description=f"Data retention period exceeded {max_days} days",
                    affected_data=self._get_affected_data(workflow_data),
                    timestamp=datetime.utcnow(),
                    risk_score=0.6,
                    remediation_steps=[
                        "Review data retention policies",
                        "Implement automated deletion",
                        "Update retention documentation"
                    ]
                )
        except Exception as e:
            self.logger.error(f"Retention rule check failed: {str(e)}")
        
        return None
    
    def _check_access_control_rule(
        self,
        rule: Dict[str, Any],
        workflow_data: Dict[str, Any],
        user_id: int
    ) -> Optional[ComplianceViolation]:
        """Check access control compliance"""
        try:
            if rule["condition"] == "role_based":
                has_proper_access = self._check_role_based_access(
                    user_id,
                    workflow_data
                )
                if not has_proper_access:
                    return ComplianceViolation(
                        policy_name="SOC2",
                        violation_type="access_control",
                        severity="high",
                        description="Unauthorized access attempt detected",
                        affected_data=self._get_affected_data(workflow_data),
                        timestamp=datetime.utcnow(),
                        risk_score=0.9,
                        remediation_steps=[
                            "Review user permissions",
                            "Update access policies",
                            "Implement additional controls"
                        ]
                    )
        except Exception as e:
            self.logger.error(f"Access control rule check failed: {str(e)}")
        
        return None
    
    def _check_phi_access_rule(
        self,
        rule: Dict[str, Any],
        workflow_data: Dict[str, Any],
        user_id: int
    ) -> Optional[ComplianceViolation]:
        """Check PHI access compliance"""
        try:
            if rule["condition"] == "authorized_only":
                is_authorized = self._check_phi_authorization(
                    user_id,
                    workflow_data
                )
                if not is_authorized:
                    return ComplianceViolation(
                        policy_name="HIPAA",
                        violation_type="phi_access",
                        severity="critical",
                        description="Unauthorized PHI access attempt",
                        affected_data=self._get_affected_data(workflow_data),
                        timestamp=datetime.utcnow(),
                        risk_score=1.0,
                        remediation_steps=[
                            "Immediate access revocation",
                            "Security incident investigation",
                            "Policy review and update"
                        ]
                    )
        except Exception as e:
            self.logger.error(f"PHI access rule check failed: {str(e)}")
        
        return None
    
    def _calculate_risk_score(
        self,
        policy: CompliancePolicy,
        violations: List[ComplianceViolation]
    ) -> float:
        """Calculate risk score for policy violations"""
        if not violations:
            return 0.0
        
        # Weight violations by severity
        severity_weights = {
            "low": 0.25,
            "medium": 0.5,
            "high": 0.75,
            "critical": 1.0
        }
        
        total_weight = sum(
            severity_weights.get(v.severity, 0.5)
            for v in violations
        )
        
        # Normalize by number of violations
        return min(total_weight / len(violations), 1.0)
    
    def _detect_anomalies(self, risk_scores: Dict[str, float]) -> float:
        """Detect anomalies in risk scores"""
        try:
            features = [
                self._get_severity_score("high"),
                max(risk_scores.values()),
                self._get_policy_risk_weight("HIPAA")
            ]
            
            # Predict anomaly score
            score = self.anomaly_detector.score_samples([features])[0]
            
            # Normalize score to 0-1 range
            return (score - self.anomaly_detector.offset_) / -self.anomaly_detector.score_samples([[0, 0, 0]])[0]
        except Exception as e:
            self.logger.error(f"Anomaly detection failed: {str(e)}")
            return 0.5
    
    def _generate_compliance_report(
        self,
        violations: List[ComplianceViolation],
        risk_scores: Dict[str, float],
        anomaly_score: float,
        workflow_data: Dict[str, Any],
        user_id: int,
        tenant_id: int
    ) -> Dict[str, Any]:
        """Generate comprehensive compliance report"""
        try:
            # Group violations by policy
            policy_violations = {}
            for violation in violations:
                if violation.policy_name not in policy_violations:
                    policy_violations[violation.policy_name] = []
                policy_violations[violation.policy_name].append(violation)
            
            # Calculate overall risk score
            overall_risk = max(risk_scores.values())
            
            # Determine compliance status
            status = "compliant"
            if violations:
                status = "non_compliant"
            elif overall_risk > 0.7:
                status = "at_risk"
            
            return {
                "status": status,
                "timestamp": datetime.utcnow(),
                "workflow_id": workflow_data.get("id"),
                "user_id": user_id,
                "tenant_id": tenant_id,
                "violations": policy_violations,
                "risk_scores": risk_scores,
                "overall_risk_score": overall_risk,
                "anomaly_score": anomaly_score,
                "recommendations": self._generate_recommendations(
                    violations,
                    risk_scores
                )
            }
        except Exception as e:
            self.logger.error(f"Report generation failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    def _generate_recommendations(
        self,
        violations: List[ComplianceViolation],
        risk_scores: Dict[str, float]
    ) -> List[Dict[str, Any]]:
        """Generate recommendations based on violations and risk scores"""
        recommendations = []
        
        try:
            # Sort violations by severity
            sorted_violations = sorted(
                violations,
                key=lambda x: self._get_severity_score(x.severity),
                reverse=True
            )
            
            # Generate recommendations for critical violations
            for violation in sorted_violations:
                if violation.severity in ["high", "critical"]:
                    recommendations.append({
                        "type": "immediate_action",
                        "priority": "high",
                        "description": f"Address {violation.violation_type} violation",
                        "steps": violation.remediation_steps
                    })
            
            # Generate recommendations for high-risk policies
            for policy_name, risk_score in risk_scores.items():
                if risk_score > 0.7:
                    recommendations.append({
                        "type": "policy_review",
                        "priority": "medium",
                        "description": f"Review {policy_name} compliance",
                        "steps": [
                            "Conduct policy audit",
                            "Update documentation",
                            "Review access controls"
                        ]
                    })
        except Exception as e:
            self.logger.error(f"Recommendation generation failed: {str(e)}")
        
        return recommendations
    
    def _log_compliance_check(self, report: Dict[str, Any]):
        """Log compliance check results"""
        try:
            query = text("""
                INSERT INTO compliance_checks (
                    workflow_id,
                    user_id,
                    tenant_id,
                    status,
                    violations,
                    risk_scores,
                    overall_risk_score,
                    anomaly_score,
                    recommendations,
                    timestamp
                ) VALUES (
                    :workflow_id,
                    :user_id,
                    :tenant_id,
                    :status,
                    :violations,
                    :risk_scores,
                    :overall_risk_score,
                    :anomaly_score,
                    :recommendations,
                    :timestamp
                )
            """)
            
            self.db.execute(query, {
                "workflow_id": report["workflow_id"],
                "user_id": report["user_id"],
                "tenant_id": report["tenant_id"],
                "status": report["status"],
                "violations": json.dumps(report["violations"]),
                "risk_scores": json.dumps(report["risk_scores"]),
                "overall_risk_score": report["overall_risk_score"],
                "anomaly_score": report["anomaly_score"],
                "recommendations": json.dumps(report["recommendations"]),
                "timestamp": report["timestamp"]
            })
            
            self.db.commit()
        except Exception as e:
            self.logger.error(f"Failed to log compliance check: {str(e)}")
            self.db.rollback()
    
    def _check_user_consent(self, user_id: int, workflow_data: Dict[str, Any]) -> bool:
        """Check if user has given consent for data access"""
        try:
            query = text("""
                SELECT consent_status, consent_date
                FROM user_consents
                WHERE user_id = :user_id
                AND data_type = :data_type
                AND consent_status = 'active'
                AND consent_date > NOW() - INTERVAL '1 year'
            """)
            
            result = self.db.execute(query, {
                "user_id": user_id,
                "data_type": workflow_data.get("data_type")
            }).first()
            
            return bool(result)
        except Exception as e:
            self.logger.error(f"User consent check failed: {str(e)}")
            return False
    
    def _get_data_age(self, workflow_data: Dict[str, Any]) -> int:
        """Get age of data in days"""
        try:
            created_at = workflow_data.get("created_at")
            if created_at:
                return (datetime.utcnow() - created_at).days
            return 0
        except Exception as e:
            self.logger.error(f"Data age calculation failed: {str(e)}")
            return 0
    
    def _check_role_based_access(
        self,
        user_id: int,
        workflow_data: Dict[str, Any]
    ) -> bool:
        """Check if user has proper role-based access"""
        try:
            query = text("""
                SELECT r.permissions
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = :user_id
                AND r.permissions @> :required_permissions
            """)
            
            result = self.db.execute(query, {
                "user_id": user_id,
                "required_permissions": json.dumps(workflow_data.get("required_permissions", []))
            }).first()
            
            return bool(result)
        except Exception as e:
            self.logger.error(f"Role-based access check failed: {str(e)}")
            return False
    
    def _check_phi_authorization(
        self,
        user_id: int,
        workflow_data: Dict[str, Any]
    ) -> bool:
        """Check if user is authorized to access PHI"""
        try:
            query = text("""
                SELECT phi_access_level
                FROM user_phi_authorizations
                WHERE user_id = :user_id
                AND phi_access_level >= :required_level
                AND is_active = true
            """)
            
            result = self.db.execute(query, {
                "user_id": user_id,
                "required_level": workflow_data.get("phi_access_level", 0)
            }).first()
            
            return bool(result)
        except Exception as e:
            self.logger.error(f"PHI authorization check failed: {str(e)}")
            return False
    
    def _get_affected_data(self, workflow_data: Dict[str, Any]) -> List[str]:
        """Get list of affected data fields"""
        try:
            return workflow_data.get("affected_fields", [])
        except Exception as e:
            self.logger.error(f"Failed to get affected data: {str(e)}")
            return [] 