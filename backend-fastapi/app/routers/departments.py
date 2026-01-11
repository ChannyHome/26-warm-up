from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..schemas import DepartmentCreate, DepartmentUpdate, DepartmentOut
from ..crud.department import (
    dept_list, dept_get, dept_create, dept_update, dept_delete
)

router = APIRouter(prefix="/api/departments", tags=["departments"])

# ---------- Departments ----------
@router.get("", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return dept_list(db)

@router.post("", response_model=DepartmentOut)
def create_department(data: DepartmentCreate, db: Session = Depends(get_db)):
    return dept_create(db, data)

@router.put("/{dept_id}", response_model=DepartmentOut)
def update_department(dept_id: int, data: DepartmentUpdate, db: Session = Depends(get_db)):
    obj = dept_get(db, dept_id)
    if not obj:
        raise HTTPException(404, "Department not found")
    return dept_update(db, obj, data)

@router.delete("/{dept_id}")
def delete_department(dept_id: int, db: Session = Depends(get_db)):
    obj = dept_get(db, dept_id)
    if not obj:
        raise HTTPException(404, "Department not found")
    dept_delete(db, obj)
    return {"ok": True}