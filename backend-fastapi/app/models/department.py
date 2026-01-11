from sqlalchemy import (
    String, Integer, DateTime, func, ForeignKey, Enum, Text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[str] = mapped_column(DateTime, server_default=func.now())
    