<#
Start AuraHealth (research prototype, simulation only).

  .\start.ps1          this laptop only (http://127.0.0.1:8000)
  .\start.ps1 -Wifi    also let a phone on the same TRUSTED Wi-Fi connect (prints a pairing link)

If Windows blocks scripts, run:  powershell -ExecutionPolicy Bypass -File .\start.ps1 -Wifi
#>
param([switch]$Wifi, [int]$Port = 8000)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

if (-not (Test-Path (Join-Path $root 'frontend\dist\index.html'))) {
    Write-Host 'Building the web app (first run only; needs Node.js and, once, internet for npm install)...'
    Push-Location (Join-Path $root 'frontend')
    try { npm install; npm run build } finally { Pop-Location }
}

try {
    Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null
} catch {
    Write-Host 'Ollama is not running. Start the Ollama app for the Meta model helpers.' -ForegroundColor Yellow
    Write-Host 'The handoff and the emergency button still work without it.' -ForegroundColor Yellow
}

Push-Location (Join-Path $root 'backend')
try {
    if ($Wifi) { uv run aurahealth --lan --port $Port } else { uv run aurahealth --port $Port }
} finally {
    Pop-Location
}
