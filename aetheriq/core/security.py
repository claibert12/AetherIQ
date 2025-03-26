"""
Security manager for handling authentication, authorization, and security features
"""

from typing import Dict, List, Optional, Any, Union
import logging
from datetime import datetime, timedelta
import jwt
import bcrypt
from dataclasses import dataclass
import hashlib
import secrets
from uuid import UUID
import asyncio
import json
from enum import Enum

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from pydantic import BaseModel

from aetheriq.config import get_default_config
from aetheriq.db.session import get_db
from aetheriq.schemas.base import User, UserCreate, UserUpdate
from aetheriq.crud.base import CRUDBase
from aetheriq.db.models import User as UserModel

config = get_default_config()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class Role(str, Enum):
    """User role enum"""
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"

class Permission(str, Enum):
    """Permission enum"""
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    ADMIN = "admin"

@dataclass
class SecurityConfig:
    """Security configuration"""
    password_min_length: int = 12
    password_require_uppercase: bool = True
    password_require_lowercase: bool = True
    password_require_numbers: bool = True
    password_require_special: bool = True
    mfa_enabled: bool = True
    session_timeout_minutes: int = 60
    max_failed_attempts: int = 5
    lockout_duration_minutes: int = 30

class Token(BaseModel):
    """Token model"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    """Token data model"""
    username: Optional[str] = None
    scopes: List[str] = []

class SecurityManager:
    """Security manager for handling authentication and authorization"""

    def __init__(self, config: SecurityConfig):
        """Initialize security manager"""
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self.oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
        self.crud = CRUDBase[UserModel, User, UserUpdate](UserModel)
        self.role_permissions = {
            Role.ADMIN: [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN],
            Role.MANAGER: [Permission.READ, Permission.WRITE],
            Role.USER: [Permission.READ]
        }
        self.failed_attempts: Dict[str, List[datetime]] = {}
        self.active_tokens: Dict[str, List[str]] = {}

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password"""
        return self.pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """Get password hash"""
        return self.pwd_context.hash(password)

    def validate_password(self, password: str) -> bool:
        """Validate password strength"""
        if len(password) < self.config.password_min_length:
            return False
        if self.config.password_require_uppercase and not any(c.isupper() for c in password):
            return False
        if self.config.password_require_lowercase and not any(c.islower() for c in password):
            return False
        if self.config.password_require_numbers and not any(c.isdigit() for c in password):
            return False
        if self.config.password_require_special and not any(not c.isalnum() for c in password):
            return False
        return True

    async def create_access_token(
        self,
        data: Dict[str, Any],
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=config.access_token_expire_minutes)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, config.jwt_secret, algorithm=config.algorithm)
        return encoded_jwt

    async def create_refresh_token(
        self,
        data: Dict[str, Any],
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create refresh token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(days=config.refresh_token_expire_days)
        to_encode.update({"exp": expire, "refresh": True})
        encoded_jwt = jwt.encode(to_encode, config.jwt_secret, algorithm=config.algorithm)
        return encoded_jwt

    async def authenticate_user(
        self,
        username: str,
        password: str
    ) -> Optional[User]:
        """Authenticate user"""
        try:
            # Check for account lockout
            if self._is_account_locked(username):
                raise HTTPException(
                    status_code=403,
                    detail="Account is locked due to too many failed attempts"
                )

            # Get user from database
            db = next(get_db())
            user = self.crud.get_by_username(db, username=username)
            if not user:
                self._record_failed_attempt(username)
                return None

            # Verify password
            if not self.verify_password(password, user.hashed_password):
                self._record_failed_attempt(username)
                return None

            # Reset failed attempts on successful login
            if username in self.failed_attempts:
                del self.failed_attempts[username]

            return user

        except Exception as e:
            self.logger.error(f"Authentication error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Authentication failed"
            )

    async def get_current_user(
        self,
        token: str = Depends(oauth2_scheme)
    ) -> User:
        """Get current user from token"""
        try:
            payload = jwt.decode(token, config.jwt_secret, algorithms=[config.algorithm])
            username: str = payload.get("sub")
            if username is None:
                raise HTTPException(
                    status_code=401,
                    detail="Could not validate credentials"
                )
            token_data = TokenData(username=username)
        except JWTError:
            raise HTTPException(
                status_code=401,
                detail="Could not validate credentials"
            )

        db = next(get_db())
        user = self.crud.get_by_username(db, username=token_data.username)
        if user is None:
            raise HTTPException(
                status_code=401,
                detail="User not found"
            )
        return user

    async def create_user(
        self,
        username: str,
        password: str,
        email: str,
        role: Role,
        full_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create new user"""
        try:
            # Validate password
            if not self.validate_password(password):
                raise ValueError("Password does not meet security requirements")

            # Create user in database
            db = next(get_db())
            user = UserCreate(
                username=username,
                email=email,
                role=role,
                full_name=full_name,
                hashed_password=self.get_password_hash(password)
            )
            db_user = self.crud.create(db, obj_in=user)

            return {
                "status": "success",
                "user_id": str(db_user.id),
                "message": "User created successfully"
            }

        except Exception as e:
            self.logger.error(f"Error creating user: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create user: {str(e)}"
            )

    async def check_permission(
        self,
        user: User,
        required_permission: Permission
    ) -> bool:
        """Check if user has required permission"""
        try:
            user_role = Role(user.role)
            return required_permission in self.role_permissions[user_role]
        except Exception:
            return False

    async def generate_security_report(self) -> Dict[str, Any]:
        """Generate security report"""
        try:
            db = next(get_db())
            users = self.crud.get_multi(db)

            report = {
                "total_users": len(users),
                "roles": {role.value: 0 for role in Role},
                "locked_accounts": len(self.failed_attempts),
                "active_sessions": sum(len(tokens) for tokens in self.active_tokens.values()),
                "mfa_status": {
                    "enabled": sum(1 for user in users if user.mfa_enabled),
                    "disabled": sum(1 for user in users if not user.mfa_enabled)
                }
            }

            # Count users by role
            for user in users:
                report["roles"][user.role] += 1

            return {
                "status": "success",
                "data": report
            }

        except Exception as e:
            self.logger.error(f"Error generating security report: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate security report: {str(e)}"
            )

    def _is_account_locked(self, username: str) -> bool:
        """Check if account is locked"""
        if username not in self.failed_attempts:
            return False

        # Remove attempts older than lockout duration
        cutoff_time = datetime.utcnow() - timedelta(minutes=self.config.lockout_duration_minutes)
        self.failed_attempts[username] = [
            attempt for attempt in self.failed_attempts[username]
            if attempt > cutoff_time
        ]

        # Check if number of recent failed attempts exceeds threshold
        return len(self.failed_attempts[username]) >= self.config.max_failed_attempts

    def _record_failed_attempt(self, username: str) -> None:
        """Record failed login attempt"""
        if username not in self.failed_attempts:
            self.failed_attempts[username] = []
        self.failed_attempts[username].append(datetime.utcnow())

    async def refresh_token(self, refresh_token: str) -> Token:
        """Refresh access token"""
        try:
            payload = jwt.decode(refresh_token, config.jwt_secret, algorithms=[config.algorithm])
            username: str = payload.get("sub")
            if username is None:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid refresh token"
                )
            if not payload.get("refresh"):
                raise HTTPException(
                    status_code=401,
                    detail="Invalid refresh token"
                )

            # Create new tokens
            access_token = await self.create_access_token(
                data={"sub": username}
            )
            new_refresh_token = await self.create_refresh_token(
                data={"sub": username}
            )

            return Token(
                access_token=access_token,
                refresh_token=new_refresh_token
            )

        except JWTError:
            raise HTTPException(
                status_code=401,
                detail="Invalid refresh token"
            )

    async def revoke_token(self, token: str) -> Dict[str, Any]:
        """Revoke token"""
        try:
            payload = jwt.decode(token, config.jwt_secret, algorithms=[config.algorithm])
            username: str = payload.get("sub")
            if username in self.active_tokens:
                self.active_tokens[username] = [
                    t for t in self.active_tokens[username]
                    if t != token
                ]

            return {
                "status": "success",
                "message": "Token revoked successfully"
            }

        except JWTError:
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )

    async def generate_mfa_token(self) -> str:
        """Generate MFA token"""
        return secrets.token_hex(32)

    async def verify_mfa_token(self, token: str, user: User) -> bool:
        """Verify MFA token"""
        # Implement MFA token verification logic
        return True  # Placeholder implementation 