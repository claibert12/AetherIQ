from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
import asyncio
from pydantic import BaseModel
import numpy as np
from sklearn.ensemble import IsolationForest
from app.core.config import settings

class ErrorPattern(BaseModel):
    error_type: str
    error_message: str
    stack_trace: str
    context: Dict[str, Any]
    timestamp: datetime
    severity: str
    workflow_id: int
    retry_count: int
    resolution_status: str

class RetryStrategy(BaseModel):
    stage: str  # immediate, delayed, manual
    max_retries: int
    backoff_factor: float
    initial_delay: float
    max_delay: float
    conditions: Dict[str, Any]

class ErrorHandler:
    def __init__(self, db: Session):
        self.db = db
        self.logger = logging.getLogger(__name__)
        self.anomaly_detector = IsolationForest(
            contamination=0.1,
            random_state=42
        )
        self._initialize_error_patterns()
    
    def _initialize_error_patterns(self):
        """Initialize error pattern detection model"""
        try:
            # Get historical error patterns
            patterns = self._get_historical_error_patterns()
            
            if patterns:
                # Train anomaly detector
                features = self._extract_features(patterns)
                self.anomaly_detector.fit(features)
            
            self.logger.info("Error pattern detection model initialized")
        except Exception as e:
            self.logger.error(f"Failed to initialize error patterns: {str(e)}")
    
    def _get_historical_error_patterns(self) -> List[ErrorPattern]:
        """Get historical error patterns from database"""
        try:
            query = text("""
                SELECT 
                    error_type,
                    error_message,
                    stack_trace,
                    context,
                    timestamp,
                    severity,
                    workflow_id,
                    retry_count,
                    resolution_status
                FROM error_patterns
                WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '30 days'
            """)
            
            result = self.db.execute(query).fetchall()
            
            return [
                ErrorPattern(
                    error_type=row.error_type,
                    error_message=row.error_message,
                    stack_trace=row.stack_trace,
                    context=row.context,
                    timestamp=row.timestamp,
                    severity=row.severity,
                    workflow_id=row.workflow_id,
                    retry_count=row.retry_count,
                    resolution_status=row.resolution_status
                )
                for row in result
            ]
        except Exception as e:
            self.logger.error(f"Failed to get historical error patterns: {str(e)}")
            return []
    
    def _extract_features(self, patterns: List[ErrorPattern]) -> np.ndarray:
        """Extract features from error patterns for anomaly detection"""
        try:
            features = []
            for pattern in patterns:
                feature_vector = [
                    len(pattern.error_message),
                    len(pattern.stack_trace),
                    pattern.retry_count,
                    self._severity_to_numeric(pattern.severity),
                    self._timestamp_to_numeric(pattern.timestamp)
                ]
                features.append(feature_vector)
            
            return np.array(features)
        except Exception as e:
            self.logger.error(f"Failed to extract features: {str(e)}")
            return np.array([])
    
    def _severity_to_numeric(self, severity: str) -> int:
        """Convert severity string to numeric value"""
        severity_map = {
            "critical": 4,
            "high": 3,
            "medium": 2,
            "low": 1
        }
        return severity_map.get(severity.lower(), 0)
    
    def _timestamp_to_numeric(self, timestamp: datetime) -> float:
        """Convert timestamp to numeric value (hours since epoch)"""
        return (timestamp - datetime(1970, 1, 1)).total_seconds() / 3600
    
    async def handle_error(
        self,
        error: Exception,
        workflow_id: int,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle workflow error and determine recovery strategy"""
        try:
            # Create error pattern
            pattern = ErrorPattern(
                error_type=type(error).__name__,
                error_message=str(error),
                stack_trace=self._get_stack_trace(error),
                context=context,
                timestamp=datetime.utcnow(),
                severity=self._determine_severity(error),
                workflow_id=workflow_id,
                retry_count=0,
                resolution_status="pending"
            )
            
            # Check if error is anomalous
            is_anomaly = self._detect_anomaly(pattern)
            
            # Get retry strategy
            strategy = self._get_retry_strategy(pattern, is_anomaly)
            
            # Log error pattern
            self._log_error_pattern(pattern)
            
            # Execute retry strategy
            recovery_result = await self._execute_retry_strategy(
                pattern,
                strategy
            )
            
            return {
                "status": "success",
                "pattern": pattern.dict(),
                "strategy": strategy.dict(),
                "recovery_result": recovery_result
            }
        except Exception as e:
            self.logger.error(f"Error handling failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    def _get_stack_trace(self, error: Exception) -> str:
        """Get formatted stack trace from exception"""
        import traceback
        return "".join(traceback.format_exception(
            type(error),
            error,
            error.__traceback__
        ))
    
    def _determine_severity(self, error: Exception) -> str:
        """Determine error severity based on error type and context"""
        # Define severity rules
        severity_rules = {
            "ConnectionError": "high",
            "TimeoutError": "medium",
            "ValueError": "low",
            "KeyError": "medium",
            "TypeError": "low"
        }
        
        error_type = type(error).__name__
        return severity_rules.get(error_type, "medium")
    
    def _detect_anomaly(self, pattern: ErrorPattern) -> bool:
        """Detect if error pattern is anomalous"""
        try:
            # Extract features for current pattern
            features = self._extract_features([pattern])
            
            if len(features) == 0:
                return False
            
            # Predict if pattern is anomalous
            prediction = self.anomaly_detector.predict(features)
            
            return prediction[0] == -1  # -1 indicates anomaly
        except Exception as e:
            self.logger.error(f"Anomaly detection failed: {str(e)}")
            return False
    
    def _get_retry_strategy(
        self,
        pattern: ErrorPattern,
        is_anomaly: bool
    ) -> RetryStrategy:
        """Determine retry strategy based on error pattern"""
        if pattern.severity == "critical":
            return RetryStrategy(
                stage="immediate",
                max_retries=3,
                backoff_factor=1.5,
                initial_delay=1.0,
                max_delay=30.0,
                conditions={
                    "severity": "critical",
                    "is_anomaly": is_anomaly
                }
            )
        elif pattern.severity == "high":
            return RetryStrategy(
                stage="delayed",
                max_retries=5,
                backoff_factor=2.0,
                initial_delay=5.0,
                max_delay=300.0,
                conditions={
                    "severity": "high",
                    "is_anomaly": is_anomaly
                }
            )
        else:
            return RetryStrategy(
                stage="manual",
                max_retries=1,
                backoff_factor=1.0,
                initial_delay=0.0,
                max_delay=0.0,
                conditions={
                    "severity": pattern.severity,
                    "is_anomaly": is_anomaly
                }
            )
    
    def _log_error_pattern(self, pattern: ErrorPattern):
        """Log error pattern to database"""
        try:
            query = text("""
                INSERT INTO error_patterns (
                    error_type,
                    error_message,
                    stack_trace,
                    context,
                    timestamp,
                    severity,
                    workflow_id,
                    retry_count,
                    resolution_status
                ) VALUES (
                    :error_type,
                    :error_message,
                    :stack_trace,
                    :context,
                    :timestamp,
                    :severity,
                    :workflow_id,
                    :retry_count,
                    :resolution_status
                )
            """)
            
            self.db.execute(query, pattern.dict())
            self.db.commit()
        except Exception as e:
            self.logger.error(f"Failed to log error pattern: {str(e)}")
            self.db.rollback()
    
    async def _execute_retry_strategy(
        self,
        pattern: ErrorPattern,
        strategy: RetryStrategy
    ) -> Dict[str, Any]:
        """Execute retry strategy for error recovery"""
        try:
            if strategy.stage == "immediate":
                return await self._execute_immediate_retry(pattern, strategy)
            elif strategy.stage == "delayed":
                return await self._execute_delayed_retry(pattern, strategy)
            else:
                return await self._execute_manual_retry(pattern, strategy)
        except Exception as e:
            self.logger.error(f"Retry strategy execution failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _execute_immediate_retry(
        self,
        pattern: ErrorPattern,
        strategy: RetryStrategy
    ) -> Dict[str, Any]:
        """Execute immediate retry with exponential backoff"""
        try:
            delay = strategy.initial_delay
            for attempt in range(strategy.max_retries):
                try:
                    # Wait with exponential backoff
                    await asyncio.sleep(delay)
                    
                    # Attempt recovery
                    success = await self._attempt_recovery(pattern)
                    
                    if success:
                        return {
                            "status": "success",
                            "attempt": attempt + 1,
                            "delay": delay
                        }
                    
                    # Increase delay for next attempt
                    delay = min(
                        delay * strategy.backoff_factor,
                        strategy.max_delay
                    )
                except Exception as e:
                    self.logger.error(f"Retry attempt {attempt + 1} failed: {str(e)}")
                    delay = min(
                        delay * strategy.backoff_factor,
                        strategy.max_delay
                    )
            
            return {
                "status": "failed",
                "attempts": strategy.max_retries,
                "final_delay": delay
            }
        except Exception as e:
            self.logger.error(f"Immediate retry failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _execute_delayed_retry(
        self,
        pattern: ErrorPattern,
        strategy: RetryStrategy
    ) -> Dict[str, Any]:
        """Execute delayed retry with longer intervals"""
        try:
            delay = strategy.initial_delay
            for attempt in range(strategy.max_retries):
                try:
                    # Wait with longer delay
                    await asyncio.sleep(delay)
                    
                    # Attempt recovery
                    success = await self._attempt_recovery(pattern)
                    
                    if success:
                        return {
                            "status": "success",
                            "attempt": attempt + 1,
                            "delay": delay
                        }
                    
                    # Increase delay for next attempt
                    delay = min(
                        delay * strategy.backoff_factor,
                        strategy.max_delay
                    )
                except Exception as e:
                    self.logger.error(f"Delayed retry attempt {attempt + 1} failed: {str(e)}")
                    delay = min(
                        delay * strategy.backoff_factor,
                        strategy.max_delay
                    )
            
            return {
                "status": "failed",
                "attempts": strategy.max_retries,
                "final_delay": delay
            }
        except Exception as e:
            self.logger.error(f"Delayed retry failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _execute_manual_retry(
        self,
        pattern: ErrorPattern,
        strategy: RetryStrategy
    ) -> Dict[str, Any]:
        """Execute manual retry with notification"""
        try:
            # Log manual intervention required
            self._log_manual_intervention(pattern)
            
            # Send notification
            await self._send_notification(pattern)
            
            return {
                "status": "manual_intervention_required",
                "pattern": pattern.dict()
            }
        except Exception as e:
            self.logger.error(f"Manual retry failed: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _attempt_recovery(self, pattern: ErrorPattern) -> bool:
        """Attempt to recover from error"""
        try:
            # Get workflow details
            workflow = self._get_workflow_details(pattern.workflow_id)
            
            if not workflow:
                return False
            
            # Attempt to recover workflow state
            success = await self._recover_workflow_state(workflow)
            
            if success:
                # Update error pattern status
                self._update_error_pattern_status(pattern, "resolved")
                return True
            
            return False
        except Exception as e:
            self.logger.error(f"Recovery attempt failed: {str(e)}")
            return False
    
    def _get_workflow_details(self, workflow_id: int) -> Optional[Dict[str, Any]]:
        """Get workflow details from database"""
        try:
            query = text("""
                SELECT 
                    id,
                    name,
                    status,
                    input_data,
                    output_data,
                    error_message,
                    execution_time,
                    resource_usage
                FROM workflows
                WHERE id = :workflow_id
            """)
            
            result = self.db.execute(query, {
                "workflow_id": workflow_id
            }).first()
            
            return dict(result) if result else None
        except Exception as e:
            self.logger.error(f"Failed to get workflow details: {str(e)}")
            return None
    
    async def _recover_workflow_state(self, workflow: Dict[str, Any]) -> bool:
        """Recover workflow state"""
        try:
            # Update workflow status
            query = text("""
                UPDATE workflows
                SET status = 'recovering',
                    error_message = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :workflow_id
            """)
            
            self.db.execute(query, {
                "workflow_id": workflow["id"]
            })
            self.db.commit()
            
            # Attempt to restore from last checkpoint
            success = await self._restore_from_checkpoint(workflow)
            
            if success:
                # Update workflow status to running
                query = text("""
                    UPDATE workflows
                    SET status = 'running',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = :workflow_id
                """)
                
                self.db.execute(query, {
                    "workflow_id": workflow["id"]
                })
                self.db.commit()
                return True
            
            return False
        except Exception as e:
            self.logger.error(f"Workflow state recovery failed: {str(e)}")
            self.db.rollback()
            return False
    
    async def _restore_from_checkpoint(self, workflow: Dict[str, Any]) -> bool:
        """Restore workflow state from last checkpoint"""
        try:
            # Get last checkpoint
            query = text("""
                SELECT checkpoint_data
                FROM workflow_checkpoints
                WHERE workflow_id = :workflow_id
                ORDER BY created_at DESC
                LIMIT 1
            """)
            
            result = self.db.execute(query, {
                "workflow_id": workflow["id"]
            }).first()
            
            if not result:
                return False
            
            # Restore state from checkpoint
            checkpoint_data = result.checkpoint_data
            
            # Update workflow with checkpoint data
            query = text("""
                UPDATE workflows
                SET input_data = :input_data,
                    output_data = :output_data,
                    resource_usage = :resource_usage,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :workflow_id
            """)
            
            self.db.execute(query, {
                "workflow_id": workflow["id"],
                "input_data": checkpoint_data.get("input_data"),
                "output_data": checkpoint_data.get("output_data"),
                "resource_usage": checkpoint_data.get("resource_usage")
            })
            
            self.db.commit()
            return True
        except Exception as e:
            self.logger.error(f"Checkpoint restoration failed: {str(e)}")
            self.db.rollback()
            return False
    
    def _log_manual_intervention(self, pattern: ErrorPattern):
        """Log manual intervention requirement"""
        try:
            query = text("""
                INSERT INTO manual_interventions (
                    error_pattern_id,
                    workflow_id,
                    status,
                    created_at
                ) VALUES (
                    :error_pattern_id,
                    :workflow_id,
                    'pending',
                    CURRENT_TIMESTAMP
                )
            """)
            
            self.db.execute(query, {
                "error_pattern_id": pattern.id,
                "workflow_id": pattern.workflow_id
            })
            self.db.commit()
        except Exception as e:
            self.logger.error(f"Failed to log manual intervention: {str(e)}")
            self.db.rollback()
    
    async def _send_notification(self, pattern: ErrorPattern):
        """Send notification for manual intervention"""
        try:
            # Get workflow details
            workflow = self._get_workflow_details(pattern.workflow_id)
            
            if not workflow:
                return
            
            # Prepare notification
            notification = {
                "type": "manual_intervention_required",
                "workflow_id": pattern.workflow_id,
                "workflow_name": workflow["name"],
                "error_type": pattern.error_type,
                "error_message": pattern.error_message,
                "severity": pattern.severity,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Send to notification queue
            query = text("""
                INSERT INTO notifications (
                    type,
                    data,
                    status,
                    created_at
                ) VALUES (
                    :type,
                    :data,
                    'pending',
                    CURRENT_TIMESTAMP
                )
            """)
            
            self.db.execute(query, {
                "type": "manual_intervention",
                "data": json.dumps(notification)
            })
            self.db.commit()
        except Exception as e:
            self.logger.error(f"Failed to send notification: {str(e)}")
            self.db.rollback()
    
    def _update_error_pattern_status(
        self,
        pattern: ErrorPattern,
        status: str
    ):
        """Update error pattern status"""
        try:
            query = text("""
                UPDATE error_patterns
                SET resolution_status = :status,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :id
            """)
            
            self.db.execute(query, {
                "id": pattern.id,
                "status": status
            })
            self.db.commit()
        except Exception as e:
            self.logger.error(f"Failed to update error pattern status: {str(e)}")
            self.db.rollback() 