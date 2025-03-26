from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
import asyncio
from pydantic import BaseModel
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from app.core.config import settings

class License(BaseModel):
    id: str
    type: str
    user_id: int
    tenant_id: int
    status: str
    assigned_at: datetime
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    usage_count: int
    features: List[str]
    cost: float
    metadata: Dict[str, Any]

class UserAccess(BaseModel):
    user_id: int
    tenant_id: int
    roles: List[str]
    permissions: List[str]
    last_access: datetime
    access_patterns: Dict[str, Any]
    risk_score: float

class LicenseManager:
    def __init__(self, db: Session):
        self.db = db
        self.logger = logging.getLogger(__name__)
        self.anomaly_detector = IsolationForest(
            contamination=0.1,
            random_state=42
        )
        self.scaler = StandardScaler()
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize AI models for license and access monitoring"""
        try:
            # Get historical data
            license_data = self._get_historical_license_data()
            access_data = self._get_historical_access_data()
            
            if license_data:
                # Train license anomaly detector
                license_features = self._extract_license_features(license_data)
                self.anomaly_detector.fit(license_features)
            
            if access_data:
                # Train access pattern scaler
                access_features = self._extract_access_features(access_data)
                self.scaler.fit(access_features)
            
            self.logger.info("License and access monitoring models initialized")
        except Exception as e:
            self.logger.error(f"Failed to initialize models: {str(e)}")
    
    def _get_historical_license_data(self) -> List[License]:
        """Get historical license data from database"""
        try:
            query = text("""
                SELECT 
                    id,
                    type,
                    user_id,
                    tenant_id,
                    status,
                    assigned_at,
                    expires_at,
                    last_used_at,
                    usage_count,
                    features,
                    cost,
                    metadata
                FROM licenses
                WHERE assigned_at > CURRENT_TIMESTAMP - INTERVAL '90 days'
            """)
            
            result = self.db.execute(query).fetchall()
            
            return [
                License(
                    id=row.id,
                    type=row.type,
                    user_id=row.user_id,
                    tenant_id=row.tenant_id,
                    status=row.status,
                    assigned_at=row.assigned_at,
                    expires_at=row.expires_at,
                    last_used_at=row.last_used_at,
                    usage_count=row.usage_count,
                    features=row.features,
                    cost=row.cost,
                    metadata=row.metadata
                )
                for row in result
            ]
        except Exception as e:
            self.logger.error(f"Failed to get historical license data: {str(e)}")
            return []
    
    def _get_historical_access_data(self) -> List[UserAccess]:
        """Get historical user access data from database"""
        try:
            query = text("""
                SELECT 
                    user_id,
                    tenant_id,
                    roles,
                    permissions,
                    last_access,
                    access_patterns,
                    risk_score
                FROM user_access
                WHERE last_access > CURRENT_TIMESTAMP - INTERVAL '90 days'
            """)
            
            result = self.db.execute(query).fetchall()
            
            return [
                UserAccess(
                    user_id=row.user_id,
                    tenant_id=row.tenant_id,
                    roles=row.roles,
                    permissions=row.permissions,
                    last_access=row.last_access,
                    access_patterns=row.access_patterns,
                    risk_score=row.risk_score
                )
                for row in result
            ]
        except Exception as e:
            self.logger.error(f"Failed to get historical access data: {str(e)}")
            return []
    
    def _extract_license_features(self, licenses: List[License]) -> np.ndarray:
        """Extract features from license data for anomaly detection"""
        try:
            features = []
            for license in licenses:
                feature_vector = [
                    len(license.features),
                    license.usage_count,
                    license.cost,
                    self._status_to_numeric(license.status),
                    self._days_since_last_use(license.last_used_at),
                    self._days_until_expiry(license.expires_at)
                ]
                features.append(feature_vector)
            
            return np.array(features)
        except Exception as e:
            self.logger.error(f"Failed to extract license features: {str(e)}")
            return np.array([])
    
    def _extract_access_features(self, access_data: List[UserAccess]) -> np.ndarray:
        """Extract features from access data for pattern analysis"""
        try:
            features = []
            for access in access_data:
                feature_vector = [
                    len(access.roles),
                    len(access.permissions),
                    access.risk_score,
                    self._days_since_last_access(access.last_access),
                    len(access.access_patterns)
                ]
                features.append(feature_vector)
            
            return np.array(features)
        except Exception as e:
            self.logger.error(f"Failed to extract access features: {str(e)}")
            return np.array([])
    
    def _status_to_numeric(self, status: str) -> int:
        """Convert license status to numeric value"""
        status_map = {
            "active": 3,
            "suspended": 2,
            "expired": 1,
            "revoked": 0
        }
        return status_map.get(status.lower(), 0)
    
    def _days_since_last_use(self, last_used_at: Optional[datetime]) -> float:
        """Calculate days since last license use"""
        if not last_used_at:
            return float('inf')
        return (datetime.utcnow() - last_used_at).days
    
    def _days_until_expiry(self, expires_at: Optional[datetime]) -> float:
        """Calculate days until license expiry"""
        if not expires_at:
            return float('inf')
        return (expires_at - datetime.utcnow()).days
    
    def _days_since_last_access(self, last_access: datetime) -> float:
        """Calculate days since last user access"""
        return (datetime.utcnow() - last_access).days
    
    async def analyze_license_usage(self) -> Dict[str, Any]:
        """Analyze license usage and identify anomalies"""
        try:
            # Get current license data
            licenses = self._get_historical_license_data()
            
            if not licenses:
                return {"status": "error", "message": "No license data available"}
            
            # Extract features
            features = self._extract_license_features(licenses)
            
            if len(features) == 0:
                return {"status": "error", "message": "Failed to extract features"}
            
            # Detect anomalies
            predictions = self.anomaly_detector.predict(features)
            
            # Analyze results
            anomalies = []
            unused_licenses = []
            high_risk_licenses = []
            
            for i, license in enumerate(licenses):
                if predictions[i] == -1:  # Anomaly detected
                    anomalies.append(license)
                
                # Check for unused licenses
                if self._days_since_last_use(license.last_used_at) > 30:
                    unused_licenses.append(license)
                
                # Check for high-risk licenses
                if self._is_high_risk_license(license):
                    high_risk_licenses.append(license)
            
            return {
                "status": "success",
                "total_licenses": len(licenses),
                "anomalies": [l.dict() for l in anomalies],
                "unused_licenses": [l.dict() for l in unused_licenses],
                "high_risk_licenses": [l.dict() for l in high_risk_licenses],
                "cost_optimization": self._calculate_cost_optimization(licenses)
            }
        except Exception as e:
            self.logger.error(f"License analysis failed: {str(e)}")
            return {"status": "error", "error": str(e)}
    
    def _is_high_risk_license(self, license: License) -> bool:
        """Determine if a license is high risk"""
        # Check for multiple failed access attempts
        failed_attempts = license.metadata.get("failed_attempts", 0)
        if failed_attempts > 5:
            return True
        
        # Check for unusual access patterns
        access_patterns = license.metadata.get("access_patterns", {})
        if self._has_unusual_patterns(access_patterns):
            return True
        
        # Check for suspicious IP addresses
        ip_addresses = license.metadata.get("ip_addresses", [])
        if self._has_suspicious_ips(ip_addresses):
            return True
        
        return False
    
    def _has_unusual_patterns(self, patterns: Dict[str, Any]) -> bool:
        """Check for unusual access patterns"""
        try:
            # Get pattern features
            features = [
                patterns.get("access_frequency", 0),
                patterns.get("unique_locations", 0),
                patterns.get("unique_devices", 0),
                patterns.get("time_variance", 0)
            ]
            
            # Scale features
            scaled_features = self.scaler.transform([features])
            
            # Check if pattern is unusual
            return np.any(np.abs(scaled_features) > 2)  # More than 2 standard deviations
        except Exception:
            return False
    
    def _has_suspicious_ips(self, ip_addresses: List[str]) -> bool:
        """Check for suspicious IP addresses"""
        try:
            # Get geolocation data for IPs
            locations = []
            for ip in ip_addresses:
                location = self._get_ip_location(ip)
                if location:
                    locations.append(location)
            
            # Check for unusual location patterns
            if len(locations) > 3:
                return self._has_location_anomalies(locations)
            
            return False
        except Exception:
            return False
    
    def _get_ip_location(self, ip: str) -> Optional[Dict[str, Any]]:
        """Get geolocation data for IP address"""
        try:
            # In practice, you would use a geolocation service
            # This is a placeholder implementation
            return {
                "country": "US",
                "city": "New York",
                "latitude": 40.7128,
                "longitude": -74.0060
            }
        except Exception:
            return None
    
    def _has_location_anomalies(self, locations: List[Dict[str, Any]]) -> bool:
        """Check for location-based anomalies"""
        try:
            # Calculate distances between consecutive locations
            distances = []
            for i in range(len(locations) - 1):
                dist = self._calculate_distance(
                    locations[i]["latitude"],
                    locations[i]["longitude"],
                    locations[i + 1]["latitude"],
                    locations[i + 1]["longitude"]
                )
                distances.append(dist)
            
            # Check for unrealistic travel times
            return any(d > 1000 for d in distances)  # More than 1000km
        except Exception:
            return False
    
    def _calculate_distance(
        self,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float
    ) -> float:
        """Calculate distance between two points in kilometers"""
        from math import radians, sin, cos, sqrt, atan2
        
        R = 6371  # Earth's radius in kilometers
        
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        
        return R * c
    
    def _calculate_cost_optimization(self, licenses: List[License]) -> Dict[str, Any]:
        """Calculate potential cost optimization opportunities"""
        try:
            total_cost = sum(l.cost for l in licenses)
            unused_cost = sum(l.cost for l in licenses if self._days_since_last_use(l.last_used_at) > 30)
            redundant_cost = sum(l.cost for l in licenses if self._is_redundant_license(l))
            
            return {
                "total_cost": total_cost,
                "unused_cost": unused_cost,
                "redundant_cost": redundant_cost,
                "potential_savings": unused_cost + redundant_cost,
                "optimization_percentage": ((unused_cost + redundant_cost) / total_cost) * 100
            }
        except Exception as e:
            self.logger.error(f"Cost optimization calculation failed: {str(e)}")
            return {
                "total_cost": 0,
                "unused_cost": 0,
                "redundant_cost": 0,
                "potential_savings": 0,
                "optimization_percentage": 0
            }
    
    def _is_redundant_license(self, license: License) -> bool:
        """Determine if a license is redundant"""
        try:
            # Check for overlapping features with other licenses
            query = text("""
                SELECT COUNT(*)
                FROM licenses
                WHERE user_id = :user_id
                AND tenant_id = :tenant_id
                AND id != :license_id
                AND features && :features
                AND status = 'active'
            """)
            
            result = self.db.execute(query, {
                "user_id": license.user_id,
                "tenant_id": license.tenant_id,
                "license_id": license.id,
                "features": license.features
            }).first()
            
            return result[0] > 0
        except Exception:
            return False
    
    async def manage_user_access(
        self,
        user_id: int,
        tenant_id: int,
        action: str,
        roles: Optional[List[str]] = None,
        permissions: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Manage user access and roles"""
        try:
            # Get current user access
            query = text("""
                SELECT roles, permissions, access_patterns, risk_score
                FROM user_access
                WHERE user_id = :user_id AND tenant_id = :tenant_id
            """)
            
            result = self.db.execute(query, {
                "user_id": user_id,
                "tenant_id": tenant_id
            }).first()
            
            if not result:
                # Create new user access record
                return await self._create_user_access(
                    user_id,
                    tenant_id,
                    roles or [],
                    permissions or []
                )
            
            # Update existing user access
            if action == "update":
                return await self._update_user_access(
                    user_id,
                    tenant_id,
                    roles or result.roles,
                    permissions or result.permissions
                )
            elif action == "revoke":
                return await self._revoke_user_access(user_id, tenant_id)
            else:
                return {"status": "error", "message": "Invalid action"}
            
        except Exception as e:
            self.logger.error(f"User access management failed: {str(e)}")
            return {"status": "error", "error": str(e)}
    
    async def _create_user_access(
        self,
        user_id: int,
        tenant_id: int,
        roles: List[str],
        permissions: List[str]
    ) -> Dict[str, Any]:
        """Create new user access record"""
        try:
            # Initialize access patterns
            access_patterns = {
                "login_attempts": 0,
                "failed_attempts": 0,
                "last_login": None,
                "ip_addresses": [],
                "devices": []
            }
            
            # Create user access record
            query = text("""
                INSERT INTO user_access (
                    user_id,
                    tenant_id,
                    roles,
                    permissions,
                    last_access,
                    access_patterns,
                    risk_score
                ) VALUES (
                    :user_id,
                    :tenant_id,
                    :roles,
                    :permissions,
                    CURRENT_TIMESTAMP,
                    :access_patterns,
                    0.0
                )
            """)
            
            self.db.execute(query, {
                "user_id": user_id,
                "tenant_id": tenant_id,
                "roles": roles,
                "permissions": permissions,
                "access_patterns": json.dumps(access_patterns)
            })
            self.db.commit()
            
            return {
                "status": "success",
                "message": "User access created successfully",
                "user_id": user_id,
                "tenant_id": tenant_id,
                "roles": roles,
                "permissions": permissions
            }
        except Exception as e:
            self.logger.error(f"Failed to create user access: {str(e)}")
            self.db.rollback()
            return {"status": "error", "error": str(e)}
    
    async def _update_user_access(
        self,
        user_id: int,
        tenant_id: int,
        roles: List[str],
        permissions: List[str]
    ) -> Dict[str, Any]:
        """Update existing user access"""
        try:
            query = text("""
                UPDATE user_access
                SET roles = :roles,
                    permissions = :permissions,
                    last_access = CURRENT_TIMESTAMP
                WHERE user_id = :user_id AND tenant_id = :tenant_id
            """)
            
            self.db.execute(query, {
                "user_id": user_id,
                "tenant_id": tenant_id,
                "roles": roles,
                "permissions": permissions
            })
            self.db.commit()
            
            return {
                "status": "success",
                "message": "User access updated successfully",
                "user_id": user_id,
                "tenant_id": tenant_id,
                "roles": roles,
                "permissions": permissions
            }
        except Exception as e:
            self.logger.error(f"Failed to update user access: {str(e)}")
            self.db.rollback()
            return {"status": "error", "error": str(e)}
    
    async def _revoke_user_access(
        self,
        user_id: int,
        tenant_id: int
    ) -> Dict[str, Any]:
        """Revoke user access"""
        try:
            # Revoke all active licenses
            query = text("""
                UPDATE licenses
                SET status = 'revoked',
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = :user_id
                AND tenant_id = :tenant_id
                AND status = 'active'
            """)
            
            self.db.execute(query, {
                "user_id": user_id,
                "tenant_id": tenant_id
            })
            
            # Delete user access record
            query = text("""
                DELETE FROM user_access
                WHERE user_id = :user_id AND tenant_id = :tenant_id
            """)
            
            self.db.execute(query, {
                "user_id": user_id,
                "tenant_id": tenant_id
            })
            
            self.db.commit()
            
            return {
                "status": "success",
                "message": "User access revoked successfully",
                "user_id": user_id,
                "tenant_id": tenant_id
            }
        except Exception as e:
            self.logger.error(f"Failed to revoke user access: {str(e)}")
            self.db.rollback()
            return {"status": "error", "error": str(e)}
    
    async def check_access_violations(self) -> Dict[str, Any]:
        """Check for access violations and policy breaches"""
        try:
            # Get all active user access records
            query = text("""
                SELECT 
                    ua.*,
                    COUNT(DISTINCT l.id) as active_licenses,
                    COUNT(DISTINCT CASE WHEN l.status = 'suspended' THEN l.id END) as suspended_licenses
                FROM user_access ua
                LEFT JOIN licenses l ON ua.user_id = l.user_id AND ua.tenant_id = l.tenant_id
                WHERE ua.last_access > CURRENT_TIMESTAMP - INTERVAL '24 hours'
                GROUP BY ua.user_id, ua.tenant_id
            """)
            
            result = self.db.execute(query).fetchall()
            
            violations = []
            for row in result:
                # Check for policy violations
                if self._has_policy_violations(row):
                    violations.append({
                        "user_id": row.user_id,
                        "tenant_id": row.tenant_id,
                        "violation_type": "policy_breach",
                        "details": self._get_violation_details(row)
                    })
                
                # Check for access anomalies
                if self._has_access_anomalies(row):
                    violations.append({
                        "user_id": row.user_id,
                        "tenant_id": row.tenant_id,
                        "violation_type": "access_anomaly",
                        "details": self._get_anomaly_details(row)
                    })
            
            return {
                "status": "success",
                "total_users": len(result),
                "violations": violations,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            self.logger.error(f"Access violation check failed: {str(e)}")
            return {"status": "error", "error": str(e)}
    
    def _has_policy_violations(self, user_access: Any) -> bool:
        """Check for policy violations"""
        try:
            # Check for excessive permissions
            if len(user_access.permissions) > 100:
                return True
            
            # Check for conflicting roles
            if self._has_conflicting_roles(user_access.roles):
                return True
            
            # Check for suspended licenses
            if user_access.suspended_licenses > 0:
                return True
            
            return False
        except Exception:
            return False
    
    def _has_access_anomalies(self, user_access: Any) -> bool:
        """Check for access anomalies"""
        try:
            # Get access pattern features
            features = self._extract_access_features([UserAccess(
                user_id=user_access.user_id,
                tenant_id=user_access.tenant_id,
                roles=user_access.roles,
                permissions=user_access.permissions,
                last_access=user_access.last_access,
                access_patterns=user_access.access_patterns,
                risk_score=user_access.risk_score
            )])
            
            if len(features) == 0:
                return False
            
            # Scale features
            scaled_features = self.scaler.transform(features)
            
            # Check for anomalies
            return np.any(np.abs(scaled_features) > 2)  # More than 2 standard deviations
        except Exception:
            return False
    
    def _has_conflicting_roles(self, roles: List[str]) -> bool:
        """Check for conflicting roles"""
        conflicts = [
            ("admin", "readonly"),
            ("manager", "viewer"),
            ("writer", "readonly")
        ]
        
        return any(
            (role1 in roles and role2 in roles)
            for role1, role2 in conflicts
        )
    
    def _get_violation_details(self, user_access: Any) -> Dict[str, Any]:
        """Get details about policy violations"""
        return {
            "excessive_permissions": len(user_access.permissions) > 100,
            "conflicting_roles": self._has_conflicting_roles(user_access.roles),
            "suspended_licenses": user_access.suspended_licenses > 0,
            "roles": user_access.roles,
            "permissions_count": len(user_access.permissions)
        }
    
    def _get_anomaly_details(self, user_access: Any) -> Dict[str, Any]:
        """Get details about access anomalies"""
        return {
            "access_patterns": user_access.access_patterns,
            "risk_score": user_access.risk_score,
            "active_licenses": user_access.active_licenses,
            "last_access": user_access.last_access.isoformat()
        } 