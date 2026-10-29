$ErrorActionPreference = "Stop"
$Project = $PSScriptRoot
Set-Location $Project

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " Birla Diwali Prize - Build New Windows Setup" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is not installed. Install Node.js 22 LTS, reopen PowerShell, and run this script again." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm was not found. Reinstall Node.js with npm and reopen PowerShell." }

Write-Host "Node: $(node --version)"
Write-Host "Installing project dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }

Write-Host "Building Windows NSIS installer..." -ForegroundColor Yellow
npx electron-builder --win nsis --x64
if ($LASTEXITCODE -ne 0) { throw "electron-builder failed with exit code $LASTEXITCODE" }

$Setup = Join-Path $Project "dist\Birla Diwali Prize Setup 3.0.0.exe"
if (-not (Test-Path $Setup)) {
  $Found = Get-ChildItem (Join-Path $Project "dist") -Filter *.exe -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($Found) { $Setup = $Found.FullName }
}
if (Test-Path $Setup) {
  Write-Host "BUILD COMPLETE: $Setup" -ForegroundColor Green
  Get-Item $Setup | Select-Object FullName, Length, LastWriteTime | Format-List
} else {
  Write-Host "Build command finished but installer was not found in dist. Check the errors above." -ForegroundColor Red
  exit 1
}
