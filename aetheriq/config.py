"""
Configuration management for AetherIQ
"""

from typing import Dict, Any
from pydantic import BaseSettings
from dataclasses import dataclass
import os
from pathlib import Path

class DatabaseSettings(BaseSettings):
    """Database configuration settings"""
    url: str = "postgresql://user:password@localhost:5432/aetheriq"
    pool_size: int = 5
    max_overflow: int = 10
    pool_timeout: int = 30
    pool_recycle: int = 1800

class SecuritySettings(BaseSettings):
    """Security configuration settings"""
    secret_key: str = "your-secret-key-here"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    password_min_length: int = 12
    mfa_enabled: bool = True

class AnalyticsSettings(BaseSettings):
    """Analytics configuration settings"""
    batch_size: int = 1000
    processing_interval_seconds: int = 60
    data_retention_days: int = 90
    max_processing_time_seconds: int = 300
    metrics: Dict[str, Any] = {
        "workflow_execution": {
            "enabled": True,
            "retention_days": 90
        },
        "system_metrics": {
            "enabled": True,
            "retention_days": 30
        },
        "user_activity": {
            "enabled": True,
            "retention_days": 90
        }
    }

class WorkflowSettings(BaseSettings):
    """Workflow configuration settings"""
    max_concurrent_workflows: int = 10
    max_task_retries: int = 3
    task_timeout_seconds: int = 300
    default_task_handlers: Dict[str, Any] = {
        "system_check": {
            "enabled": True,
            "timeout": 60
        },
        "data_backup": {
            "enabled": True,
            "timeout": 300
        },
        "log_cleanup": {
            "enabled": True,
            "timeout": 60
        }
    }

class ComplianceSettings(BaseSettings):
    """Compliance configuration settings"""
    retention_period_days: int = 365
    audit_log_enabled: bool = True
    auto_remediation_enabled: bool = True
    compliance_frameworks: Dict[str, Any] = {
        "SOC2": {
            "enabled": True,
            "check_interval_days": 7
        },
        "GDPR": {
            "enabled": True,
            "check_interval_days": 7
        },
        "HIPAA": {
            "enabled": True,
            "check_interval_days": 7
        }
    }

class LoggingSettings(BaseSettings):
    """Logging configuration settings"""
    level: str = "INFO"
    format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    file_path: str = "logs/aetheriq.log"
    max_size_mb: int = 100
    backup_count: int = 5

@dataclass
class AppConfig:
    """Main application configuration"""
    database: DatabaseSettings
    security: SecuritySettings
    analytics: AnalyticsSettings
    workflow: WorkflowSettings
    compliance: ComplianceSettings
    logging: LoggingSettings

def get_default_config() -> AppConfig:
    """Get default application configuration"""
    return AppConfig(
        database=DatabaseSettings(),
        security=SecuritySettings(),
        analytics=AnalyticsSettings(),
        workflow=WorkflowSettings(),
        compliance=ComplianceSettings(),
        logging=LoggingSettings()
    )

def load_config_from_env() -> AppConfig:
    """Load configuration from environment variables"""
    return AppConfig(
        database=DatabaseSettings(
            url=os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/aetheriq"),
            pool_size=int(os.getenv("DB_POOL_SIZE", "5")),
            max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "10")),
            pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "30")),
            pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "1800"))
        ),
        security=SecuritySettings(
            secret_key=os.getenv("SECRET_KEY", "your-secret-key-here"),
            algorithm=os.getenv("ALGORITHM", "HS256"),
            access_token_expire_minutes=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30")),
            refresh_token_expire_days=int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")),
            password_min_length=int(os.getenv("PASSWORD_MIN_LENGTH", "12")),
            mfa_enabled=os.getenv("MFA_ENABLED", "true").lower() == "true"
        ),
        analytics=AnalyticsSettings(
            batch_size=int(os.getenv("ANALYTICS_BATCH_SIZE", "1000")),
            processing_interval_seconds=int(os.getenv("ANALYTICS_PROCESSING_INTERVAL", "60")),
            data_retention_days=int(os.getenv("ANALYTICS_RETENTION_DAYS", "90")),
            max_processing_time_seconds=int(os.getenv("ANALYTICS_MAX_PROCESSING_TIME", "300"))
        ),
        workflow=WorkflowSettings(
            max_concurrent_workflows=int(os.getenv("MAX_CONCURRENT_WORKFLOWS", "10")),
            max_task_retries=int(os.getenv("MAX_TASK_RETRIES", "3")),
            task_timeout_seconds=int(os.getenv("TASK_TIMEOUT_SECONDS", "300"))
        ),
        compliance=ComplianceSettings(
            retention_period_days=int(os.getenv("COMPLIANCE_RETENTION_DAYS", "365")),
            audit_log_enabled=os.getenv("AUDIT_LOG_ENABLED", "true").lower() == "true",
            auto_remediation_enabled=os.getenv("AUTO_REMEDIATION_ENABLED", "true").lower() == "true"
        ),
        logging=LoggingSettings(
            level=os.getenv("LOG_LEVEL", "INFO"),
            format=os.getenv("LOG_FORMAT", "%(asctime)s - %(name)s - %(levelname)s - %(message)s"),
            file_path=os.getenv("LOG_FILE_PATH", "logs/aetheriq.log"),
            max_size_mb=int(os.getenv("LOG_MAX_SIZE_MB", "100")),
            backup_count=int(os.getenv("LOG_BACKUP_COUNT", "5"))
        )
    )

def setup_logging(config: LoggingSettings) -> None:
    """Setup logging configuration"""
    import logging
    from logging.handlers import RotatingFileHandler

    # Create logs directory if it doesn't exist
    log_path = Path(config.file_path)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    # Configure logging
    logging.basicConfig(
        level=getattr(logging, config.level),
        format=config.format,
        handlers=[
            logging.StreamHandler(),
            RotatingFileHandler(
                config.file_path,
                maxBytes=config.max_size_mb * 1024 * 1024,
                backupCount=config.backup_count
            )
        ]
    ) 