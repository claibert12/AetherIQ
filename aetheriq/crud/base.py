"""
Base CRUD operations for database models
"""

from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from uuid import UUID
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy.orm import Session

from aetheriq.db.models import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)

class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base class for CRUD operations
    """
    def __init__(self, model: Type[ModelType]):
        """
        Initialize CRUD operations with model class
        """
        self.model = model

    def get(self, db: Session, id: UUID) -> Optional[ModelType]:
        """
        Get a record by ID
        """
        return db.query(self.model).filter(self.model.id == id).first()

    def get_multi(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        **filters
    ) -> List[ModelType]:
        """
        Get multiple records with optional filtering
        """
        query = db.query(self.model)
        for field, value in filters.items():
            if hasattr(self.model, field):
                query = query.filter(getattr(self.model, field) == value)
        return query.offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: CreateSchemaType) -> ModelType:
        """
        Create a new record
        """
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        """
        Update a record
        """
        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, id: UUID) -> ModelType:
        """
        Delete a record
        """
        obj = db.query(self.model).get(id)
        db.delete(obj)
        db.commit()
        return obj

    def exists(self, db: Session, id: UUID) -> bool:
        """
        Check if a record exists
        """
        return db.query(self.model).filter(self.model.id == id).first() is not None

    def count(self, db: Session, **filters) -> int:
        """
        Count records with optional filtering
        """
        query = db.query(self.model)
        for field, value in filters.items():
            if hasattr(self.model, field):
                query = query.filter(getattr(self.model, field) == value)
        return query.count()

    def get_by_field(
        self,
        db: Session,
        field: str,
        value: Any
    ) -> Optional[ModelType]:
        """
        Get a record by field value
        """
        if hasattr(self.model, field):
            return db.query(self.model).filter(getattr(self.model, field) == value).first()
        return None

    def get_multi_by_field(
        self,
        db: Session,
        field: str,
        value: Any,
        *,
        skip: int = 0,
        limit: int = 100
    ) -> List[ModelType]:
        """
        Get multiple records by field value
        """
        if hasattr(self.model, field):
            return (
                db.query(self.model)
                .filter(getattr(self.model, field) == value)
                .offset(skip)
                .limit(limit)
                .all()
            )
        return []

    def bulk_create(
        self,
        db: Session,
        *,
        objs_in: List[CreateSchemaType]
    ) -> List[ModelType]:
        """
        Create multiple records
        """
        db_objs = []
        for obj_in in objs_in:
            obj_in_data = jsonable_encoder(obj_in)
            db_obj = self.model(**obj_in_data)
            db_objs.append(db_obj)
        db.add_all(db_objs)
        db.commit()
        for db_obj in db_objs:
            db.refresh(db_obj)
        return db_objs

    def bulk_update(
        self,
        db: Session,
        *,
        objs: List[Dict[str, Any]]
    ) -> List[ModelType]:
        """
        Update multiple records
        """
        updated_objs = []
        for obj in objs:
            if "id" not in obj:
                continue
            db_obj = self.get(db, id=obj["id"])
            if db_obj:
                updated_obj = self.update(db, db_obj=db_obj, obj_in=obj)
                updated_objs.append(updated_obj)
        return updated_objs

    def bulk_delete(
        self,
        db: Session,
        *,
        ids: List[UUID]
    ) -> List[ModelType]:
        """
        Delete multiple records
        """
        objs = db.query(self.model).filter(self.model.id.in_(ids)).all()
        for obj in objs:
            db.delete(obj)
        db.commit()
        return objs 