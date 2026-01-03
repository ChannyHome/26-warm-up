@echo off
cd /d %~dp0

if not exist .venv (
  py -3.12 -m venv .venv
)

call .venv\Scripts\activate

pip install -r requirements.txt

if not exist .env (
  copy .env.example .env
)

python -m uvicorn app.main:app --host 0.0.0.0 --port 8500 --reload
