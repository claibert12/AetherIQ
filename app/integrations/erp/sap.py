from typing import Any, Dict, List, Optional
from datetime import datetime
import aiohttp
from app.integrations.base.integration import BaseIntegration, IntegrationConfig

class SAPIntegration(BaseIntegration):
    def __init__(self, config: IntegrationConfig):
        super().__init__(config)
        self.api_version = self.config.settings.get('api_version', 'v1')
        self.endpoints = {
            'auth': f"{self.config.base_url}/oauth/token",
            'business_partners': f"{self.config.base_url}/api/{self.api_version}/business-partners",
            'sales_orders': f"{self.config.base_url}/api/{self.api_version}/sales-orders",
            'inventory': f"{self.config.base_url}/api/{self.api_version}/inventory"
        }
        self._access_token = None
        self._token_expiry = None

    async def _get_access_token(self) -> str:
        """Get OAuth access token for SAP API"""
        if self._access_token and self._token_expiry and datetime.utcnow() < self._token_expiry:
            return self._access_token

        credentials = {
            'client_id': self._get_credentials('client_id'),
            'client_secret': self._get_credentials('client_secret'),
            'grant_type': 'client_credentials',
            'scope': 'all'
        }

        async with self.session.post(self.endpoints['auth'], data=credentials) as response:
            if response.status != 200:
                raise Exception(f"Failed to get access token: {await response.text()}")
            
            token_data = await response.json()
            self._access_token = token_data['access_token']
            self._token_expiry = datetime.utcnow() + datetime.timedelta(seconds=token_data['expires_in'])
            return self._access_token

    async def connect(self) -> bool:
        """Test connection to SAP system"""
        try:
            token = await self._get_access_token()
            headers = {'Authorization': f'Bearer {token}'}
            
            async with self.session.get(
                f"{self.endpoints['business_partners']}/count",
                headers=headers
            ) as response:
                return response.status == 200
        except Exception as e:
            print(f"Connection error: {str(e)}")
            return False

    async def sync_data(self) -> Dict[str, Any]:
        """Synchronize data with SAP system"""
        try:
            token = await self._get_access_token()
            headers = {'Authorization': f'Bearer {token}'}
            
            # Sync business partners
            async with self.session.get(
                self.endpoints['business_partners'],
                headers=headers
            ) as response:
                if response.status != 200:
                    raise Exception(f"Failed to sync business partners: {await response.text()}")
                business_partners = await response.json()

            # Sync sales orders
            async with self.session.get(
                self.endpoints['sales_orders'],
                headers=headers
            ) as response:
                if response.status != 200:
                    raise Exception(f"Failed to sync sales orders: {await response.text()}")
                sales_orders = await response.json()

            # Sync inventory
            async with self.session.get(
                self.endpoints['inventory'],
                headers=headers
            ) as response:
                if response.status != 200:
                    raise Exception(f"Failed to sync inventory: {await response.text()}")
                inventory = await response.json()

            self.config.last_sync = datetime.utcnow()
            
            return {
                "status": "success",
                "timestamp": self.config.last_sync.isoformat(),
                "data": {
                    "business_partners": len(business_partners),
                    "sales_orders": len(sales_orders),
                    "inventory_items": len(inventory)
                }
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

    async def send_data(self, data: Dict[str, Any]) -> bool:
        """Send data to SAP system"""
        try:
            token = await self._get_access_token()
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            }

            # Example: Send sales order
            if 'sales_order' in data:
                async with self.session.post(
                    self.endpoints['sales_orders'],
                    headers=headers,
                    json=data['sales_order']
                ) as response:
                    if response.status != 201:
                        raise Exception(f"Failed to create sales order: {await response.text()}")
                    return True

            return False
        except Exception as e:
            print(f"Error sending data: {str(e)}")
            return False

    async def get_business_partners(self) -> List[Dict[str, Any]]:
        """Get list of business partners from SAP"""
        token = await self._get_access_token()
        headers = {'Authorization': f'Bearer {token}'}
        
        async with self.session.get(
            self.endpoints['business_partners'],
            headers=headers
        ) as response:
            if response.status != 200:
                raise Exception(f"Failed to get business partners: {await response.text()}")
            return await response.json()

    async def create_sales_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new sales order in SAP"""
        token = await self._get_access_token()
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        async with self.session.post(
            self.endpoints['sales_orders'],
            headers=headers,
            json=order_data
        ) as response:
            if response.status != 201:
                raise Exception(f"Failed to create sales order: {await response.text()}")
            return await response.json() 