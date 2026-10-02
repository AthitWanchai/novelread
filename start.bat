@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo ยังไม่ได้ติดตั้ง กำลังติดตั้งให้...
    python -m venv .venv
    if errorlevel 1 goto failed
)

.venv\Scripts\python.exe -c "import fastapi, uvicorn, httpx, bs4, trafilatura, edge_tts, playwright, google.genai, PIL" >nul 2>&1
if errorlevel 1 (
    echo กำลังติดตั้งส่วนประกอบที่จำเป็น...
    .venv\Scripts\python.exe -m pip install -r requirements.txt
    if errorlevel 1 goto failed
)

start "" http://127.0.0.1:8756
.venv\Scripts\python.exe -X utf8 server.py

pause
exit /b

:failed
echo ติดตั้งไม่สำเร็จ กรุณาติดตั้ง Python 3.10 ขึ้นไปและตรวจการเชื่อมต่ออินเทอร์เน็ต
pause
