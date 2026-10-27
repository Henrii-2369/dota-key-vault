@echo off
setlocal
chcp 65001 >nul
title DOTA Key Vault
cd /d "%~dp0"
if errorlevel 1 goto bad_folder
set "DOTA_VAULT_NODE="
if exist "%~dp0runtime\node.exe" set "DOTA_VAULT_NODE=%~dp0runtime\node.exe"
if defined DOTA_VAULT_NODE goto start
for %%N in (node.exe) do set "DOTA_VAULT_NODE=%%~$PATH:N"
if defined DOTA_VAULT_NODE goto start
if exist "%ProgramFiles%\nodejs\node.exe" set "DOTA_VAULT_NODE=%ProgramFiles%\nodejs\node.exe"
if defined DOTA_VAULT_NODE goto start
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "DOTA_VAULT_NODE=%ProgramFiles(x86)%\nodejs\node.exe"
if defined DOTA_VAULT_NODE goto start
echo Node.js was not found. Install Node.js 22 or newer from https://nodejs.org/
goto failed

:start
echo Starting DOTA Key Vault...
"%DOTA_VAULT_NODE%" "%~dp0tools\launch.mjs"
if errorlevel 1 goto failed
exit /b 0

:bad_folder
echo Unable to open the project folder.
:failed
echo.
echo Startup failed. See .local\launcher.log for details.
pause
exit /b 1
