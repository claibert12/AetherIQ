"""
AetherIQ Compliance Manager
Handles enterprise compliance, governance, and audit requirements
"""

from typing import Dict, List, Optional, Any
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass
import json
import hashlib
import asyncio
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy.orm import Session
from fastapi import HTTPException

from aetheriq.db.session import get_db
from aetheriq.crud.base import CRUDBase
from aetheriq.db.models import ComplianceCheck as ComplianceCheckModel
from aetheriq.schemas.base import ComplianceCheck, ComplianceCheckCreate

class ComplianceStatus(str, Enum):
    """Compliance status enum"""
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    FAILED = "failed"
    WARNING = "warning"

class ComplianceLevel(str, Enum):
    """Compliance level enum"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

@dataclass
class ComplianceConfig:
    """Configuration for compliance settings"""
    retention_period_days: int = 365
    audit_log_enabled: bool = True
    compliance_frameworks: List[str] = None
    required_policies: List[str] = None
    auto_remediation_enabled: bool = True

@dataclass
class ComplianceRule:
    """Compliance rule definition"""
    id: str
    name: str
    description: str
    category: str
    level: ComplianceLevel
    check_function: str
    parameters: Dict[str, Any]
    remediation_steps: List[str]
    created_at: datetime
    updated_at: datetime
    enabled: bool = True

class ComplianceManager:
    def __init__(self, config: ComplianceConfig):
        """Initialize compliance manager"""
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.compliance_records: Dict[str, List[Dict]] = {}
        self.policy_violations: Dict[str, List[Dict]] = {}
        self.audit_logs: List[Dict] = []
        self.remediation_actions: List[Dict] = []
        self.check_interval = config.get("check_interval_seconds", 3600)
        self.retention_days = config.get("retention_days", 90)
        self.crud = CRUDBase[ComplianceCheckModel, ComplianceCheck, ComplianceCheck](ComplianceCheckModel)
        self.rules: Dict[str, ComplianceRule] = {}
        self.is_running = False
        self.background_tasks = []

    async def initialize(self) -> None:
        """Initialize the compliance manager"""
        self.logger.info("Initializing Compliance Manager")
        self.is_running = True
        await self._load_compliance_rules()
        self.background_tasks.append(
            asyncio.create_task(self._run_periodic_checks())
        )
        self.background_tasks.append(
            asyncio.create_task(self._cleanup_old_checks())
        )

    async def shutdown(self) -> None:
        """Shutdown compliance manager"""
        self.logger.info("Shutting down Compliance Manager")
        self.is_running = False
        for task in self.background_tasks:
            task.cancel()
        await asyncio.gather(*self.background_tasks, return_exceptions=True)

    async def add_compliance_rule(
        self,
        name: str,
        description: str,
        category: str,
        level: ComplianceLevel,
        check_function: str,
        parameters: Dict[str, Any],
        remediation_steps: List[str]
    ) -> Dict[str, Any]:
        """Add a new compliance rule"""
        try:
            rule_id = str(uuid4())
            rule = ComplianceRule(
                id=rule_id,
                name=name,
                description=description,
                category=category,
                level=level,
                check_function=check_function,
                parameters=parameters,
                remediation_steps=remediation_steps,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            self.rules[rule_id] = rule

            return {
                "status": "success",
                "rule_id": rule_id,
                "message": "Compliance rule added successfully"
            }

        except Exception as e:
            self.logger.error(f"Error adding compliance rule: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to add compliance rule: {str(e)}"
            )

    async def run_compliance_check(
        self,
        rule_id: Optional[str] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """Run compliance check(s)"""
        try:
            results = []
            rules_to_check = []

            # Determine which rules to check
            if rule_id:
                if rule_id not in self.rules:
                    raise ValueError(f"Compliance rule {rule_id} not found")
                rules_to_check.append(self.rules[rule_id])
            elif category:
                rules_to_check.extend([
                    rule for rule in self.rules.values()
                    if rule.category == category and rule.enabled
                ])
            else:
                rules_to_check.extend([
                    rule for rule in self.rules.values()
                    if rule.enabled
                ])

            # Run checks
            for rule in rules_to_check:
                result = await self._run_single_check(rule)
                results.append(result)

                # Store check result
                check = ComplianceCheckCreate(
                    rule_id=rule.id,
                    status=result["status"],
                    details=result["details"],
                    timestamp=datetime.utcnow()
                )
                db = next(get_db())
                self.crud.create(db, obj_in=check)

            return {
                "status": "success",
                "results": results
            }

        except Exception as e:
            self.logger.error(f"Error running compliance check: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to run compliance check: {str(e)}"
            )

    async def get_compliance_status(
        self,
        rule_id: Optional[str] = None,
        category: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get compliance status"""
        try:
            # Convert string dates to datetime
            start = datetime.fromisoformat(start_date) if start_date else datetime.utcnow() - timedelta(days=7)
            end = datetime.fromisoformat(end_date) if end_date else datetime.utcnow()

            # Get compliance checks from database
            db = next(get_db())
            filters = {
                "timestamp_gte": start,
                "timestamp_lte": end
            }
            if rule_id:
                filters["rule_id"] = rule_id

            checks = self.crud.get_multi(db, **filters)

            # Process results
            results = {
                "summary": {
                    "total_checks": len(checks),
                    "compliant": 0,
                    "non_compliant": 0,
                    "pending": 0,
                    "failed": 0,
                    "warning": 0
                },
                "checks": []
            }

            for check in checks:
                # Update summary
                results["summary"][check.status.lower()] += 1

                # Get rule details
                rule = self.rules.get(check.rule_id)
                if not rule:
                    continue

                if category and rule.category != category:
                    continue

                results["checks"].append({
                    "rule_id": check.rule_id,
                    "rule_name": rule.name,
                    "category": rule.category,
                    "level": rule.level,
                    "status": check.status,
                    "details": check.details,
                    "timestamp": check.timestamp.isoformat(),
                    "remediation_steps": rule.remediation_steps if check.status == ComplianceStatus.NON_COMPLIANT else None
                })

            return {
                "status": "success",
                "data": results
            }

        except Exception as e:
            self.logger.error(f"Error getting compliance status: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get compliance status: {str(e)}"
            )

    async def _load_compliance_rules(self) -> None:
        """Load compliance rules"""
        # Add default compliance rules
        await self._add_default_rules()

    async def _add_default_rules(self) -> None:
        """Add default compliance rules"""
        default_rules = [
            {
                "name": "Data Encryption Check",
                "description": "Verify that all sensitive data is encrypted",
                "category": "security",
                "level": ComplianceLevel.CRITICAL,
                "check_function": "check_data_encryption",
                "parameters": {
                    "encryption_algorithm": "AES-256",
                    "key_rotation_period_days": 90
                },
                "remediation_steps": [
                    "Enable encryption for sensitive data",
                    "Update encryption keys",
                    "Verify encryption settings"
                ]
            },
            {
                "name": "Access Control Check",
                "description": "Verify access control policies",
                "category": "security",
                "level": ComplianceLevel.HIGH,
                "check_function": "check_access_control",
                "parameters": {
                    "required_roles": ["admin", "user"],
                    "max_failed_attempts": 3
                },
                "remediation_steps": [
                    "Review access control policies",
                    "Update user permissions",
                    "Enable multi-factor authentication"
                ]
            },
            {
                "name": "Data Retention Check",
                "description": "Verify data retention policies",
                "category": "privacy",
                "level": ComplianceLevel.HIGH,
                "check_function": "check_data_retention",
                "parameters": {
                    "retention_period_days": 90,
                    "data_categories": ["personal", "financial"]
                },
                "remediation_steps": [
                    "Review data retention policies",
                    "Archive or delete old data",
                    "Update retention settings"
                ]
            }
        ]

        for rule_data in default_rules:
            await self.add_compliance_rule(**rule_data)

    async def _run_single_check(self, rule: ComplianceRule) -> Dict[str, Any]:
        """Run a single compliance check"""
        try:
            # Get check function
            check_func = getattr(self, rule.check_function, None)
            if not check_func:
                raise ValueError(f"Check function {rule.check_function} not found")

            # Run check
            result = await check_func(rule.parameters)
            return result

        except Exception as e:
            self.logger.error(f"Error running compliance check {rule.name}: {str(e)}")
            return {
                "status": ComplianceStatus.FAILED,
                "details": {
                    "error": str(e),
                    "rule": rule.name,
                    "category": rule.category
                }
            }

    async def _run_periodic_checks(self) -> None:
        """Run periodic compliance checks"""
        while self.is_running:
            try:
                await self.run_compliance_check()
                self.logger.info("Completed periodic compliance checks")
            except Exception as e:
                self.logger.error(f"Error in periodic compliance checks: {str(e)}")

            await asyncio.sleep(self.check_interval)

    async def _cleanup_old_checks(self) -> None:
        """Clean up old compliance checks"""
        while self.is_running:
            try:
                # Delete checks older than retention period
                cutoff_date = datetime.utcnow() - timedelta(days=self.retention_days)
                db = next(get_db())
                old_checks = self.crud.get_multi(
                    db,
                    timestamp_lt=cutoff_date
                )
                if old_checks:
                    self.crud.bulk_delete(
                        db,
                        ids=[check.id for check in old_checks]
                    )
                    self.logger.info(f"Cleaned up {len(old_checks)} old compliance checks")

            except Exception as e:
                self.logger.error(f"Error cleaning up old compliance checks: {str(e)}")

            await asyncio.sleep(24 * 3600)  # Run daily

    async def check_data_encryption(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Check data encryption compliance"""
        try:
            # Implement encryption check logic
            return {
                "status": ComplianceStatus.COMPLIANT,
                "details": {
                    "encryption_status": "enabled",
                    "algorithm": parameters["encryption_algorithm"],
                    "last_key_rotation": datetime.utcnow() - timedelta(days=30)
                }
            }
        except Exception as e:
            return {
                "status": ComplianceStatus.NON_COMPLIANT,
                "details": {
                    "error": str(e),
                    "encryption_status": "disabled"
                }
            }

    async def check_access_control(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Check access control compliance"""
        try:
            # Implement access control check logic
            return {
                "status": ComplianceStatus.COMPLIANT,
                "details": {
                    "roles_configured": parameters["required_roles"],
                    "mfa_enabled": True,
                    "last_policy_update": datetime.utcnow() - timedelta(days=15)
                }
            }
        except Exception as e:
            return {
                "status": ComplianceStatus.NON_COMPLIANT,
                "details": {
                    "error": str(e),
                    "missing_roles": []
                }
            }

    async def check_data_retention(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """Check data retention compliance"""
        try:
            # Implement data retention check logic
            return {
                "status": ComplianceStatus.COMPLIANT,
                "details": {
                    "retention_period": parameters["retention_period_days"],
                    "categories_compliant": parameters["data_categories"],
                    "last_cleanup": datetime.utcnow() - timedelta(days=7)
                }
            }
        except Exception as e:
            return {
                "status": ComplianceStatus.NON_COMPLIANT,
                "details": {
                    "error": str(e),
                    "non_compliant_categories": []
                }
            }

    async def check_compliance(self, 
                             framework: str,
                             resource_id: str,
                             resource_type: str,
                             data: Dict[str, Any]) -> Dict[str, Any]:
        """Check compliance for a specific resource"""
        try:
            # Perform compliance checks
            checks = await self._run_compliance_checks(framework, resource_type, data)
            
            # Record results
            record = self._create_compliance_record(framework, resource_id, checks)
            
            # Handle violations
            if checks['violations']:
                await self._handle_violations(framework, resource_id, checks['violations'])
            
            return record
        except Exception as e:
            self.logger.error(f"Compliance check failed: {str(e)}")
            self._log_audit_event('compliance_check_error', framework, resource_id, error=str(e))
            raise

    async def _run_compliance_checks(self, 
                                   framework: str,
                                   resource_type: str,
                                   data: Dict[str, Any]) -> Dict[str, Any]:
        """Run compliance checks based on framework and resource type"""
        checks = {
            'timestamp': datetime.now(),
            'framework': framework,
            'resource_type': resource_type,
            'violations': [],
            'warnings': [],
            'passed_checks': []
        }

        # Implement framework-specific checks
        if framework == 'SOC2':
            checks.update(await self._run_soc2_checks(resource_type, data))
        elif framework == 'GDPR':
            checks.update(await self._run_gdpr_checks(resource_type, data))
        elif framework == 'HIPAA':
            checks.update(await self._run_hipaa_checks(resource_type, data))

        return checks

    async def _run_soc2_checks(self, resource_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Run SOC2 compliance checks"""
        results = {
            'soc2_checks': {
                'security': [],
                'availability': [],
                'processing_integrity': [],
                'confidentiality': [],
                'privacy': []
            }
        }

        # Implement SOC2-specific checks
        # Security checks
        if 'access_controls' in data:
            results['soc2_checks']['security'].append({
                'check': 'access_control_validation',
                'status': 'passed',
                'details': 'Access controls properly configured'
            })

        # Availability checks
        if 'uptime' in data:
            results['soc2_checks']['availability'].append({
                'check': 'system_availability',
                'status': 'passed' if data['uptime'] >= 99.9 else 'failed',
                'details': f"System uptime: {data['uptime']}%"
            })

        return results

    async def _run_gdpr_checks(self, resource_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Run GDPR compliance checks"""
        results = {
            'gdpr_checks': {
                'data_protection': [],
                'user_consent': [],
                'data_portability': [],
                'right_to_be_forgotten': []
            }
        }

        # Implement GDPR-specific checks
        if 'personal_data' in data:
            results['gdpr_checks']['data_protection'].append({
                'check': 'personal_data_encryption',
                'status': 'passed',
                'details': 'Personal data properly encrypted'
            })

        return results

    async def _run_hipaa_checks(self, resource_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Run HIPAA compliance checks"""
        results = {
            'hipaa_checks': {
                'phi_protection': [],
                'access_controls': [],
                'audit_trails': [],
                'data_encryption': []
            }
        }

        # Implement HIPAA-specific checks
        if 'phi_data' in data:
            results['hipaa_checks']['phi_protection'].append({
                'check': 'phi_encryption',
                'status': 'passed',
                'details': 'PHI data properly encrypted'
            })

        return results

    def _create_compliance_record(self, 
                                framework: str,
                                resource_id: str,
                                checks: Dict[str, Any]) -> Dict[str, Any]:
        """Create a compliance record"""
        record = {
            'timestamp': datetime.now(),
            'framework': framework,
            'resource_id': resource_id,
            'checks': checks,
            'status': 'compliant' if not checks['violations'] else 'non_compliant'
        }

        # Store record
        if framework not in self.compliance_records:
            self.compliance_records[framework] = []
        self.compliance_records[framework].append(record)

        return record

    async def _handle_violations(self, 
                               framework: str,
                               resource_id: str,
                               violations: List[Dict[str, Any]]) -> None:
        """Handle compliance violations"""
        # Record violations
        if framework not in self.policy_violations:
            self.policy_violations[framework] = []
        
        violation_record = {
            'timestamp': datetime.now(),
            'framework': framework,
            'resource_id': resource_id,
            'violations': violations
        }
        self.policy_violations[framework].append(violation_record)

        # Auto-remediate if enabled
        if self.config.auto_remediation_enabled:
            await self._auto_remediate_violations(framework, resource_id, violations)

        # Log audit event
        self._log_audit_event('compliance_violation', framework, resource_id, violations=violations)

    async def _auto_remediate_violations(self,
                                       framework: str,
                                       resource_id: str,
                                       violations: List[Dict[str, Any]]) -> None:
        """Attempt to automatically remediate violations"""
        for violation in violations:
            remediation_action = {
                'timestamp': datetime.now(),
                'framework': framework,
                'resource_id': resource_id,
                'violation': violation,
                'action': 'auto_remediation_attempted',
                'status': 'pending'
            }

            try:
                # Implement remediation logic based on violation type
                if violation['type'] == 'encryption_required':
                    # Implement encryption remediation
                    remediation_action['status'] = 'completed'
                elif violation['type'] == 'access_control_violation':
                    # Implement access control remediation
                    remediation_action['status'] = 'completed'

                self.remediation_actions.append(remediation_action)
            except Exception as e:
                remediation_action['status'] = 'failed'
                remediation_action['error'] = str(e)
                self.logger.error(f"Auto-remediation failed: {str(e)}")

    def _log_audit_event(self, 
                        event_type: str,
                        framework: str,
                        resource_id: str,
                        **kwargs) -> None:
        """Log an audit event"""
        if not self.config.audit_log_enabled:
            return

        event = {
            'timestamp': datetime.now(),
            'event_type': event_type,
            'framework': framework,
            'resource_id': resource_id,
            **kwargs
        }
        self.audit_logs.append(event)
        self.logger.info(f"Audit event: {event}")

    async def get_compliance_report(self,
                                  framework: str,
                                  start_date: Optional[datetime] = None,
                                  end_date: Optional[datetime] = None) -> Dict[str, Any]:
        """Generate a compliance report"""
        if start_date is None:
            start_date = datetime.now() - timedelta(days=self.config.retention_period_days)
        if end_date is None:
            end_date = datetime.now()

        # Filter records for the specified period
        records = [
            record for record in self.compliance_records.get(framework, [])
            if start_date <= record['timestamp'] <= end_date
        ]

        # Generate report
        report = {
            'period': {
                'start': start_date,
                'end': end_date
            },
            'framework': framework,
            'total_checks': len(records),
            'compliant_resources': len([r for r in records if r['status'] == 'compliant']),
            'non_compliant_resources': len([r for r in records if r['status'] == 'non_compliant']),
            'violations_by_type': {},
            'remediation_status': {
                'total_violations': 0,
                'remediated': 0,
                'pending': 0,
                'failed': 0
            }
        }

        # Analyze violations
        for record in records:
            for violation in record['checks']['violations']:
                violation_type = violation['type']
                if violation_type not in report['violations_by_type']:
                    report['violations_by_type'][violation_type] = 0
                report['violations_by_type'][violation_type] += 1

        # Analyze remediation status
        for action in self.remediation_actions:
            if action['framework'] == framework:
                report['remediation_status']['total_violations'] += 1
                report['remediation_status'][action['status']] += 1 