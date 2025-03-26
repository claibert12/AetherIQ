"""
Workflow engine for managing and executing automation tasks
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
import asyncio
import json
import logging
from enum import Enum
from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy.orm import Session
from fastapi import HTTPException

from aetheriq.db.session import get_db
from aetheriq.crud.base import CRUDBase
from aetheriq.db.models import Workflow as WorkflowModel
from aetheriq.schemas.base import Workflow, WorkflowCreate, WorkflowUpdate

class WorkflowStatus(str, Enum):
    """Workflow status enum"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"

class TaskStatus(str, Enum):
    """Task status enum"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

@dataclass
class WorkflowTask:
    """Workflow task definition"""
    id: str
    name: str
    type: str
    config: Dict[str, Any]
    dependencies: List[str]
    timeout: int
    retries: int
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    retry_count: int = 0

class WorkflowEngine:
    """Workflow engine for managing and executing automation tasks"""

    def __init__(self, config: Dict[str, Any]):
        """Initialize workflow engine"""
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.max_concurrent_workflows = config.get("max_concurrent_workflows", 10)
        self.max_task_retries = config.get("max_task_retries", 3)
        self.task_timeout = config.get("task_timeout_seconds", 300)
        self.crud = CRUDBase[WorkflowModel, Workflow, WorkflowUpdate](WorkflowModel)
        self.active_workflows: Dict[str, asyncio.Task] = {}
        self.task_registry: Dict[str, callable] = {}
        self.is_running = False
        self.background_tasks = []

    async def initialize(self) -> None:
        """Initialize workflow engine"""
        self.logger.info("Initializing Workflow Engine")
        self.is_running = True
        self.background_tasks.append(
            asyncio.create_task(self._process_pending_workflows())
        )
        self.background_tasks.append(
            asyncio.create_task(self._monitor_active_workflows())
        )
        await self._register_default_tasks()

    async def shutdown(self) -> None:
        """Shutdown workflow engine"""
        self.logger.info("Shutting down Workflow Engine")
        self.is_running = False
        
        # Cancel all active workflows
        for workflow_id, task in self.active_workflows.items():
            self.logger.info(f"Cancelling workflow {workflow_id}")
            task.cancel()
        
        # Wait for all tasks to complete
        for task in self.background_tasks:
            task.cancel()
        await asyncio.gather(*self.background_tasks, return_exceptions=True)

    async def create_workflow(
        self,
        name: str,
        tasks: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a new workflow"""
        try:
            workflow_id = str(uuid4())
            workflow_tasks = []

            # Validate and create tasks
            for task_data in tasks:
                task = WorkflowTask(
                    id=str(uuid4()),
                    name=task_data["name"],
                    type=task_data["type"],
                    config=task_data.get("config", {}),
                    dependencies=task_data.get("dependencies", []),
                    timeout=task_data.get("timeout", self.task_timeout),
                    retries=task_data.get("retries", self.max_task_retries)
                )
                workflow_tasks.append(task)

            # Create workflow in database
            db = next(get_db())
            workflow = WorkflowCreate(
                id=workflow_id,
                name=name,
                status=WorkflowStatus.PENDING,
                tasks=workflow_tasks,
                metadata=metadata or {},
                created_at=datetime.utcnow()
            )
            db_workflow = self.crud.create(db, obj_in=workflow)

            return {
                "status": "success",
                "workflow_id": workflow_id,
                "message": "Workflow created successfully"
            }

        except Exception as e:
            self.logger.error(f"Error creating workflow: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create workflow: {str(e)}"
            )

    async def execute_workflow(self, workflow_id: Union[str, UUID]) -> Dict[str, Any]:
        """Execute a workflow"""
        try:
            db = next(get_db())
            workflow = self.crud.get(db, id=workflow_id)
            if not workflow:
                raise ValueError(f"Workflow {workflow_id} not found")

            if len(self.active_workflows) >= self.max_concurrent_workflows:
                return {
                    "status": "error",
                    "message": "Maximum concurrent workflows reached"
                }

            # Create execution task
            execution_task = asyncio.create_task(
                self._execute_workflow_tasks(workflow)
            )
            self.active_workflows[str(workflow_id)] = execution_task

            return {
                "status": "success",
                "message": "Workflow execution started",
                "workflow_id": str(workflow_id)
            }

        except Exception as e:
            self.logger.error(f"Error executing workflow: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to execute workflow: {str(e)}"
            )

    async def get_workflow_status(
        self,
        workflow_id: Union[str, UUID]
    ) -> Dict[str, Any]:
        """Get workflow status"""
        try:
            db = next(get_db())
            workflow = self.crud.get(db, id=workflow_id)
            if not workflow:
                raise ValueError(f"Workflow {workflow_id} not found")

            return {
                "status": "success",
                "data": {
                    "workflow_id": str(workflow_id),
                    "name": workflow.name,
                    "status": workflow.status,
                    "tasks": [
                        {
                            "id": task.id,
                            "name": task.name,
                            "status": task.status,
                            "result": task.result,
                            "error": task.error
                        }
                        for task in workflow.tasks
                    ],
                    "created_at": workflow.created_at,
                    "updated_at": workflow.updated_at,
                    "metadata": workflow.metadata
                }
            }

        except Exception as e:
            self.logger.error(f"Error getting workflow status: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get workflow status: {str(e)}"
            )

    async def cancel_workflow(
        self,
        workflow_id: Union[str, UUID]
    ) -> Dict[str, Any]:
        """Cancel a workflow"""
        try:
            db = next(get_db())
            workflow = self.crud.get(db, id=workflow_id)
            if not workflow:
                raise ValueError(f"Workflow {workflow_id} not found")

            if str(workflow_id) in self.active_workflows:
                # Cancel the execution task
                self.active_workflows[str(workflow_id)].cancel()
                del self.active_workflows[str(workflow_id)]

                # Update workflow status
                workflow.status = WorkflowStatus.CANCELLED
                self.crud.update(db, db_obj=workflow, obj_in={"status": WorkflowStatus.CANCELLED})

            return {
                "status": "success",
                "message": "Workflow cancelled successfully"
            }

        except Exception as e:
            self.logger.error(f"Error cancelling workflow: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to cancel workflow: {str(e)}"
            )

    async def _execute_workflow_tasks(self, workflow: WorkflowModel) -> None:
        """Execute workflow tasks"""
        try:
            db = next(get_db())
            workflow.status = WorkflowStatus.RUNNING
            self.crud.update(db, db_obj=workflow, obj_in={"status": WorkflowStatus.RUNNING})

            # Build task dependency graph
            task_graph = self._build_task_graph(workflow.tasks)
            completed_tasks = set()

            while len(completed_tasks) < len(workflow.tasks):
                # Find ready tasks
                ready_tasks = [
                    task for task in workflow.tasks
                    if task.id not in completed_tasks and
                    all(dep in completed_tasks for dep in task.dependencies)
                ]

                if not ready_tasks:
                    break

                # Execute ready tasks in parallel
                tasks = [
                    self._execute_task(task)
                    for task in ready_tasks
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Process results
                for task, result in zip(ready_tasks, results):
                    if isinstance(result, Exception):
                        task.status = TaskStatus.FAILED
                        task.error = str(result)
                    else:
                        task.status = TaskStatus.COMPLETED
                        task.result = result
                    completed_tasks.add(task.id)

            # Update workflow status
            final_status = WorkflowStatus.COMPLETED
            if any(task.status == TaskStatus.FAILED for task in workflow.tasks):
                final_status = WorkflowStatus.FAILED

            workflow.status = final_status
            self.crud.update(db, db_obj=workflow, obj_in={"status": final_status})

        except Exception as e:
            self.logger.error(f"Error executing workflow tasks: {str(e)}")
            workflow.status = WorkflowStatus.FAILED
            self.crud.update(db, db_obj=workflow, obj_in={"status": WorkflowStatus.FAILED})

        finally:
            if str(workflow.id) in self.active_workflows:
                del self.active_workflows[str(workflow.id)]

    async def _execute_task(self, task: WorkflowTask) -> Dict[str, Any]:
        """Execute a single task"""
        task.status = TaskStatus.RUNNING
        task.start_time = datetime.utcnow()

        try:
            # Get task handler
            handler = self.task_registry.get(task.type)
            if not handler:
                raise ValueError(f"No handler registered for task type: {task.type}")

            # Execute task with timeout
            result = await asyncio.wait_for(
                handler(task.config),
                timeout=task.timeout
            )

            task.status = TaskStatus.COMPLETED
            task.result = result
            return result

        except asyncio.TimeoutError:
            task.status = TaskStatus.FAILED
            task.error = "Task execution timed out"
            raise

        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)
            raise

        finally:
            task.end_time = datetime.utcnow()

    def _build_task_graph(
        self,
        tasks: List[WorkflowTask]
    ) -> Dict[str, List[str]]:
        """Build task dependency graph"""
        graph = {}
        for task in tasks:
            graph[task.id] = task.dependencies
        return graph

    async def _process_pending_workflows(self) -> None:
        """Process pending workflows"""
        while self.is_running:
            try:
                db = next(get_db())
                pending_workflows = self.crud.get_multi(
                    db,
                    status=WorkflowStatus.PENDING
                )

                for workflow in pending_workflows:
                    if len(self.active_workflows) < self.max_concurrent_workflows:
                        await self.execute_workflow(workflow.id)

            except Exception as e:
                self.logger.error(f"Error processing pending workflows: {str(e)}")

            await asyncio.sleep(5)  # Check every 5 seconds

    async def _monitor_active_workflows(self) -> None:
        """Monitor active workflows"""
        while self.is_running:
            try:
                # Check for completed or failed workflows
                completed = []
                for workflow_id, task in self.active_workflows.items():
                    if task.done():
                        completed.append(workflow_id)
                        if task.exception():
                            self.logger.error(
                                f"Workflow {workflow_id} failed: {str(task.exception())}"
                            )

                # Clean up completed workflows
                for workflow_id in completed:
                    del self.active_workflows[workflow_id]

            except Exception as e:
                self.logger.error(f"Error monitoring workflows: {str(e)}")

            await asyncio.sleep(1)  # Check every second

    async def _register_default_tasks(self) -> None:
        """Register default task handlers"""
        # Register system tasks
        self.task_registry.update({
            "system_check": self._system_check_task,
            "data_backup": self._data_backup_task,
            "log_cleanup": self._log_cleanup_task
        })

    async def _system_check_task(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """System check task handler"""
        # Implement system check logic
        return {"status": "healthy"}

    async def _data_backup_task(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Data backup task handler"""
        # Implement backup logic
        return {"status": "backup_completed"}

    async def _log_cleanup_task(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Log cleanup task handler"""
        # Implement log cleanup logic
        return {"status": "cleanup_completed"} 