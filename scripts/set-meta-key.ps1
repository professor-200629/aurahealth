# Save your Meta Model API key for AuraHealth without showing it on screen.
#
# Run this in YOUR OWN PowerShell window (not through an AI assistant):
#   powershell -ExecutionPolicy Bypass -File C:\Users\Balu\Documents\aurahealth\scripts\set-meta-key.ps1
#
# The key is saved as the per-user environment variable MODEL_API_KEY (the name Meta's docs use; PointCaption
# uses the same one). AuraHealth reads it from there. It is never written to the project, logs or the card.

$ErrorActionPreference = "Stop"
$secure = Read-Host -Prompt "Paste your Meta Model API key (it stays hidden), then press Enter" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim()
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
if ($key.Length -lt 20) {
    Write-Host "That does not look like an API key (too short). Nothing was saved." -ForegroundColor Yellow
    exit 1
}

[Environment]::SetEnvironmentVariable("MODEL_API_KEY", $key, "User")
$env:MODEL_API_KEY = $key
Write-Host "Saved MODEL_API_KEY for user $env:USERNAME ($($key.Length) characters)." -ForegroundColor Green

# Free check: list the models this key can use (no tokens are generated, nothing is charged).
try {
    $resp = Invoke-RestMethod -Uri "https://api.meta.ai/v1/models" -Headers @{ Authorization = "Bearer $key" } -TimeoutSec 30
    $ids = @($resp.data | ForEach-Object { $_.id })
    if ($ids -contains "muse-spark-1.3") {
        Write-Host "Key accepted by Meta. muse-spark-1.3 is available. AuraHealth can read medicine strips and reports online." -ForegroundColor Green
    } else {
        Write-Host "Key accepted, but muse-spark-1.3 is not listed. Models you can use: $($ids -join ', ')" -ForegroundColor Yellow
    }
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "Saved, but Meta did not accept it (HTTP $code). Check the key and that your hackathon credit is active." -ForegroundColor Yellow
} finally {
    Remove-Variable key -ErrorAction SilentlyContinue
}
Write-Host "Close this window and restart the AuraHealth server so it sees the key."
