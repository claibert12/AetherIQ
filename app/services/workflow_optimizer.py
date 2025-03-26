from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score, TimeSeriesSplit
from sklearn.metrics import mean_squared_error, r2_score
from pydantic import BaseModel
import json
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor
import pandas as pd
from scipy import stats
import joblib

class WorkflowMetrics(BaseModel):
    workflow_id: int
    name: str
    total_executions: int
    avg_execution_time: float
    max_execution_time: float
    min_execution_time: float
    failed_executions: int
    tenant_id: int

class WorkflowExecution(BaseModel):
    id: int
    workflow_id: int
    started_at: datetime
    completed_at: Optional[datetime]
    status: str
    input_data: Dict[str, Any]
    output_data: Optional[Dict[str, Any]]
    error_message: Optional[str]
    execution_time: Optional[float]
    resource_usage: Dict[str, Any]
    optimization_suggestions: Optional[Dict[str, Any]]
    risk_alerts: Optional[Dict[str, Any]]
    tenant_id: int

class WorkflowOptimizer:
    _model_cache = {}
    _executor = ThreadPoolExecutor(max_workers=4)
    _feature_cache = {}
    
    def __init__(self, db: Session):
        self.db = db
        self.logger = logging.getLogger(__name__)
        self._performance_model = None
        self._scaler = None
        self._model_initialized = False
        self._model_metrics = {}
    
    @property
    def performance_model(self):
        if not self._model_initialized:
            self._initialize_models()
        return self._performance_model
    
    @property
    def scaler(self):
        if not self._model_initialized:
            self._initialize_models()
        return self._scaler
    
    def _extract_advanced_features(self, executions: List[WorkflowExecution]) -> np.ndarray:
        """Extract advanced features from workflow executions"""
        try:
            features = []
            for execution in executions:
                # Basic features
                basic_features = [
                    len(execution.input_data),
                    len(execution.resource_usage),
                    execution.resource_usage.get("cpu_usage", 0),
                    execution.resource_usage.get("memory_usage", 0),
                    execution.resource_usage.get("io_operations", 0),
                    self._status_to_numeric(execution.status),
                    self._get_complexity_score(execution.input_data)
                ]
                
                # Temporal features
                temporal_features = self._extract_temporal_features(execution)
                
                # Resource utilization features
                resource_features = self._extract_resource_features(execution)
                
                # Workflow pattern features
                pattern_features = self._extract_pattern_features(execution)
                
                # Combine all features
                feature_vector = (
                    basic_features +
                    temporal_features +
                    resource_features +
                    pattern_features
                )
                
                features.append(feature_vector)
            
            return np.array(features)
        except Exception as e:
            self.logger.error(f"Failed to extract advanced features: {str(e)}")
            return np.array([])
    
    def _extract_temporal_features(self, execution: WorkflowExecution) -> List[float]:
        """Extract temporal patterns from workflow execution"""
        try:
            # Time of day features
            hour = execution.started_at.hour
            day_of_week = execution.started_at.weekday()
            
            # Time-based patterns
            is_business_hour = 1 if 9 <= hour <= 17 else 0
            is_weekend = 1 if day_of_week >= 5 else 0
            
            # Execution duration features
            duration = (execution.completed_at - execution.started_at).total_seconds() if execution.completed_at else 0
            
            return [
                hour,
                day_of_week,
                is_business_hour,
                is_weekend,
                duration
            ]
        except Exception:
            return [0, 0, 0, 0, 0]
    
    def _extract_resource_features(self, execution: WorkflowExecution) -> List[float]:
        """Extract resource utilization patterns"""
        try:
            resource_usage = execution.resource_usage
            
            # CPU features
            cpu_usage = resource_usage.get("cpu_usage", 0)
            cpu_variance = resource_usage.get("cpu_variance", 0)
            
            # Memory features
            memory_usage = resource_usage.get("memory_usage", 0)
            memory_variance = resource_usage.get("memory_variance", 0)
            
            # I/O features
            io_operations = resource_usage.get("io_operations", 0)
            io_wait_time = resource_usage.get("io_wait_time", 0)
            
            # Resource efficiency metrics
            cpu_efficiency = cpu_usage / (io_wait_time + 1)  # Avoid division by zero
            memory_efficiency = memory_usage / (io_operations + 1)
            
            return [
                cpu_usage,
                cpu_variance,
                memory_usage,
                memory_variance,
                io_operations,
                io_wait_time,
                cpu_efficiency,
                memory_efficiency
            ]
        except Exception:
            return [0] * 8
    
    def _extract_pattern_features(self, execution: WorkflowExecution) -> List[float]:
        """Extract workflow pattern features"""
        try:
            # Input data patterns
            input_data = execution.input_data
            
            # Data size patterns
            data_size = sum(len(str(v)) for v in input_data.values())
            field_count = len(input_data)
            
            # Complexity patterns
            nested_depth = self._calculate_nested_depth(input_data)
            array_count = sum(1 for v in input_data.values() if isinstance(v, list))
            
            # Pattern indicators
            has_large_arrays = 1 if array_count > 0 else 0
            has_complex_objects = 1 if nested_depth > 2 else 0
            
            return [
                data_size,
                field_count,
                nested_depth,
                array_count,
                has_large_arrays,
                has_complex_objects
            ]
        except Exception:
            return [0] * 6
    
    def _calculate_nested_depth(self, data: Any, current_depth: int = 0) -> int:
        """Calculate maximum nesting depth of data structure"""
        if isinstance(data, dict):
            return max(
                self._calculate_nested_depth(v, current_depth + 1)
                for v in data.values()
            )
        elif isinstance(data, list):
            return max(
                self._calculate_nested_depth(item, current_depth + 1)
                for item in data
            )
        return current_depth
    
    def _initialize_models(self):
        """Initialize AI models with improved architecture"""
        try:
            cache_key = f"{self.db.bind.url.database}_{datetime.now().date()}"
            
            if cache_key in self._model_cache:
                self._performance_model, self._scaler = self._model_cache[cache_key]
                self._model_initialized = True
                return
            
            # Get historical workflow data
            workflow_data = self._get_historical_workflow_data()
            
            if workflow_data:
                # Extract advanced features
                features = self._extract_advanced_features(workflow_data)
                targets = self._extract_performance_targets(workflow_data)
                
                if len(features) > 0 and len(targets) > 0:
                    # Scale features
                    self._scaler = StandardScaler()
                    scaled_features = self._scaler.fit_transform(features)
                    
                    # Train multiple models
                    models = {
                        'rf': RandomForestRegressor(
                            n_estimators=100,
                            max_depth=10,
                            min_samples_split=5,
                            random_state=42,
                            n_jobs=-1
                        ),
                        'gb': GradientBoostingRegressor(
                            n_estimators=100,
                            max_depth=5,
                            learning_rate=0.1,
                            random_state=42
                        )
                    }
                    
                    # Cross-validation
                    tscv = TimeSeriesSplit(n_splits=5)
                    best_model = None
                    best_score = float('-inf')
                    
                    for name, model in models.items():
                        scores = cross_val_score(
                            model,
                            scaled_features,
                            targets,
                            cv=tscv,
                            scoring='r2'
                        )
                        mean_score = np.mean(scores)
                        
                        if mean_score > best_score:
                            best_score = mean_score
                            best_model = model
                    
                    # Train best model on full dataset
                    self._performance_model = best_model
                    self._performance_model.fit(scaled_features, targets)
                    
                    # Calculate model metrics
                    predictions = self._performance_model.predict(scaled_features)
                    self._model_metrics = {
                        'r2_score': r2_score(targets, predictions),
                        'mse': mean_squared_error(targets, predictions),
                        'cross_val_score': best_score
                    }
                    
                    # Cache the models
                    self._model_cache[cache_key] = (self._performance_model, self._scaler)
                    self._model_initialized = True
                    
                    self.logger.info(f"Workflow optimization models initialized with R2 score: {self._model_metrics['r2_score']:.3f}")
        except Exception as e:
            self.logger.error(f"Failed to initialize models: {str(e)}")
            raise
    
    def _validate_model_predictions(self, predictions: np.ndarray) -> bool:
        """Validate model predictions using statistical methods"""
        try:
            # Check for outliers using Z-score
            z_scores = stats.zscore(predictions)
            outliers = np.abs(z_scores) > 3
            
            # Check prediction distribution
            prediction_mean = np.mean(predictions)
            prediction_std = np.std(predictions)
            
            # Validate against historical data
            historical_data = self._get_historical_workflow_data()
            if historical_data:
                historical_times = [
                    e.execution_time for e in historical_data
                    if e.execution_time is not None
                ]
                
                if historical_times:
                    historical_mean = np.mean(historical_times)
                    historical_std = np.std(historical_times)
                    
                    # Check if predictions are within reasonable bounds
                    within_bounds = (
                        np.all(predictions >= historical_mean - 3 * historical_std) and
                        np.all(predictions <= historical_mean + 3 * historical_std)
                    )
                    
                    return within_bounds and not np.any(outliers)
            
            return True
        except Exception:
            return True  # Default to True if validation fails
    
    def _get_model_confidence(self, features: np.ndarray) -> float:
        """Calculate model confidence for predictions"""
        try:
            if not hasattr(self._performance_model, 'predict_proba'):
                return 0.5  # Default confidence for non-probabilistic models
            
            # Get prediction probabilities
            probabilities = self._performance_model.predict_proba(features)
            
            # Calculate confidence as maximum probability
            confidence = np.max(probabilities, axis=1)
            
            return float(np.mean(confidence))
        except Exception:
            return 0.5  # Default confidence if calculation fails
    
    def _get_historical_workflow_data(self) -> List[WorkflowExecution]:
        """Get historical workflow execution data with optimized query"""
        try:
            query = text("""
                WITH workflow_stats AS (
                    SELECT 
                        id,
                        workflow_id,
                        started_at,
                        completed_at,
                        status,
                        input_data,
                        output_data,
                        error_message,
                        execution_time,
                        resource_usage,
                        optimization_suggestions,
                        risk_alerts,
                        tenant_id,
                        ROW_NUMBER() OVER (PARTITION BY workflow_id ORDER BY started_at DESC) as rn
                    FROM workflow_executions
                    WHERE started_at > CURRENT_TIMESTAMP - INTERVAL '90 days'
                    AND tenant_id = :tenant_id
                )
                SELECT * FROM workflow_stats
                WHERE rn <= 1000  -- Limit per workflow to prevent memory issues
            """)
            
            result = self.db.execute(query, {"tenant_id": self.db.bind.url.database}).fetchall()
            
            return [
                WorkflowExecution(
                    id=row.id,
                    workflow_id=row.workflow_id,
                    started_at=row.started_at,
                    completed_at=row.completed_at,
                    status=row.status,
                    input_data=row.input_data,
                    output_data=row.output_data,
                    error_message=row.error_message,
                    execution_time=row.execution_time,
                    resource_usage=row.resource_usage,
                    optimization_suggestions=row.optimization_suggestions,
                    risk_alerts=row.risk_alerts,
                    tenant_id=row.tenant_id
                )
                for row in result
            ]
        except Exception as e:
            self.logger.error(f"Failed to get historical workflow data: {str(e)}")
            raise ValueError(f"Failed to fetch historical data: {str(e)}")
    
    def _extract_workflow_features(self, executions: List[WorkflowExecution]) -> np.ndarray:
        """Extract features from workflow executions"""
        try:
            features = []
            for execution in executions:
                feature_vector = [
                    len(execution.input_data),
                    len(execution.resource_usage),
                    execution.resource_usage.get("cpu_usage", 0),
                    execution.resource_usage.get("memory_usage", 0),
                    execution.resource_usage.get("io_operations", 0),
                    self._status_to_numeric(execution.status),
                    self._get_complexity_score(execution.input_data)
                ]
                features.append(feature_vector)
            
            return np.array(features)
        except Exception as e:
            self.logger.error(f"Failed to extract workflow features: {str(e)}")
            return np.array([])
    
    def _extract_performance_targets(self, executions: List[WorkflowExecution]) -> np.ndarray:
        """Extract performance targets from workflow executions"""
        try:
            targets = []
            for execution in executions:
                if execution.execution_time is not None:
                    targets.append(execution.execution_time)
                else:
                    # Calculate execution time from start and completion
                    if execution.completed_at:
                        execution_time = (execution.completed_at - execution.started_at).total_seconds()
                        targets.append(execution_time)
                    else:
                        targets.append(0)  # Use 0 for failed or incomplete executions
            
            return np.array(targets)
        except Exception as e:
            self.logger.error(f"Failed to extract performance targets: {str(e)}")
            return np.array([])
    
    def _status_to_numeric(self, status: str) -> int:
        """Convert workflow status to numeric value"""
        status_map = {
            "completed": 3,
            "running": 2,
            "failed": 1,
            "pending": 0
        }
        return status_map.get(status.lower(), 0)
    
    @lru_cache(maxsize=1000)
    def _get_complexity_score(self, input_data: Dict[str, Any]) -> float:
        """Calculate complexity score for workflow input with caching"""
        try:
            # Count number of fields and nested structures
            field_count = len(input_data)
            nested_count = sum(
                1 for value in input_data.values()
                if isinstance(value, (dict, list))
            )
            
            # Calculate complexity score
            return (field_count * 0.6) + (nested_count * 0.4)
        except Exception as e:
            self.logger.error(f"Failed to calculate complexity score: {str(e)}")
            return 0.0
    
    async def analyze_workflow_performance(self) -> Dict[str, Any]:
        """Analyze workflow performance and identify optimization opportunities"""
        try:
            # Get current workflow metrics
            query = text("""
                SELECT * FROM mv_workflow_metrics
                WHERE tenant_id = :tenant_id
            """)
            
            result = self.db.execute(query, {"tenant_id": 1}).fetchall()
            
            if not result:
                return {"status": "error", "message": "No workflow data available"}
            
            # Analyze each workflow
            workflows = []
            bottlenecks = []
            recommendations = []
            
            for row in result:
                workflow = WorkflowMetrics(**dict(row))
                workflows.append(workflow)
                
                # Identify bottlenecks
                if self._has_bottlenecks(workflow):
                    bottlenecks.append(self._get_bottleneck_details(workflow))
                
                # Generate recommendations
                if self._needs_optimization(workflow):
                    recommendations.append(self._generate_recommendations(workflow))
            
            return {
                "status": "success",
                "total_workflows": len(workflows),
                "bottlenecks": bottlenecks,
                "recommendations": recommendations,
                "performance_metrics": self._calculate_performance_metrics(workflows)
            }
        except Exception as e:
            self.logger.error(f"Workflow analysis failed: {str(e)}")
            return {"status": "error", "error": str(e)}
    
    def _has_bottlenecks(self, workflow: WorkflowMetrics) -> bool:
        """Check if workflow has performance bottlenecks"""
        try:
            # Check for high failure rate
            if workflow.failed_executions / workflow.total_executions > 0.1:
                return True
            
            # Check for long execution times
            if workflow.avg_execution_time > 300:  # 5 minutes
                return True
            
            # Check for high variance in execution times
            if workflow.max_execution_time - workflow.min_execution_time > 600:  # 10 minutes
                return True
            
            return False
        except Exception:
            return False
    
    def _get_bottleneck_details(self, workflow: WorkflowMetrics) -> Dict[str, Any]:
        """Get detailed information about workflow bottlenecks"""
        return {
            "workflow_id": workflow.workflow_id,
            "name": workflow.name,
            "issues": [
                {
                    "type": "high_failure_rate",
                    "details": f"Failure rate: {(workflow.failed_executions / workflow.total_executions) * 100:.2f}%"
                } if workflow.failed_executions / workflow.total_executions > 0.1 else None,
                {
                    "type": "long_execution_time",
                    "details": f"Average execution time: {workflow.avg_execution_time:.2f} seconds"
                } if workflow.avg_execution_time > 300 else None,
                {
                    "type": "high_variance",
                    "details": f"Execution time variance: {workflow.max_execution_time - workflow.min_execution_time:.2f} seconds"
                } if workflow.max_execution_time - workflow.min_execution_time > 600 else None
            ],
            "impact": self._calculate_bottleneck_impact(workflow)
        }
    
    def _calculate_bottleneck_impact(self, workflow: WorkflowMetrics) -> Dict[str, Any]:
        """Calculate the impact of workflow bottlenecks"""
        try:
            # Calculate cost impact
            cost_per_execution = 0.1  # Example cost per second
            total_cost = workflow.avg_execution_time * workflow.total_executions * cost_per_execution
            
            # Calculate time impact
            time_impact = workflow.avg_execution_time * workflow.total_executions
            
            # Calculate resource impact
            resource_impact = {
                "cpu_usage": workflow.avg_execution_time * 0.5,  # Example CPU usage
                "memory_usage": workflow.avg_execution_time * 100  # Example memory usage (MB)
            }
            
            return {
                "cost_impact": total_cost,
                "time_impact": time_impact,
                "resource_impact": resource_impact
            }
        except Exception:
            return {
                "cost_impact": 0,
                "time_impact": 0,
                "resource_impact": {}
            }
    
    def _needs_optimization(self, workflow: WorkflowMetrics) -> bool:
        """Check if workflow needs optimization"""
        try:
            # Check for performance degradation
            if self._has_performance_degradation(workflow):
                return True
            
            # Check for resource inefficiency
            if self._is_resource_inefficient(workflow):
                return True
            
            # Check for scalability issues
            if self._has_scalability_issues(workflow):
                return True
            
            return False
        except Exception:
            return False
    
    def _has_performance_degradation(self, workflow: WorkflowMetrics) -> bool:
        """Check for performance degradation over time"""
        try:
            # Get recent execution times
            query = text("""
                SELECT execution_time
                FROM workflow_executions
                WHERE workflow_id = :workflow_id
                AND started_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
                ORDER BY started_at
            """)
            
            result = self.db.execute(query, {"workflow_id": workflow.workflow_id}).fetchall()
            
            if len(result) < 2:
                return False
            
            # Calculate trend
            execution_times = [row[0] for row in result]
            trend = np.polyfit(range(len(execution_times)), execution_times, 1)[0]
            
            return trend > 0.1  # Positive trend indicates degradation
        except Exception:
            return False
    
    def _is_resource_inefficient(self, workflow: WorkflowMetrics) -> bool:
        """Check for resource inefficiency"""
        try:
            # Get resource usage data
            query = text("""
                SELECT resource_usage
                FROM workflow_executions
                WHERE workflow_id = :workflow_id
                AND started_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
            """)
            
            result = self.db.execute(query, {"workflow_id": workflow.workflow_id}).fetchall()
            
            if not result:
                return False
            
            # Calculate average resource usage
            avg_cpu = np.mean([
                row[0].get("cpu_usage", 0)
                for row in result
            ])
            
            avg_memory = np.mean([
                row[0].get("memory_usage", 0)
                for row in result
            ])
            
            # Check for high resource usage
            return avg_cpu > 80 or avg_memory > 80  # 80% threshold
        except Exception:
            return False
    
    def _has_scalability_issues(self, workflow: WorkflowMetrics) -> bool:
        """Check for scalability issues with optimized query"""
        try:
            query = text("""
                WITH execution_overlaps AS (
                    SELECT 
                        COUNT(*) FILTER (
                            WHERE t1.started_at <= t2.completed_at 
                            AND t2.started_at <= t1.completed_at
                        ) as overlap_count,
                        COUNT(*) as total_executions
                    FROM workflow_executions t1
                    CROSS JOIN workflow_executions t2
                    WHERE t1.workflow_id = :workflow_id
                    AND t2.workflow_id = :workflow_id
                    AND t1.started_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
                    AND t2.started_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
                    AND t1.id < t2.id
                )
                SELECT 
                    CASE 
                        WHEN total_executions > 0 
                        THEN overlap_count::float / total_executions 
                        ELSE 0 
                    END as overlap_rate
                FROM execution_overlaps
            """)
            
            result = self.db.execute(query, {"workflow_id": workflow.workflow_id}).scalar()
            return result > 0.3  # 30% overlap threshold
        except Exception as e:
            self.logger.error(f"Failed to check scalability issues: {str(e)}")
            return False
    
    def _generate_recommendations(self, workflow: WorkflowMetrics) -> Dict[str, Any]:
        """Generate optimization recommendations"""
        try:
            recommendations = []
            
            # Performance optimization recommendations
            if self._has_performance_degradation(workflow):
                recommendations.append({
                    "type": "performance",
                    "priority": "high",
                    "action": "Optimize workflow logic and reduce processing time",
                    "benefits": [
                        "Reduced execution time",
                        "Lower resource consumption",
                        "Improved throughput"
                    ]
                })
            
            # Resource optimization recommendations
            if self._is_resource_inefficient(workflow):
                recommendations.append({
                    "type": "resource",
                    "priority": "medium",
                    "action": "Implement resource pooling and caching",
                    "benefits": [
                        "Better resource utilization",
                        "Reduced costs",
                        "Improved scalability"
                    ]
                })
            
            # Scalability recommendations
            if self._has_scalability_issues(workflow):
                recommendations.append({
                    "type": "scalability",
                    "priority": "high",
                    "action": "Implement parallel processing and load balancing",
                    "benefits": [
                        "Increased throughput",
                        "Better resource utilization",
                        "Improved response time"
                    ]
                })
            
            return {
                "workflow_id": workflow.workflow_id,
                "name": workflow.name,
                "recommendations": recommendations,
                "implementation_priority": self._calculate_priority(recommendations)
            }
        except Exception:
            return {
                "workflow_id": workflow.workflow_id,
                "name": workflow.name,
                "recommendations": [],
                "implementation_priority": "low"
            }
    
    def _calculate_priority(self, recommendations: List[Dict[str, Any]]) -> str:
        """Calculate implementation priority based on recommendations"""
        try:
            if not recommendations:
                return "low"
            
            # Count high priority recommendations
            high_priority = sum(
                1 for rec in recommendations
                if rec["priority"] == "high"
            )
            
            if high_priority > 0:
                return "high"
            elif any(rec["priority"] == "medium" for rec in recommendations):
                return "medium"
            else:
                return "low"
        except Exception:
            return "low"
    
    def _calculate_performance_metrics(self, workflows: List[WorkflowMetrics]) -> Dict[str, Any]:
        """Calculate overall performance metrics"""
        try:
            total_executions = sum(w.total_executions for w in workflows)
            total_failures = sum(w.failed_executions for w in workflows)
            avg_execution_time = np.mean([w.avg_execution_time for w in workflows])
            
            return {
                "total_workflows": len(workflows),
                "total_executions": total_executions,
                "success_rate": (total_executions - total_failures) / total_executions * 100,
                "average_execution_time": avg_execution_time,
                "total_failures": total_failures,
                "failure_rate": total_failures / total_executions * 100
            }
        except Exception:
            return {
                "total_workflows": 0,
                "total_executions": 0,
                "success_rate": 0,
                "average_execution_time": 0,
                "total_failures": 0,
                "failure_rate": 0
            }
    
    async def optimize_workflow(self, workflow_id: int) -> Dict[str, Any]:
        """Optimize a specific workflow"""
        try:
            # Get workflow details
            query = text("""
                SELECT * FROM mv_workflow_metrics
                WHERE workflow_id = :workflow_id
            """)
            
            result = self.db.execute(query, {"workflow_id": workflow_id}).first()
            
            if not result:
                return {"status": "error", "message": "Workflow not found"}
            
            workflow = WorkflowMetrics(**dict(result))
            
            # Generate optimization plan
            optimization_plan = self._generate_optimization_plan(workflow)
            
            # Apply optimizations
            success = await self._apply_optimizations(workflow_id, optimization_plan)
            
            return {
                "status": "success" if success else "error",
                "workflow_id": workflow_id,
                "optimization_plan": optimization_plan,
                "success": success
            }
        except Exception as e:
            self.logger.error(f"Workflow optimization failed: {str(e)}")
            return {"status": "error", "error": str(e)}
    
    def _generate_optimization_plan(self, workflow: WorkflowMetrics) -> Dict[str, Any]:
        """Generate detailed optimization plan"""
        try:
            # Get recent execution data
            query = text("""
                SELECT 
                    execution_time,
                    resource_usage,
                    optimization_suggestions
                FROM workflow_executions
                WHERE workflow_id = :workflow_id
                AND started_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
            """)
            
            result = self.db.execute(query, {"workflow_id": workflow.workflow_id}).fetchall()
            
            # Analyze execution patterns
            execution_times = [row[0] for row in result]
            resource_usage = [row[1] for row in result]
            suggestions = [row[2] for row in result if row[2]]
            
            # Generate optimization steps
            steps = []
            
            # Performance optimization steps
            if np.mean(execution_times) > 300:  # 5 minutes
                steps.append({
                    "type": "performance",
                    "action": "Implement caching for frequently accessed data",
                    "expected_improvement": "30% reduction in execution time"
                })
            
            # Resource optimization steps
            avg_cpu = np.mean([r.get("cpu_usage", 0) for r in resource_usage])
            if avg_cpu > 80:
                steps.append({
                    "type": "resource",
                    "action": "Implement resource pooling",
                    "expected_improvement": "40% reduction in CPU usage"
                })
            
            # Add any existing suggestions
            if suggestions:
                steps.extend(suggestions)
            
            return {
                "workflow_id": workflow.workflow_id,
                "name": workflow.name,
                "current_metrics": {
                    "avg_execution_time": np.mean(execution_times),
                    "avg_cpu_usage": avg_cpu,
                    "success_rate": (workflow.total_executions - workflow.failed_executions) / workflow.total_executions * 100
                },
                "optimization_steps": steps,
                "estimated_improvements": self._estimate_improvements(steps)
            }
        except Exception as e:
            self.logger.error(f"Failed to generate optimization plan: {str(e)}")
            return {
                "workflow_id": workflow.workflow_id,
                "name": workflow.name,
                "current_metrics": {},
                "optimization_steps": [],
                "estimated_improvements": {}
            }
    
    def _estimate_improvements(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Estimate improvements from optimization steps"""
        try:
            improvements = {
                "execution_time": 0,
                "resource_usage": 0,
                "cost_savings": 0
            }
            
            for step in steps:
                if step["type"] == "performance":
                    improvements["execution_time"] += 30
                elif step["type"] == "resource":
                    improvements["resource_usage"] += 40
                    improvements["cost_savings"] += 25
            
            return improvements
        except Exception:
            return {
                "execution_time": 0,
                "resource_usage": 0,
                "cost_savings": 0
            }
    
    async def _apply_optimizations(self, workflow_id: int, plan: Dict[str, Any]) -> bool:
        """Apply optimization plan to workflow with transaction handling"""
        try:
            async with self.db.begin() as transaction:
                # Update workflow configuration
                query = text("""
                    UPDATE workflows
                    SET 
                        optimization_config = :config,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = :workflow_id
                    AND tenant_id = :tenant_id
                """)
                
                result = await transaction.execute(query, {
                    "workflow_id": workflow_id,
                    "config": json.dumps(plan),
                    "tenant_id": self.db.bind.url.database
                })
                
                if result.rowcount == 0:
                    raise ValueError(f"Workflow {workflow_id} not found or not accessible")
                
                # Log optimization attempt
                query = text("""
                    INSERT INTO workflow_optimizations (
                        workflow_id,
                        optimization_plan,
                        status,
                        applied_at,
                        tenant_id
                    ) VALUES (
                        :workflow_id,
                        :plan,
                        'applied',
                        CURRENT_TIMESTAMP,
                        :tenant_id
                    )
                """)
                
                await transaction.execute(query, {
                    "workflow_id": workflow_id,
                    "plan": json.dumps(plan),
                    "tenant_id": self.db.bind.url.database
                })
                
                return True
        except Exception as e:
            self.logger.error(f"Failed to apply optimizations: {str(e)}")
            raise ValueError(f"Failed to apply optimizations: {str(e)}") 