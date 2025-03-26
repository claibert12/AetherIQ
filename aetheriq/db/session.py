"""
Database session management for AetherIQ platform
"""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool

from aetheriq.config import get_default_config

config = get_default_config()
database_url = config.database.url

# Create engine with connection pooling
engine = create_engine(
    database_url,
    poolclass=QueuePool,
    pool_size=config.database.pool_size,
    max_overflow=config.database.max_overflow,
    pool_timeout=30,  # seconds
    pool_recycle=1800,  # 30 minutes
    pool_pre_ping=True,
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator:
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_async_db() -> Generator:
    """Get async database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db() -> None:
    """Initialize database"""
    from aetheriq.db.models import Base
    Base.metadata.create_all(bind=engine)

def close_db() -> None:
    """Close database connections"""
    engine.dispose() 