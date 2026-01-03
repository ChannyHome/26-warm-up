from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import Department, Employee
from app.schemas import (
    DepartmentCreate, DepartmentUpdate,
    EmployeeCreate, EmployeeUpdate
)

# -------- Department CRUD --------
def dept_list(db: Session):
    return db.scalars(select(Department).order_by(Department.id)).all()

def dept_get(db: Session, dept_id: int):
    return db.get(Department, dept_id)

def dept_create(db: Session, data: DepartmentCreate):
    obj = Department(name=data.name, note=data.note)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def dept_update(db: Session, obj: Department, data: DepartmentUpdate):
    if data.name is not None:
        obj.name = data.name
    if data.note is not None:
        obj.note = data.note
    db.commit()
    db.refresh(obj)
    return obj

def dept_delete(db: Session, obj: Department):
    db.delete(obj)
    db.commit()

# -------- Employee CRUD --------
def emp_list(db: Session):
    return db.scalars(select(Employee).order_by(Employee.id)).all()

def emp_get(db: Session, emp_id: int):
    return db.get(Employee, emp_id)

def emp_create(db: Session, data: EmployeeCreate):
    obj = Employee(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def emp_update(db: Session, obj: Employee, data: EmployeeUpdate):
    payload = data.model_dump(exclude_unset=True)
    for k, v in payload.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj

def emp_delete(db: Session, obj: Employee):
    db.delete(obj)
    db.commit()
