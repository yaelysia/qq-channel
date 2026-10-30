@echo off
setlocal EnableExtensions
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" (
  echo [A1B] Required vswhere.exe missing
  exit /b 1
)
for /f "delims=" %%V in ('call "%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath') do set "VS_ROOT=%%V"
if not defined VS_ROOT (
  echo [A1B] VS2022 C++ Build Tools unavailable
  exit /b 1
)
call "%VS_ROOT%\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 exit /b 1
where cl.exe
node ci\build-win22.mjs
exit /b %ERRORLEVEL%
