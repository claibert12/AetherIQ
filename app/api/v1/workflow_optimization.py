from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from app.db.session import get_db
from app.services.workflow_optimizer import WorkflowOptimizer
from app.models.workflow import Workflow
from app.core.auth import get_current_user, verify_tenant_access
from app.schemas.workflow import WorkflowResponse
from app.core.rate_limit import rate_limit
from app.core.validators import validate_workflow_id, sanitize_input
from app.core.error_handlers import handle_optimization_error
from app.core.cache import cache_response, invalidate_cache
from app.core.security import encrypt_sensitive_data
from fastapi.responses import JSONResponse
from fastapi import status
import time
from app.core.monitoring import track_api_metrics
from app.core.logging import log_api_request
from app.core.audit import audit_log
from sqlalchemy import text

router = APIRouter()

@router.get("/workflows/performance", response_model=Dict[str, Any])
@rate_limit(max_requests=100, window_seconds=60)
@track_api_metrics
@log_api_request
async def analyze_workflow_performance(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Analyze workflow performance and identify optimization opportunities
    """
    try:
        # Verify tenant access
        if not await verify_tenant_access(current_user, db):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "status": "error",
                    "message": "Access denied",
                    "error_code": "ACCESS_DENIED"
                }
            )
        
        # Check cache first
        cache_key = f"workflow_performance_{current_user['tenant_id']}"
        cached_result = await cache_response.get(cache_key)
        if cached_result:
            return cached_result
        
        start_time = time.time()
        optimizer = WorkflowOptimizer(db)
        analysis = await optimizer.analyze_workflow_performance()
        
        if analysis["status"] == "error":
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": "error",
                    "message": analysis["message"],
                    "error_code": "PERFORMANCE_ANALYSIS_FAILED"
                }
            )
        
        # Add performance metrics
        analysis["execution_time"] = time.time() - start_time
        
        # Cache the result
        await cache_response.set(cache_key, analysis, expire=300)  # Cache for 5 minutes
        
        # Log audit trail
        await audit_log.log_action(
            user_id=current_user["id"],
            action="analyze_workflow_performance",
            resource_type="workflow",
            resource_id=None,
            details={"tenant_id": current_user["tenant_id"]}
        )
        
        return analysis
    except ValueError as e:
        return handle_optimization_error(e, "PERFORMANCE_ANALYSIS_ERROR")
    except Exception as e:
        return handle_optimization_error(e, "UNEXPECTED_ERROR")

@router.post("/workflows/{workflow_id}/optimize", response_model=Dict[str, Any])
@rate_limit(max_requests=50, window_seconds=60)
@track_api_metrics
@log_api_request
async def optimize_workflow(
    workflow_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Optimize a specific workflow
    """
    try:
        # Verify tenant access
        if not await verify_tenant_access(current_user, db):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "status": "error",
                    "message": "Access denied",
                    "error_code": "ACCESS_DENIED"
                }
            )
        
        # Validate and sanitize workflow ID
        if not validate_workflow_id(workflow_id):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": "error",
                    "message": "Invalid workflow ID",
                    "error_code": "INVALID_WORKFLOW_ID"
                }
            )
        
        # Check if workflow exists and belongs to tenant
        workflow = db.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.tenant_id == current_user["tenant_id"]
        ).first()
        
        if not workflow:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": "error",
                    "message": "Workflow not found",
                    "error_code": "WORKFLOW_NOT_FOUND"
                }
            )
        
        # Check if workflow is already being optimized
        if workflow.status == "optimizing":
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={
                    "status": "error",
                    "message": "Workflow is already being optimized",
                    "error_code": "WORKFLOW_OPTIMIZATION_IN_PROGRESS"
                }
            )
        
        # Start optimization in background
        background_tasks.add_task(
            _run_optimization,
            workflow_id=workflow_id,
            tenant_id=current_user["tenant_id"],
            user_id=current_user["id"]
        )
        
        # Log audit trail
        await audit_log.log_action(
            user_id=current_user["id"],
            action="optimize_workflow",
            resource_type="workflow",
            resource_id=workflow_id,
            details={"tenant_id": current_user["tenant_id"]}
        )
        
        return {
            "status": "success",
            "message": "Workflow optimization started",
            "workflow_id": workflow_id
        }
    except ValueError as e:
        return handle_optimization_error(e, "OPTIMIZATION_ERROR")
    except Exception as e:
        return handle_optimization_error(e, "UNEXPECTED_ERROR")

