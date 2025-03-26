from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
import asyncio
from pydantic import BaseModel
import redis
from app.core.config import settings

class JobState(BaseModel):
    job_id: str
    workflow_id: int
    status: str
    checkpoint_data: Dict[str, Any]
    last_checkpoint: datetime
    retry_count: int
    max_retries: int
    priority: int
    dependencies: List[str]
    created_at: datetime
    updated_at: datetime

class FailoverManager:
    def __init__(self, db: Session, config: Dict[str, Any]):
        self.db = db
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            decode_responses=True
        )
        self._initialize_failover_state()
    
    def _initialize_failover_state(self):
        """Initialize failover state and recovery mechanisms"""
        try:
            # Initialize Redis keys for failover state
            self.redis_client.set("failover:active_nodes", json.dumps([]))
            self.redis_client.set("failover:job_states", json.dumps({}))
            self.redis_client.set("failover:last_heartbeat", datetime.utcnow().isoformat())
            
            # Start heartbeat monitoring
            asyncio.create_task(self._monitor_heartbeats())
            
            # Start job recovery process
            asyncio.create_task(self._recover_failed_jobs())
        except Exception as e:
            self.logger.error(f"Failed to initialize failover state: {str(e)}")
    
    async def _monitor_heartbeats(self):
        """Monitor node heartbeats for failover detection"""
        while True:
            try:
                # Get active nodes
                active_nodes = json.loads(self.redis_client.get("failover:active_nodes"))
                last_heartbeat = datetime.fromisoformat(
                    self.redis_client.get("failover:last_heartbeat")
                )
                
                # Check for stale heartbeats
                if datetime.utcnow() - last_heartbeat > timedelta(seconds=30):
                    self.logger.warning("Primary node heartbeat stale, initiating failover")
                    await self._initiate_failover()
                
                await asyncio.sleep(10)  # Check every 10 seconds
            except Exception as e:
                self.logger.error(f"Heartbeat monitoring failed: {str(e)}")
                await asyncio.sleep(5)
    
    async def _recover_failed_jobs(self):
        """Recover failed jobs and redistribute them"""
        while True:
            try:
                # Get failed jobs
                failed_jobs = self._get_failed_jobs()
                
                for job in failed_jobs:
                    if job.retry_count < job.max_retries:
                        await self._recover_job(job)
                    else:
                        self._handle_permanent_failure(job)
                
                await asyncio.sleep(30)  # Check every 30 seconds
            except Exception as e:
                self.logger.error(f"Job recovery failed: {str(e)}")
                await asyncio.sleep(5)
    
    def _get_failed_jobs(self) -> List[JobState]:
        """Get list of failed jobs that need recovery"""
        try:
            query = text("""
                SELECT 
                    job_id,
                    workflow_id,
                    status,
                    checkpoint_data,
                    last_checkpoint,
                    retry_count,
                    max_retries,
                    priority,
                    dependencies,
                    created_at,
                    updated_at
                FROM job_states
                WHERE status = 'failed'
                AND retry_count < max_retries
                ORDER BY priority DESC, created_at ASC
            """)
            
            result = self.db.execute(query).fetchall()
            
            return [
                JobState(
                    job_id=row.job_id,
                    workflow_id=row.workflow_id,
                    status=row.status,
                    checkpoint_data=row.checkpoint_data,
                    last_checkpoint=row.last_checkpoint,
                    retry_count=row.retry_count,
                    max_retries=row.max_retries,
                    priority=row.priority,
                    dependencies=row.dependencies,
                    created_at=row.created_at,
                    updated_at=row.updated_at
                )
                for row in result
            ]
        except Exception as e:
            self.logger.error(f"Failed to get failed jobs: {str(e)}")
            return []
    
    async def _recover_job(self, job: JobState):
        """Recover a failed job"""
        try:
            # Update job state
            self._update_job_state(job.job_id, "recovering")
            
            # Get checkpoint data
            checkpoint_data = job.checkpoint_data
            
            # Validate checkpoint data
            if not self._validate_checkpoint(checkpoint_data):
                self.logger.error(f"Invalid checkpoint data for job {job.job_id}")
                self._handle_permanent_failure(job)
                return
            
            # Redistribute job to available node
            success = await self._redistribute_job(job, checkpoint_data)
            
            if success:
                self._update_job_state(job.job_id, "running")
                self._increment_retry_count(job.job_id)
            else:
                self._update_job_state(job.job_id, "failed")
        except Exception as e:
            self.logger.error(f"Job recovery failed for {job.job_id}: {str(e)}")
            self._update_job_state(job.job_id, "failed")
    
    def _validate_checkpoint(self, checkpoint_data: Dict[str, Any]) -> bool:
        """Validate checkpoint data integrity"""
        try:
            required_fields = ["state", "timestamp", "version"]
            return all(field in checkpoint_data for field in required_fields)
        except Exception as e:
            self.logger.error(f"Checkpoint validation failed: {str(e)}")
            return False
    
    async def _redistribute_job(
        self,
        job: JobState,
        checkpoint_data: Dict[str, Any]
    ) -> bool:
        """Redistribute job to available node"""
        try:
            # Get available nodes
            available_nodes = self._get_available_nodes()
            
            if not available_nodes:
                self.logger.error("No available nodes for job redistribution")
                return False
            
            # Select best node based on load and capabilities
            target_node = self._select_target_node(available_nodes, job)
            
            # Send job to target node
            success = await self._send_job_to_node(
                target_node,
                job,
                checkpoint_data
            )
            
            return success
        except Exception as e:
            self.logger.error(f"Job redistribution failed: {str(e)}")
            return False
    
    def _get_available_nodes(self) -> List[Dict[str, Any]]:
        """Get list of available nodes"""
        try:
            nodes = json.loads(self.redis_client.get("failover:active_nodes"))
            return [
                node for node in nodes
                if node["status"] == "active" and node["load"] < 0.8
            ]
        except Exception as e:
            self.logger.error(f"Failed to get available nodes: {str(e)}")
            return []
    
    def _select_target_node(
        self,
        available_nodes: List[Dict[str, Any]],
        job: JobState
    ) -> Dict[str, Any]:
        """Select best node for job execution"""
        try:
            # Sort nodes by load and capabilities
            sorted_nodes = sorted(
                available_nodes,
                key=lambda x: (x["load"], -x["capabilities"].get(job.workflow_id, 0))
            )
            
            return sorted_nodes[0]
        except Exception as e:
            self.logger.error(f"Node selection failed: {str(e)}")
            return available_nodes[0]
    
    async def _send_job_to_node(
        self,
        node: Dict[str, Any],
        job: JobState,
        checkpoint_data: Dict[str, Any]
    ) -> bool:
        """Send job to target node"""
        try:
            # Prepare job data
            job_data = {
                "job_id": job.job_id,
                "workflow_id": job.workflow_id,
                "checkpoint_data": checkpoint_data,
                "priority": job.priority,
                "dependencies": job.dependencies
            }
            
            # Send job to node
            response = await self._make_node_request(
                node["url"],
                "POST",
                "/api/jobs/execute",
                job_data
            )
            
            return response.get("status") == "success"
        except Exception as e:
            self.logger.error(f"Failed to send job to node: {str(e)}")
            return False
    
    async def _make_node_request(
        self,
        url: str,
        method: str,
        endpoint: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Make HTTP request to node"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.request(
                    method,
                    f"{url}{endpoint}",
                    json=data,
                    timeout=30
                ) as response:
                    return await response.json()
        except Exception as e:
            self.logger.error(f"Node request failed: {str(e)}")
            return {"status": "error", "error": str(e)}
    
    def _handle_permanent_failure(self, job: JobState):
        """Handle permanently failed jobs"""
        try:
            # Update job state
            self._update_job_state(job.job_id, "permanently_failed")
            
            # Log failure
            self._log_job_failure(job)
            
            # Notify stakeholders
            self._notify_stakeholders(job)
        except Exception as e:
            self.logger.error(f"Failed to handle permanent failure: {str(e)}")
    
    def _update_job_state(self, job_id: str, status: str):
        """Update job state in database"""
        try:
            query = text("""
                UPDATE job_states
                SET status = :status,
                    updated_at = CURRENT_TIMESTAMP
                WHERE job_id = :job_id
            """)
            
            self.db.execute(query, {
                "job_id": job_id,
                "status": status
            })
            
            self.db.commit()
        except Exception as e:
            self.logger.error(f"Failed to update job state: {str(e)}")
            self.db.rollback()
    
    def _increment_retry_count(self, job_id: str):
        """Increment job retry count"""
        try:
            query = text("""
                UPDATE job_states
                SET retry_count = retry_count + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE job_id = :job_id
            """)
            
            self.db.execute(query, {"job_id": job_id})
            self.db.commit()
        except Exception as e:
            self.logger.error(f"Failed to increment retry count: {str(e)}")
            self.db.rollback()
    
    def _log_job_failure(self, job: JobState):
        """Log job failure details"""
        try:
            query = text("""
                INSERT INTO job_failures (
                    job_id,
                    workflow_id,
                    failure_reason,
                    checkpoint_data,
                    retry_count,
                    timestamp
                ) VALUES (
                    :job_id,
                    :workflow_id,
                    :failure_reason,
                    :checkpoint_data,
                    :retry_count,
                    CURRENT_TIMESTAMP
                )
            """)
            
            self.db.execute(query, {
                "job_id": job.job_id,
                "workflow_id": job.workflow_id,
                "failure_reason": "Max retries exceeded",
                "checkpoint_data": json.dumps(job.checkpoint_data),
                "retry_count": job.retry_count
            })
            
            self.db.commit()
        except Exception as e:
            self.logger.error(f"Failed to log job failure: {str(e)}")
            self.db.rollback()
    
    def _notify_stakeholders(self, job: JobState):
        """Notify stakeholders about job failure"""
        try:
            # Get workflow details
            workflow = self._get_workflow_details(job.workflow_id)
            
            # Prepare notification
            notification = {
                "type": "job_failure",
                "job_id": job.job_id,
                "workflow_id": job.workflow_id,
                "workflow_name": workflow.get("name"),
                "failure_reason": "Max retries exceeded",
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Send notification
            self._send_notification(notification)
        except Exception as e:
            self.logger.error(f"Failed to notify stakeholders: {str(e)}")
    
    def _get_workflow_details(self, workflow_id: int) -> Dict[str, Any]:
        """Get workflow details"""
        try:
            query = text("""
                SELECT name, description, owner_id
                FROM workflows
                WHERE id = :workflow_id
            """)
            
            result = self.db.execute(query, {"workflow_id": workflow_id}).first()
            
            return {
                "name": result.name,
                "description": result.description,
                "owner_id": result.owner_id
            } if result else {}
        except Exception as e:
            self.logger.error(f"Failed to get workflow details: {str(e)}")
            return {}
    
    def _send_notification(self, notification: Dict[str, Any]):
        """Send notification to stakeholders"""
        try:
            # Send to notification queue
            self.redis_client.lpush(
                "notifications:queue",
                json.dumps(notification)
            )
        except Exception as e:
            self.logger.error(f"Failed to send notification: {str(e)}")
    
    async def _initiate_failover(self):
        """Initiate failover process"""
        try:
            # Get current node status
            current_node = self._get_current_node_status()
            
            # Check if this node should become primary
            if self._should_become_primary(current_node):
                # Update node status
                self._update_node_status("primary")
                
                # Take over failed jobs
                await self._take_over_failed_jobs()
                
                # Notify other nodes
                await self._notify_nodes_of_failover()
            else:
                # Update node status
                self._update_node_status("standby")
        except Exception as e:
            self.logger.error(f"Failover initiation failed: {str(e)}")
    
    def _get_current_node_status(self) -> Dict[str, Any]:
        """Get current node status"""
        try:
            return {
                "node_id": settings.NODE_ID,
                "role": self.redis_client.get("failover:node_role"),
                "load": self._get_node_load(),
                "capabilities": self._get_node_capabilities()
            }
        except Exception as e:
            self.logger.error(f"Failed to get node status: {str(e)}")
            return {}
    
    def _should_become_primary(self, current_node: Dict[str, Any]) -> bool:
        """Determine if current node should become primary"""
        try:
            # Get all nodes
            nodes = json.loads(self.redis_client.get("failover:active_nodes"))
            
            # Sort nodes by priority and load
            sorted_nodes = sorted(
                nodes,
                key=lambda x: (x["priority"], -x["load"])
            )
            
            # Current node should be primary if it's highest priority
            return sorted_nodes[0]["node_id"] == current_node["node_id"]
        except Exception as e:
            self.logger.error(f"Failed to determine primary status: {str(e)}")
            return False
    
    def _update_node_status(self, role: str):
        """Update node role in Redis"""
        try:
            self.redis_client.set("failover:node_role", role)
            
            # Update active nodes list
            nodes = json.loads(self.redis_client.get("failover:active_nodes"))
            current_node = {
                "node_id": settings.NODE_ID,
                "role": role,
                "load": self._get_node_load(),
                "capabilities": self._get_node_capabilities()
            }
            
            # Update or add current node
            node_index = next(
                (i for i, n in enumerate(nodes) if n["node_id"] == settings.NODE_ID),
                -1
            )
            
            if node_index >= 0:
                nodes[node_index] = current_node
            else:
                nodes.append(current_node)
            
            self.redis_client.set("failover:active_nodes", json.dumps(nodes))
        except Exception as e:
            self.logger.error(f"Failed to update node status: {str(e)}")
    
    def _get_node_load(self) -> float:
        """Get current node load"""
        try:
            # Get running jobs count
            query = text("""
                SELECT COUNT(*)
                FROM job_states
                WHERE status = 'running'
                AND node_id = :node_id
            """)
            
            result = self.db.execute(query, {
                "node_id": settings.NODE_ID
            }).scalar()
            
            # Calculate load (jobs / max capacity)
            return min(result / settings.MAX_JOBS_PER_NODE, 1.0)
        except Exception as e:
            self.logger.error(f"Failed to get node load: {str(e)}")
            return 0.0
    
    def _get_node_capabilities(self) -> Dict[str, int]:
        """Get node capabilities"""
        try:
            # Get supported workflow types
            query = text("""
                SELECT workflow_type, COUNT(*)
                FROM workflow_capabilities
                WHERE node_id = :node_id
                GROUP BY workflow_type
            """)
            
            result = self.db.execute(query, {
                "node_id": settings.NODE_ID
            }).fetchall()
            
            return {
                row.workflow_type: row.count
                for row in result
            }
        except Exception as e:
            self.logger.error(f"Failed to get node capabilities: {str(e)}")
            return {}
    
    async def _take_over_failed_jobs(self):
        """Take over jobs from failed primary node"""
        try:
            # Get failed jobs
            failed_jobs = self._get_failed_jobs()
            
            # Redistribute failed jobs
            for job in failed_jobs:
                await self._recover_job(job)
        except Exception as e:
            self.logger.error(f"Failed to take over failed jobs: {str(e)}")
    
    async def _notify_nodes_of_failover(self):
        """Notify other nodes about failover"""
        try:
            # Get all nodes
            nodes = json.loads(self.redis_client.get("failover:active_nodes"))
            
            # Notify each node
            for node in nodes:
                if node["node_id"] != settings.NODE_ID:
                    await self._make_node_request(
                        node["url"],
                        "POST",
                        "/api/failover/notify",
                        {
                            "type": "failover",
                            "new_primary": settings.NODE_ID,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    )
        except Exception as e:
            self.logger.error(f"Failed to notify nodes: {str(e)}")
    
    def get_failover_status(self) -> Dict[str, Any]:
        """Get current failover status"""
        try:
            return {
                "node_id": settings.NODE_ID,
                "role": self.redis_client.get("failover:node_role"),
                "active_nodes": json.loads(self.redis_client.get("failover:active_nodes")),
                "last_heartbeat": self.redis_client.get("failover:last_heartbeat"),
                "failed_jobs": len(self._get_failed_jobs()),
                "node_load": self._get_node_load(),
                "node_capabilities": self._get_node_capabilities()
            }
        except Exception as e:
            self.logger.error(f"Failed to get failover status: {str(e)}")
            return {
                "status": "error",
                "error": str(e)
            } 