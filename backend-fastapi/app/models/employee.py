from sqlalchemy import (
    String, Integer, DateTime, func, ForeignKey, Enum, Text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..db import Base

class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    emp_no: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    gender: Mapped[str] = mapped_column(Enum("M", "F"), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)

    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    department = relationship("Department", lazy="joined")

    created_at: Mapped[str] = mapped_column(DateTime, server_default=func.now())
