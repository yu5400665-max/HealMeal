@echo off
setlocal

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :7860 ^| findstr LISTENING') do (
  taskkill /PID %%a /T /F >nul 2>nul
)

if exist "next-dev-dist" (
  rmdir /s /q "next-dev-dist"
  if exist "next-dev-dist" (
    echo [healmeal] Failed to remove next-dev-dist. Please close running Node/terminal processes and retry.
    exit /b 1
  )
)

next dev -H 0.0.0.0 -p 7860
