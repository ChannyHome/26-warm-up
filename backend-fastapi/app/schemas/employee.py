from pydantic import BaseModel, Field
from .department import DepartmentOut
# ---------- Employee ----------
class EmployeeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    emp_no: str = Field(min_length=1, max_length=20)
    gender: str = Field(pattern="^(M|F)$")
    phone: str | None = Field(default=None, max_length=30)
    memo: str | None = Field(default=None, max_length=200)
    department_id: int | None = None

class EmployeeUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    emp_no: str | None = Field(default=None, max_length=20)
    gender: str | None = Field(default=None, pattern="^(M|F)$")
    phone: str | None = Field(default=None, max_length=30)
    memo: str | None = Field(default=None, max_length=200)
    department_id: int | None = None

class EmployeeOut(BaseModel):
    id: int
    name: str
    emp_no: str
    gender: str
    phone: str | None = None
    memo: str | None = None
    department_id: int | None = None
    department: DepartmentOut | None = None
    class Config:
        from_attributes = True
