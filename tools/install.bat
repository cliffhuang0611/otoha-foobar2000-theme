@echo off
REM Otoha installer launcher.
REM
REM This exists because a .ps1 downloaded from the internet carries Mark-of-the-Web and
REM will silently refuse to run on double-click under the default execution policy.
REM Running it through powershell.exe with -ExecutionPolicy Bypass sidesteps that for
REM this one invocation only -- nothing about your system's policy is changed.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
echo.
pause
