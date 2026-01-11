import sys
import os
from pathlib import Path
import logging
import logging.handlers

# backend 폴더를 경로에 추가 (디버거 실행 + 모듈 실행 모두 지원)
backend_path = str(Path(__file__).parent.parent)
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# 로깅 설정
log_dir = os.path.join(backend_path, "..", "logs")
os.makedirs(log_dir, exist_ok=True)

# 로거 설정
logger = logging.getLogger("uvicorn.access")
logger.setLevel(logging.INFO)

# 기존 핸들러 제거 (중복 방지)
logger.handlers.clear()

# 파일 로거 추가
file_handler = logging.handlers.RotatingFileHandler(
    os.path.join(log_dir, "api.log"),
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5,
    encoding="utf-8"
)
file_formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
file_handler.setFormatter(file_formatter)
logger.addHandler(file_handler)

from fastapi import FastAPI, Depends, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.db import Base, engine, get_db
from .routers import default_router, departments_router, employees_router

# 개발 편의: 테이블 없으면 자동 생성 (init.sql로 이미 만들면 그냥 통과)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Company Backend (DB CRUD)",
    docs_url="/docs",
    openapi_url="/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(default_router)
app.include_router(departments_router)
app.include_router(employees_router)

if __name__ == "__main__":
    import uvicorn
    print("\n🚀 서버 시작 중...")
    print("📝 API 문서: http://localhost:8500/api/docs")
    print("⏹️  종료: Ctrl+C 또는 VS Code 디버거의 Stop 버튼\n")
    
    try:
        uvicorn.run(
            app, 
            host="0.0.0.0", 
            port=8500, 
            reload=False,  # 디버거에서는 reload 비활성화
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n✓ 서버가 종료되었습니다.")
