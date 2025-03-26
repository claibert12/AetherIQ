from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from datetime import datetime
import aiohttp
import asyncio
from app.core.security import encrypt_sensitive_data, decrypt_sensitive_data

class IntegrationConfig:
    def __init__(
        self,
        name: str,
        type: str,
        base_url: str,
        credentials: Dict[str, str],
        settings: Optional[Dict[str, Any]] = None
    ):
        self.name = name
        self.type = type
        self.base_url = base_url
        self.credentials = credentials
        self.settings = settings or {}
        self.created_at = datetime.utcnow()
        self.last_sync = None

class BaseIntegration(ABC):
    def __init__(self, config: IntegrationConfig):
        self.config = config
        self.session: Optional[aiohttp.ClientSession] = None
        self._setup_credentials()

    def _setup_credentials(self):
        """Encrypt sensitive credentials before storage"""
        for key, value in self.config.credentials.items():
            if key in ['password', 'api_key', 'secret']:
                self.config.credentials[key] = encrypt_sensitive_data(value)

    def _get_credentials(self, key: str) -> str:
        """Decrypt sensitive credentials when needed"""
        value = self.config.credentials.get(key)
        if key in ['password', 'api_key', 'secret'] and value:
            return decrypt_sensitive_data(value)
        return value

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    @abstractmethod
    async def connect(self) -> bool:
        """Test connection to the integration"""
        pass

    @abstractmethod
    async def sync_data(self) -> Dict[str, Any]:
        """Synchronize data with the external system"""
        pass

    @abstractmethod
    async def send_data(self, data: Dict[str, Any]) -> bool:
        """Send data to the external system"""
        pass

    async def health_check(self) -> Dict[str, Any]:
        """Check integration health and status"""
        try:
            is_connected = await self.connect()
            return {
                "status": "healthy" if is_connected else "unhealthy",
                "last_sync": self.config.last_sync,
                "connection_status": "connected" if is_connected else "disconnected",
                "error": None
            }
        except Exception as e:
            return {
                "status": "error",
                "last_sync": self.config.last_sync,
                "connection_status": "error",
                "error": str(e)
            }

    async def validate_credentials(self) -> bool:
        """Validate integration credentials"""
        try:
            return await self.connect()
        except Exception:
            return False

    def get_sync_status(self) -> Dict[str, Any]:
        """Get current sync status"""
        return {
            "last_sync": self.config.last_sync,
            "status": "pending" if not self.config.last_sync else "completed",
            "integration_type": self.config.type,
            "integration_name": self.config.name
        } 