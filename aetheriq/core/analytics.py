"""
AetherIQ Analytics Engine
Processes and analyzes enterprise data for insights and optimization
"""

from typing import Dict, List, Optional, Any
import logging
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from dataclasses import dataclass
import asyncio
from sqlalchemy.orm import Session

from aetheriq.db.session import get_db
from aetheriq.crud.base import CRUDBase
from aetheriq.db.models import Analytics as AnalyticsModel
from aetheriq.schemas.base import Analytics, AnalyticsCreate

@dataclass
class AnalyticsConfig:
    """Configuration for analytics processing"""
    data_retention_days: int = 90
    analysis_frequency: str = 'daily'
    metrics: List[str] = None
    thresholds: Dict[str, float] = None

class AnalyticsEngine:
    """Analytics engine for data processing and insights"""

    def __init__(self, config: Dict[str, Any]):
        """Initialize analytics engine"""
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.batch_size = config.get("batch_size", 1000)
        self.processing_interval = config.get("processing_interval_seconds", 60)
        self.data_retention_days = config.get("data_retention_days", 90)
        self.max_processing_time = config.get("max_processing_time_seconds", 300)
        self.crud = CRUDBase[AnalyticsModel, Analytics, Analytics](AnalyticsModel)
        self.processing_queue: asyncio.Queue = asyncio.Queue()
        self.is_processing = False
        self.background_tasks = []

    async def initialize(self) -> None:
        """Initialize analytics engine"""
        self.logger.info("Initializing Analytics Engine")
        self.is_processing = True
        self.background_tasks.append(
            asyncio.create_task(self._process_queue())
        )
        self.background_tasks.append(
            asyncio.create_task(self._cleanup_old_data())
        )

    async def shutdown(self) -> None:
        """Shutdown analytics engine"""
        self.logger.info("Shutting down Analytics Engine")
        self.is_processing = False
        for task in self.background_tasks:
            task.cancel()
        await asyncio.gather(*self.background_tasks, return_exceptions=True)

    async def process_data(
        self,
        data: Dict[str, Any],
        data_type: str
    ) -> Dict[str, Any]:
        """Process analytics data"""
        try:
            # Validate and preprocess data
            processed_data = self._preprocess_data(data, data_type)
            
            # Add to processing queue
            await self.processing_queue.put({
                "data": processed_data,
                "type": data_type,
                "timestamp": datetime.utcnow()
            })

            return {
                "status": "success",
                "message": "Data queued for processing",
                "data": {
                    "queue_size": self.processing_queue.qsize(),
                    "type": data_type
                }
            }
        except Exception as e:
            self.logger.error(f"Error processing data: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }

    async def get_analytics_report(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate analytics report"""
        try:
            # Convert string dates to datetime
            start = datetime.fromisoformat(start_date) if start_date else datetime.utcnow() - timedelta(days=7)
            end = datetime.fromisoformat(end_date) if end_date else datetime.utcnow()

            # Get data from database
            db = next(get_db())
            data = self.crud.get_multi(
                db,
                skip=0,
                limit=self.batch_size,
                timestamp_gte=start,
                timestamp_lte=end
            )

            # Process data into DataFrame
            df = pd.DataFrame([
                {
                    "metric_name": item.metric_name,
                    "metric_value": item.metric_value,
                    "timestamp": item.timestamp,
                    **item.metadata
                }
                for item in data
            ])

            # Generate insights
            insights = self._generate_insights(df)

            return {
                "status": "success",
                "data": {
                    "period": {
                        "start": start.isoformat(),
                        "end": end.isoformat()
                    },
                    "metrics": self._calculate_metrics(df),
                    "insights": insights,
                    "trends": self._analyze_trends(df)
                }
            }
        except Exception as e:
            self.logger.error(f"Error generating analytics report: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }

    def _preprocess_data(
        self,
        data: Dict[str, Any],
        data_type: str
    ) -> Dict[str, Any]:
        """Preprocess analytics data"""
        # Validate data structure
        if not isinstance(data, dict):
            raise ValueError("Data must be a dictionary")

        # Add metadata
        processed = {
            "raw_data": data,
            "processed_at": datetime.utcnow().isoformat(),
            "data_type": data_type
        }

        # Add type-specific processing
        if data_type == "workflow_execution":
            processed.update(self._process_workflow_data(data))
        elif data_type == "system_metrics":
            processed.update(self._process_system_metrics(data))
        elif data_type == "user_activity":
            processed.update(self._process_user_activity(data))

        return processed

    def _process_workflow_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process workflow execution data"""
        return {
            "execution_time": data.get("execution_time", 0),
            "status": data.get("status", "unknown"),
            "resource_usage": data.get("resource_usage", {}),
            "error_count": len(data.get("errors", []))
        }

    def _process_system_metrics(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process system metrics data"""
        return {
            "cpu_usage": data.get("cpu_usage", 0),
            "memory_usage": data.get("memory_usage", 0),
            "disk_usage": data.get("disk_usage", 0),
            "network_traffic": data.get("network_traffic", 0)
        }

    def _process_user_activity(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process user activity data"""
        return {
            "user_id": data.get("user_id", "unknown"),
            "action": data.get("action", "unknown"),
            "resource_type": data.get("resource_type", "unknown"),
            "duration": data.get("duration", 0)
        }

    def _calculate_metrics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Calculate analytics metrics"""
        metrics = {}
        
        # Calculate basic statistics for numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            metrics[col] = {
                "mean": df[col].mean(),
                "median": df[col].median(),
                "std": df[col].std(),
                "min": df[col].min(),
                "max": df[col].max()
            }

        # Calculate frequencies for categorical columns
        categorical_cols = df.select_dtypes(include=['object']).columns
        for col in categorical_cols:
            metrics[f"{col}_distribution"] = df[col].value_counts().to_dict()

        return metrics

    def _generate_insights(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Generate insights from data"""
        insights = []

        # Analyze trends
        for col in df.select_dtypes(include=[np.number]).columns:
            trend = np.polyfit(range(len(df)), df[col].fillna(0), 1)[0]
            if abs(trend) > 0.1:  # Significant trend threshold
                insights.append({
                    "type": "trend",
                    "metric": col,
                    "trend": "increasing" if trend > 0 else "decreasing",
                    "magnitude": abs(trend)
                })

        # Detect anomalies
        for col in df.select_dtypes(include=[np.number]).columns:
            mean = df[col].mean()
            std = df[col].std()
            anomalies = df[col][abs(df[col] - mean) > 2 * std]
            if len(anomalies) > 0:
                insights.append({
                    "type": "anomaly",
                    "metric": col,
                    "count": len(anomalies),
                    "threshold": mean + 2 * std
                })

        return insights

    def _analyze_trends(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze trends in data"""
        trends = {}

        # Time-based trends
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df.set_index('timestamp', inplace=True)
            
            # Daily trends
            daily = df.resample('D').mean()
            trends['daily'] = daily.to_dict()

            # Weekly trends
            weekly = df.resample('W').mean()
            trends['weekly'] = weekly.to_dict()

            # Monthly trends
            monthly = df.resample('M').mean()
            trends['monthly'] = monthly.to_dict()

        return trends

    async def _process_queue(self) -> None:
        """Process analytics queue"""
        while self.is_processing:
            try:
                # Process items in batches
                batch = []
                try:
                    while len(batch) < self.batch_size:
                        item = await asyncio.wait_for(
                            self.processing_queue.get(),
                            timeout=self.processing_interval
                        )
                        batch.append(item)
                except asyncio.TimeoutError:
                    pass

                if batch:
                    # Process batch
                    db = next(get_db())
                    analytics_items = [
                        AnalyticsCreate(
                            metric_name=item["type"],
                            metric_value=item["data"],
                            timestamp=item["timestamp"]
                        )
                        for item in batch
                    ]
                    self.crud.bulk_create(db, objs_in=analytics_items)

            except Exception as e:
                self.logger.error(f"Error processing analytics queue: {str(e)}")
                await asyncio.sleep(1)

    async def _cleanup_old_data(self) -> None:
        """Clean up old analytics data"""
        while self.is_processing:
            try:
                # Delete data older than retention period
                cutoff_date = datetime.utcnow() - timedelta(days=self.data_retention_days)
                db = next(get_db())
                old_records = self.crud.get_multi(
                    db,
                    timestamp_lt=cutoff_date
                )
                if old_records:
                    self.crud.bulk_delete(
                        db,
                        ids=[record.id for record in old_records]
                    )
                    self.logger.info(f"Cleaned up {len(old_records)} old analytics records")

            except Exception as e:
                self.logger.error(f"Error cleaning up old analytics data: {str(e)}")

            # Wait before next cleanup
            await asyncio.sleep(24 * 3600)  # Run daily 