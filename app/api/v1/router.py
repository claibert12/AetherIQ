from fastapi import APIRouter

from app.api.v1.endpoints import enforcement, monitoring

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(enforcement.router, prefix="/enforcement", tags=["enforcement"])
api_router.include_router(monitoring.router, prefix="/monitoring", tags=["monitoring"]) 