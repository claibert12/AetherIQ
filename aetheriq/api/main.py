"""
Main FastAPI application for AetherIQ
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging
from typing import Dict, Any

from aetheriq.core.security import SecurityManager, SecurityConfig
from aetheriq.core.analytics import AnalyticsEngine
from aetheriq.core.workflow import WorkflowEngine
from aetheriq.core.compliance import ComplianceManager, ComplianceConfig
from aetheriq.config import get_default_config
from aetheriq.schemas.base import User, Token

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize configuration
config = get_default_config()

# Initialize core services
security_config = SecurityConfig()
security_manager = SecurityManager(security_config)
analytics_engine = AnalyticsEngine(config.analytics)
workflow_engine = WorkflowEngine(config.workflow)
compliance_manager = ComplianceManager(ComplianceConfig())

# Initialize FastAPI app
app = FastAPI(
    title="AetherIQ API",
    description="Enterprise AI Automation Platform API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )

# Dependency injection
async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    return await security_manager.get_current_user(token)

# Health check endpoint
@app.get("/api/health")
async def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "version": "1.0.0",
        "services": {
            "security": "operational",
            "analytics": "operational",
            "workflow": "operational",
            "compliance": "operational"
        }
    }

# Authentication endpoints
@app.post("/api/auth/token")
async def login(username: str, password: str) -> Token:
    user = await security_manager.authenticate_user(username, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token = await security_manager.create_access_token(
        data={"sub": user.username}
    )
    refresh_token = await security_manager.create_refresh_token(
        data={"sub": user.username}
    )
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token
    )

@app.post("/api/auth/refresh")
async def refresh_token(refresh_token: str) -> Token:
    return await security_manager.refresh_token(refresh_token)

# Analytics endpoints
@app.post("/api/analytics/process")
async def process_analytics(
    data: Dict[str, Any],
    data_type: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    return await analytics_engine.process_data(data, data_type)

@app.get("/api/analytics/report")
async def get_analytics_report(
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    return await analytics_engine.get_analytics_report(start_date, end_date)

# Workflow endpoints
@app.post("/api/workflows")
async def create_workflow(
    name: str,
    tasks: list,
    metadata: Dict[str, Any] = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    return await workflow_engine.create_workflow(name, tasks, metadata)

@app.post("/api/workflows/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    return await workflow_engine.execute_workflow(workflow_id)

@app.get("/api/workflows/{workflow_id}/status")
async def get_workflow_status(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    return await workflow_engine.get_workflow_status(workflow_id)

@app.post("/api/workflows/{workflow_id}/cancel")
async def cancel_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    return await workflow_engine.cancel_workflow(workflow_id)

# Compliance endpoints
@app.post("/api/compliance/check")
async def run_compliance_check(
    rule_id: str = None,
    category: str = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    return await compliance_manager.run_compliance_check(rule_id, category)

@app.get("/api/compliance/status")
async def get_compliance_status(
    rule_id: str = None,
    category: str = None,
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    return await compliance_manager.get_compliance_status(
        rule_id, category, start_date, end_date
    )

@app.get("/api/compliance/report")
async def get_compliance_report(
    framework: str,
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    return await compliance_manager.get_compliance_report(
        framework, start_date, end_date
    )

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting AetherIQ services")
    await analytics_engine.initialize()
    await workflow_engine.initialize()
    await compliance_manager.initialize()

@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown services on shutdown"""
    logger.info("Shutting down AetherIQ services")
    await analytics_engine.shutdown()
    await workflow_engine.shutdown()
    await compliance_manager.shutdown() 