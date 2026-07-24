@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo ยังไม่ได้ติดตั้ง กำลังติดตั้งให้...
    python -m venv .venv
    .venv\Scripts\python.exe -m pip install --upgrade pip
    .venv\Scripts\python.exe -m pip install -r requirements.txt
)

start "" http://127.0.0.1:8756
.venv\Scripts\python.exe server.py

pause
