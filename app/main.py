"""
AetherIQ Platform Main Application
"""
import uvicorn
from api.endpoints import app

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="localhost",
        port=8000,
        reload=True,
        workers=4,
        log_level="info"
    )

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta

from app.core.config import settings
from app.core.security import create_access_token, verify_password, encrypt_sensitive_data
from app.db.base import get_db
from app.db import models
from app.api import workflows, users, ai_optimize, encryption, websockets

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include routers
app.include_router(workflows.router, prefix=settings.API_V1_STR, tags=["workflows"])
app.include_router(users.router, prefix=settings.API_V1_STR, tags=["users"])
app.include_router(ai_optimize.router, prefix=settings.API_V1_STR, tags=["ai-optimize"])
app.include_router(encryption.router, prefix=settings.API_V1_STR, tags=["encryption"])
app.include_router(websockets.router, tags=["websockets"])  # No prefix for WebSocket routes

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/login")

@app.get("/")
async def root():
    return {"message": "Welcome to AetherIQ API"}

@app.post(f"{settings.API_V1_STR}/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.id, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "tenant_id": user.tenant_id
    } 