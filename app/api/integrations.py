from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime

from app.core.security import oauth2_scheme
from app.db.base import get_db
from app.db import models
from app.integrations.base.integration import IntegrationConfig
from app.integrations.erp.sap import SAPIntegration

router = APIRouter()

@router.post("/integrations/", response_model=Dict[str, Any])
async def create_integration(
    integration_data: Dict[str, Any],
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    """Create a new integration"""
    # Get current user from token
    user = db.query(models.User).filter(models.User.id == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate integration type
    integration_type = integration_data.get("type")
    if integration_type not in ["erp", "itsm", "security"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid integration type: {integration_type}"
        )
    
    # Create integration config
    config = IntegrationConfig(
        name=integration_data["name"],
        type=integration_type,
        base_url=integration_data["base_url"],
        credentials=integration_data["credentials"],
        settings=integration_data.get("settings", {})
    )
    
    # Initialize appropriate integration
    integration = None
    if integration_type == "erp" and integration_data.get("provider") == "sap":
        integration = SAPIntegration(config)
    
    if not integration:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported integration provider: {integration_data.get('provider')}"
        )
    
    # Test connection
    is_connected = await integration.connect()
    if not is_connected:
        raise HTTPException(
            status_code=400,
            detail="Failed to connect to integration"
        )
    
    # Store integration in database
    db_integration = models.Integration(
        name=config.name,
        type=config.type,
        provider=integration_data.get("provider"),
        base_url=config.base_url,
        credentials=config.credentials,
        settings=config.settings,
        tenant_id=user.tenant_id,
        created_by_id=user.id,
        last_sync=config.last_sync
    )
    
    db.add(db_integration)
    db.commit()
    db.refresh(db_integration)
    
    return {
        "id": db_integration.id,
        "name": db_integration.name,
        "type": db_integration.type,
        "provider": db_integration.provider,
        "status": "connected",
        "created_at": db_integration.created_at
    }

@router.get("/integrations/", response_model=List[Dict[str, Any]])
async def list_integrations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    """List all integrations for the tenant"""
    user = db.query(models.User).filter(models.User.id == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    integrations = db.query(models.Integration)\
        .filter(models.Integration.tenant_id == user.tenant_id)\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return [
        {
            "id": i.id,
            "name": i.name,
            "type": i.type,
            "provider": i.provider,
            "status": "connected" if i.last_sync else "disconnected",
            "last_sync": i.last_sync,
            "created_at": i.created_at
        }
        for i in integrations
    ]

@router.post("/integrations/{integration_id}/sync", response_model=Dict[str, Any])
async def sync_integration(
    integration_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    """Trigger data synchronization for an integration"""
    user = db.query(models.User).filter(models.User.id == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    integration = db.query(models.Integration)\
        .filter(
            models.Integration.id == integration_id,
            models.Integration.tenant_id == user.tenant_id
        )\
        .first()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Initialize appropriate integration
    config = IntegrationConfig(
        name=integration.name,
        type=integration.type,
        base_url=integration.base_url,
        credentials=integration.credentials,
        settings=integration.settings
    )
    
    integration_instance = None
    if integration.type == "erp" and integration.provider == "sap":
        integration_instance = SAPIntegration(config)
    
    if not integration_instance:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported integration provider: {integration.provider}"
        )
    
    # Perform sync
    async with integration_instance:
        sync_result = await integration_instance.sync_data()
    
    # Update last sync time
    integration.last_sync = datetime.utcnow()
    db.commit()
    
    return sync_result

@router.get("/integrations/{integration_id}/health", response_model=Dict[str, Any])
async def check_integration_health(
    integration_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    """Check integration health status"""
    user = db.query(models.User).filter(models.User.id == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    integration = db.query(models.Integration)\
        .filter(
            models.Integration.id == integration_id,
            models.Integration.tenant_id == user.tenant_id
        )\
        .first()
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Initialize appropriate integration
    config = IntegrationConfig(
        name=integration.name,
        type=integration.type,
        base_url=integration.base_url,
        credentials=integration.credentials,
        settings=integration.settings
    )
    
    integration_instance = None
    if integration.type == "erp" and integration.provider == "sap":
        integration_instance = SAPIntegration(config)
    
    if not integration_instance:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported integration provider: {integration.provider}"
        )
    
    # Check health
    async with integration_instance:
        health_status = await integration_instance.health_check()
    
    return health_status 