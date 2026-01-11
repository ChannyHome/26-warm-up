from sqlalchemy.orm import Session
from sqlalchemy import select
from ..models import Department
from ..schemas import DepartmentCreate, DepartmentUpdate

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

