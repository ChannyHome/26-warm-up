from pydantic import BaseModel, Field

# ---------- Department ----------
class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    note: str | None = Field(default=None, max_length=200)

class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    note: str | None = Field(default=None, max_length=200)

class DepartmentOut(BaseModel):
    id: int
    name: str
    note: str | None = None
    class Config:
        from_attributes = True