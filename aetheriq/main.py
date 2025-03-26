"""
AetherIQ Main Application
Initializes and coordinates all platform components
"""

import asyncio
import logging
from typing import Dict, Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.automation import AutomationEngine
from .core.analytics import AnalyticsEngine, AnalyticsConfig
from .core.security import SecurityManager, SecurityConfig
from .core.compliance import ComplianceManager, ComplianceConfig
from .core.workflow import WorkflowEngine, WorkflowConfig
from .core.integration import IntegrationManager, IntegrationConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AetherIQ:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Initialize components
        self.automation_engine = AutomationEngine(config.get('automation', {}))
        self.analytics_engine = AnalyticsEngine(AnalyticsConfig(**config.get('analytics', {})))
        self.security_manager = SecurityManager(SecurityConfig(**config.get('security', {})))
        self.compliance_manager = ComplianceManager(ComplianceConfig(**config.get('compliance', {})))
        self.workflow_engine = WorkflowEngine(WorkflowConfig(**config.get('workflow', {})))
        self.integration_manager = IntegrationManager(IntegrationConfig(**config.get('integration', {})))
        
        # Initialize FastAPI app
        self.app = FastAPI(
            title="AetherIQ Platform",
            description="Enterprise AI Automation Platform",
            version="1.0.0"
        )
        
        # Set up CORS
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # Configure appropriately for production
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        # Set up routes
        self._setup_routes()
        
        # Initialize background tasks
        self.background_tasks = []

    async def initialize(self) -> None:
        """Initialize all platform components"""
        self.logger.info("Initializing AetherIQ Platform")
        
        try:
            # Initialize components
            await self.automation_engine.initialize()
            await self.analytics_engine.initialize()
            await self.security_manager.initialize()
            await self.compliance_manager.initialize()
            await self.workflow_engine.initialize()
            await self.integration_manager.initialize()
            
            # Start background tasks
            self._start_background_tasks()
            
            self.logger.info("AetherIQ Platform initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize AetherIQ Platform: {str(e)}")
            raise

    def _setup_routes(self) -> None:
        """Set up API routes"""
        # Automation routes
        @self.app.post("/api/v1/automation/workflows")
        async def create_workflow(workflow_data: Dict[str, Any]):
            return await self.automation_engine.create_workflow(
                workflow_data['template_id'],
                workflow_data['parameters']
            )
        
        @self.app.get("/api/v1/automation/workflows/{workflow_id}")
        async def get_workflow_status(workflow_id: str):
            return await self.automation_engine.get_workflow_status(workflow_id)
        
        # Analytics routes
        @self.app.post("/api/v1/analytics/process")
        async def process_data(data: Dict[str, Any]):
            return await self.analytics_engine.process_data(
                data['data'],
                data['data_type']
            )
        
        @self.app.get("/api/v1/analytics/report")
        async def get_analytics_report(start_date: str = None, end_date: str = None):
            return await self.analytics_engine.get_analytics_report(start_date, end_date)
        
        # Security routes
        @self.app.post("/api/v1/security/authenticate")
        async def authenticate_user(credentials: Dict[str, str]):
            return await self.security_manager.authenticate_user(
                credentials['username'],
                credentials['password']
            )
        
        @self.app.get("/api/v1/security/report")
        async def get_security_report(start_date: str = None, end_date: str = None):
            return await self.security_manager.get_security_report(start_date, end_date)
        
        # Compliance routes
        @self.app.post("/api/v1/compliance/check")
        async def check_compliance(data: Dict[str, Any]):
            return await self.compliance_manager.check_compliance(
                data['framework'],
                data['resource_id'],
                data['resource_type'],
                data['data']
            )
        
        @self.app.get("/api/v1/compliance/report")
        async def get_compliance_report(framework: str, start_date: str = None, end_date: str = None):
            return await self.compliance_manager.get_compliance_report(
                framework,
                start_date,
                end_date
            )
        
        # Workflow routes
        @self.app.post("/api/v1/workflows")
        async def create_workflow(workflow_data: Dict[str, Any]):
            return await self.workflow_engine.create_workflow(
                workflow_data['template_id'],
                workflow_data['parameters'],
                workflow_data.get('priority', 0)
            )
        
        @self.app.get("/api/v1/workflows/{workflow_id}")
        async def get_workflow_status(workflow_id: str):
            return await self.workflow_engine.get_workflow_status(workflow_id)
        
        # Integration routes
        @self.app.post("/api/v1/integrations")
        async def register_integration(integration_data: Dict[str, Any]):
            return await self.integration_manager.register_integration(
                integration_data['id'],
                integration_data['type'],
                integration_data['config']
            )
        
        @self.app.get("/api/v1/integrations/{integration_id}")
        async def get_integration_status(integration_id: str):
            return await self.integration_manager.get_integration_status(integration_id)

    def _start_background_tasks(self) -> None:
        """Start background tasks"""
        # Add background tasks here
        pass

    async def shutdown(self) -> None:
        """Shutdown all platform components"""
        self.logger.info("Shutting down AetherIQ Platform")
        
        try:
            # Cancel background tasks
            for task in self.background_tasks:
                task.cancel()
            
            # Wait for tasks to complete
            await asyncio.gather(*self.background_tasks, return_exceptions=True)
            
            # Clean up resources
            # Add cleanup code here
            
            self.logger.info("AetherIQ Platform shut down successfully")
        except Exception as e:
            self.logger.error(f"Error during shutdown: {str(e)}")
            raise

def create_app(config: Dict[str, Any]) -> FastAPI:
    """Create and configure the FastAPI application"""
    aetheriq = AetherIQ(config)
    
    @aetheriq.app.on_event("startup")
    async def startup_event():
        await aetheriq.initialize()
    
    @aetheriq.app.on_event("shutdown")
    async def shutdown_event():
        await aetheriq.shutdown()
    
    return aetheriq.app 