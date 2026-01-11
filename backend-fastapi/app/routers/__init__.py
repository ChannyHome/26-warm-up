from .default import router as default_router
from .departments import router as departments_router
from .employees import router as employees_router

__all__ = ["default_router", "departments_router", "employees_router"]
