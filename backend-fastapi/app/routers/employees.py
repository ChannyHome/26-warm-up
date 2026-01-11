from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..schemas import EmployeeCreate, EmployeeUpdate, EmployeeOut
from ..crud.employee import (
    emp_list, emp_get, emp_create, emp_update, emp_delete
)
router = APIRouter(prefix="/api/employees", tags=["employees"])

# ---------- Employees ----------
@router.get("", response_model=list[EmployeeOut])
def list_employees(db: Session = Depends(get_db)):
    return emp_list(db)

@router.post("", response_model=EmployeeOut)
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    return emp_create(db, data)
@router.put("/{emp_id}", response_model=EmployeeOut)
def update_employee(emp_id: int, data: EmployeeUpdate, db: Session = Depends(get_db)):
    obj = emp_get(db, emp_id)
    if not obj:
        raise HTTPException(404, "Employee not found")
    return emp_update(db, obj, data)

@router.delete("/{emp_id}")
def delete_employee(emp_id: int, db: Session = Depends(get_db)):
    obj = emp_get(db, emp_id)
    if not obj:
        raise HTTPException(404, "Employee not found")
    emp_delete(db, obj)
    return {"ok": True}