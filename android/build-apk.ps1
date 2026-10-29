<#
Build the AuraHealth Android app (debug APK) and, if a phone is connected over USB, install it.

  powershell -ExecutionPolicy Bypass -File .\android\build-apk.ps1

Needs Android Studio installed (its Java and SDK are used). The web app is built and bundled into the APK, so
first aid and the night guard work on the phone with no laptop and no internet.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'

Push-Location (Join-Path $root 'frontend')
try { npm run build } finally { Pop-Location }

$web = Join-Path $PSScriptRoot 'app\src\main\assets\web'
if (Test-Path $web) { Remove-Item -Recurse -Force $web }
New-Item -ItemType Directory -Force $web | Out-Null
Copy-Item -Recurse (Join-Path $root 'frontend\dist\*') $web

$gradle = Get-ChildItem "$env:USERPROFILE\.gradle\wrapper\dists\gradle-9.3.1-bin\*\gradle-9.3.1\bin\gradle.bat" | Select-Object -First 1
if (-not $gradle) { throw 'Gradle 9.3.1 not found. Open the android folder once in Android Studio to download it.' }
Push-Location $PSScriptRoot
try { & $gradle.FullName --no-daemon assembleDebug } finally { Pop-Location }

$apk = Join-Path $PSScriptRoot 'app\build\outputs\apk\debug\app-debug.apk'
Write-Host "APK: $apk"
$adb = Get-Command adb -ErrorAction SilentlyContinue
if ($adb -and ((& adb devices) -match "`tdevice")) { & adb install -r $apk }
