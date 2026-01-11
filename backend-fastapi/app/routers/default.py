from fastapi import APIRouter
from ..config import APP_NAME,ENV
router = APIRouter()

@router.get("/health")
def health():
    return {"ok": True}

@router.get("/ping")
def ping():
    return {"pong": True}

@router.get("/version")
def version():
    return {"app": APP_NAME, "env": ENV, "version": "0.1.0"}
