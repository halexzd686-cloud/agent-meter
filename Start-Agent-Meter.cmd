@echo off
setlocal
if exist "%~dp0dist\win-unpacked\Agent Meter.exe" (
  start "" "%~dp0dist\win-unpacked\Agent Meter.exe"
  exit /b 0
)
echo No current build found. Run npm run pack, or install the matching GitHub Release.
exit /b 1
