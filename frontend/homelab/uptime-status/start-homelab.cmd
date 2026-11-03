@echo off
cd /d "%~dp0"
echo Starting the Homelab dashboard and uptime monitor...
node server.js
echo.
echo The server has stopped. Press any key to close this window.
pause >nul
