from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import Employee
from ..schemas import EmployeeCreate, EmployeeUpdate

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
