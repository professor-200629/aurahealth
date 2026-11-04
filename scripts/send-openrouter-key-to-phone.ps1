<#
Save an OpenRouter key in the AuraHealth Android app, so that Talk to Aura and the photo reader use the same Meta Muse Glimmer model
on a much faster paid host. Run it yourself, with the phone on USB (USB debugging on):

  powershell -ExecutionPolicy Bypass -File .\scripts\send-openrouter-key-to-phone.ps1

You paste the key at a hidden prompt. It goes through the USB cable into the app's private storage (debug build only, via "run-as").
It is never printed, never put on the command line and never written to a file on the laptop. To go back to the free NVIDIA key, run
send-key-to-phone.ps1.
#>
$ErrorActionPreference = 'Stop'
$secure = Read-Host 'Paste your OpenRouter key (it starts with sk-or-; nothing shows as you paste)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
if (-not $key.StartsWith('sk-or-')) { throw 'That does not look like an OpenRouter key (it should start with sk-or-). Nothing was saved.' }

$adb = 'C:\platform-tools-latest-windows\platform-tools\adb.exe'
if (-not (Test-Path $adb)) { $adb = (Get-Command adb -ErrorAction Stop).Source }
if (-not ((& $adb devices) -match "`tdevice")) { throw 'No phone found. Connect it over USB and allow USB debugging.' }

# The key travels on standard input, so it never appears in a process list.
$key | & $adb shell "run-as health.aura.app sh -c 'mkdir -p files && cat > files/ai_key.txt && chmod 600 files/ai_key.txt'"
if ($LASTEXITCODE -ne 0) { throw 'The phone refused. Is the AuraHealth debug app installed?' }
$key = $null
Write-Host 'Key saved in the AuraHealth app. Reopen the app and ask a question.'
