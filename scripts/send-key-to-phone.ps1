<#
Copy the NVIDIA key saved on this laptop (NVIDIA_API_KEY, see set-nvidia-key.ps1) into the AuraHealth Android app,
so "Talk to Aura" works from the phone without the laptop. Run it yourself, with the phone on USB (USB debugging on):

  powershell -ExecutionPolicy Bypass -File .\scripts\send-key-to-phone.ps1

The key goes through the USB cable into the app's private storage (debug build only, via "run-as"). It is never
printed, never put on the command line and never written to a file on the laptop.
#>
$ErrorActionPreference = 'Stop'
$key = [Environment]::GetEnvironmentVariable('NVIDIA_API_KEY', 'User')
if (-not $key) { $key = $env:NVIDIA_API_KEY }
if (-not $key) { throw 'No NVIDIA_API_KEY on this laptop. Run scripts\set-nvidia-key.ps1 first.' }

$adb = 'C:\platform-tools-latest-windows\platform-tools\adb.exe'
if (-not (Test-Path $adb)) { $adb = (Get-Command adb -ErrorAction Stop).Source }
if (-not ((& $adb devices) -match "`tdevice")) { throw 'No phone found. Connect it over USB and allow USB debugging.' }

# The key travels on standard input, so it never appears in a process list.
$key.Trim() | & $adb shell "run-as health.aura.app sh -c 'mkdir -p files && cat > files/ai_key.txt && chmod 600 files/ai_key.txt'"
if ($LASTEXITCODE -ne 0) { throw 'The phone refused. Is the AuraHealth debug app installed?' }
$size = (& $adb shell "run-as health.aura.app sh -c 'wc -c < files/ai_key.txt'").Trim()
Write-Host "Key copied to the AuraHealth app on the phone ($size bytes). Open Talk to Aura: it now works without the laptop."