@router.get("/workflows/{workflow_id}/metrics", response_model=Dict[str, Any])
@rate_limit(max_requests=200, window_seconds=60)
@track_api_metrics
@log_api_request
async def get_workflow_metrics(
    workflow_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get detailed metrics for a specific workflow
    """
    try:
        # Verify tenant access
        if not await verify_tenant_access(current_user, db):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "status": "error",
                    "message": "Access denied",
                    "error_code": "ACCESS_DENIED"
                }
            )
        
        # Validate and sanitize workflow ID
        if not validate_workflow_id(workflow_id):
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "status": "error",
                    "message": "Invalid workflow ID",
                    "error_code": "INVALID_WORKFLOW_ID"
                }
            )
        
        # Check cache first
        cache_key = f"workflow_metrics_{workflow_id}_{current_user['tenant_id']}"
        cached_result = await cache_response.get(cache_key)
        if cached_result:
            return cached_result
        
        # Check if workflow exists and belongs to tenant
        workflow = db.query(Workflow).filter(
            Workflow.id == workflow_id,
            Workflow.tenant_id == current_user["tenant_id"]
        ).first()
        
        if not workflow:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": "error",
                    "message": "Workflow not found",
                    "error_code": "WORKFLOW_NOT_FOUND"
                }
            )
        
        start_time = time.time()
        optimizer = WorkflowOptimizer(db)
        metrics = await optimizer.analyze_workflow_performance()
        
        # Filter metrics for specific workflow
        workflow_metrics = next(
            (w for w in metrics["workflows"] if w["workflow_id"] == workflow_id),
            None
        )
        
        if not workflow_metrics:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "status": "error",
                    "message": "Workflow metrics not found",
                    "error_code": "METRICS_NOT_FOUND"
                }
            )
        
        # Add performance metrics
        workflow_metrics["execution_time"] = time.time() - start_time
        
        # Cache the result
        await cache_response.set(cache_key, workflow_metrics, expire=300)  # Cache for 5 minutes
        
        # Log audit trail
        await audit_log.log_action(
            user_id=current_user["id"],
            action="get_workflow_metrics",
            resource_type="workflow",
            resource_id=workflow_id,
            details={"tenant_id": current_user["tenant_id"]}
        )
        
        return workflow_metrics
    except ValueError as e:
        return handle_optimization_error(e, "METRICS_ERROR")
    except Exception as e:
        return handle_optimization_error(e, "UNEXPECTED_ERROR")

@router.get("/workflows/optimization-history", response_model=List[Dict[str, Any]])
@rate_limit(max_requests=100, window_seconds=60)
@track_api_metrics
@log_api_request
async def get_optimization_history(
    workflow_id: Optional[int] = None,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get history of workflow optimizations
    """
    try:
        # Verify tenant access
        if not await verify_tenant_access(current_user, db):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "status": "error",
                    "message": "Access denied",
                    "error_code": "ACCESS_DENIED"
                }
            )
        
        # Check cache first
        cache_key = f"optimization_history_{current_user['tenant_id']}_{workflow_id}"
        cached_result = await cache_response.get(cache_key)
        if cached_result:
            return cached_result
        
        # Build query with parameterized values
        query = text("""
            SELECT 
                wo.id,
                wo.workflow_id,
                w.name as workflow_name,
                wo.optimization_plan,
                wo.status,
                wo.applied_at,
                wo.results
            FROM workflow_optimizations wo
            JOIN workflows w ON wo.workflow_id = w.id
            WHERE wo.tenant_id = :tenant_id
        """)
        
        params = {"tenant_id": current_user["tenant_id"]}
        
        if workflow_id:
            if not validate_workflow_id(workflow_id):
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "status": "error",
                        "message": "Invalid workflow ID",
                        "error_code": "INVALID_WORKFLOW_ID"
                    }
                )
            query += " AND wo.workflow_id = :workflow_id"
            params["workflow_id"] = workflow_id
        
        query += " ORDER BY wo.applied_at DESC LIMIT 1000"
        
        start_time = time.time()
        result = db.execute(query, params).fetchall()
        
        history = [
            {
                "id": row.id,
                "workflow_id": row.workflow_id,
                "workflow_name": row.workflow_name,
                "optimization_plan": row.optimization_plan,
                "status": row.status,
                "applied_at": row.applied_at,
                "results": row.results,
                "execution_time": time.time() - start_time
            }
            for row in result
        ]
        
        # Cache the result
        await cache_response.set(cache_key, history, expire=300)  # Cache for 5 minutes
        
        # Log audit trail
        await audit_log.log_action(
            user_id=current_user["id"],
            action="get_optimization_history",
            resource_type="workflow",
            resource_id=workflow_id,
            details={"tenant_id": current_user["tenant_id"]}
        )
        
        return history
    except ValueError as e:
        return handle_optimization_error(e, "HISTORY_ERROR")
    except Exception as e:
        return handle_optimization_error(e, "UNEXPECTED_ERROR")

async def _run_optimization(workflow_id: int, tenant_id: int, user_id: int):
    """Background task to run workflow optimization"""
    try:
        db = next(get_db())
        optimizer = WorkflowOptimizer(db)
        
        # Update workflow status
        await db.execute(
            text("""
                UPDATE workflows
                SET status = 'optimizing'
                WHERE id = :workflow_id
                AND tenant_id = :tenant_id
            """),
            {"workflow_id": workflow_id, "tenant_id": tenant_id}
        )
        
        # Run optimization
        result = await optimizer.optimize_workflow(workflow_id)
        
        # Update workflow status
        await db.execute(
            text("""
                UPDATE workflows
                SET status = 'active'
                WHERE id = :workflow_id
                AND tenant_id = :tenant_id
            """),
            {"workflow_id": workflow_id, "tenant_id": tenant_id}
        )
        
        # Invalidate relevant caches
        await invalidate_cache(f"workflow_metrics_{workflow_id}_{tenant_id}")
        await invalidate_cache(f"workflow_performance_{tenant_id}")
        
        # Log optimization completion
        await audit_log.log_action(
            user_id=user_id,
            action="complete_workflow_optimization",
            resource_type="workflow",
            resource_id=workflow_id,
            details={"tenant_id": tenant_id, "result": result}
        )
    except Exception as e:
        # Log error and update workflow status
        await audit_log.log_action(
            user_id=user_id,
            action="workflow_optimization_failed",
            resource_type="workflow",
            resource_id=workflow_id,
            details={"tenant_id": tenant_id, "error": str(e)}
        )
        
        await db.execute(
            text("""
                UPDATE workflows
                SET status = 'active'
                WHERE id = :workflow_id
                AND tenant_id = :tenant_id
            """),
            {"workflow_id": workflow_id, "tenant_id": tenant_id}
        ) 