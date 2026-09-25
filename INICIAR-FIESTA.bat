@echo off
setlocal
cd /d "%~dp0"
title Fiesta - Instalacion e inicio
if not exist ".runtime" mkdir ".runtime"
where node >nul 2>nul
if not errorlevel 1 (
 node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
 if not errorlevel 1 goto ready
)
if exist ".runtime\node\node.exe" (
 ".runtime\node\node.exe" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
 if not errorlevel 1 goto portable
)
echo Descargando Node.js oficial. No se modifica la instalacion del sistema.
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $arch='x64'; if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') {$arch='arm64'}; if (-not [Environment]::Is64BitOperatingSystem) {throw 'Se requiere Windows de 64 bits'}; $base='https://nodejs.org/download/release/latest-v22.x/'; $manifest=(Invoke-WebRequest -UseBasicParsing ($base+'SHASUMS256.txt')).Content; $pattern='(?m)^([a-f0-9]{64})\s+(node-v22\.[0-9]+\.[0-9]+-win-'+$arch+'\.zip)\s*$'; $match=[regex]::Match($manifest,$pattern); if (-not $match.Success) {throw 'No se encontro el paquete oficial'}; $zip=Join-Path $PWD '.runtime\node.zip'; Invoke-WebRequest -UseBasicParsing ($base+$match.Groups[2].Value) -OutFile $zip; if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLower() -ne $match.Groups[1].Value) {Remove-Item $zip; throw 'La verificacion SHA256 fallo'}; $extract=Join-Path $PWD '.runtime\extract'; if (Test-Path $extract) {Remove-Item $extract -Recurse -Force}; Expand-Archive $zip -DestinationPath $extract; $folder=Join-Path $extract ($match.Groups[2].Value -replace '\.zip$',''); $dest=Join-Path $PWD '.runtime\node'; if (Test-Path $dest) {Remove-Item $dest -Recurse -Force}; Move-Item $folder $dest; Remove-Item $zip; Remove-Item $extract -Recurse -Force"
if errorlevel 1 goto error
:portable
set "PATH=%~dp0.runtime\node;%PATH%"
:ready
node scripts/launch.mjs
if errorlevel 1 goto error
echo Programa detenido.
pause
exit /b 0
:error
echo.
echo No se pudo iniciar Fiesta. El error permanece visible arriba.
echo Si el programa genero un registro, revisa la carpeta .logs.
pause
exit /b 1
