# Save your free NVIDIA API key (for Meta Muse Glimmer) for AuraHealth without showing it on screen.
#
# Get the key: sign in at https://build.nvidia.com, open the Muse Glimmer model page, click "Get API Key".
# Then run this in YOUR OWN PowerShell window (not through an AI assistant):
#   powershell -ExecutionPolicy Bypass -File C:\Users\Balu\Documents\aurahealth\scripts\set-nvidia-key.ps1
#
# The key is saved as the per-user environment variable NVIDIA_API_KEY. AuraHealth reads it from there. It is never
# written to the project, logs or the card.

$ErrorActionPreference = "Stop"
$secure = Read-Host -Prompt "Paste your NVIDIA API key (it starts with nvapi- and stays hidden), then press Enter" -AsSecureString
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

[Environment]::SetEnvironmentVariable("NVIDIA_API_KEY", $key, "User")
$env:NVIDIA_API_KEY = $key
Write-Host "Saved NVIDIA_API_KEY for user $env:USERNAME ($($key.Length) characters)." -ForegroundColor Green

# One tiny test call (a few tokens, free tier).
try {
    $body = @{ model = "meta/muse-glimmer-30b"; max_tokens = 5; messages = @(@{ role = "user"; content = "Say OK" }) } | ConvertTo-Json -Depth 4
    $resp = Invoke-RestMethod -Method Post -Uri "https://integrate.api.nvidia.com/v1/chat/completions" `
        -Headers @{ Authorization = "Bearer $key" } -ContentType "application/json" -Body $body -TimeoutSec 60
    Write-Host "Key works: Muse Glimmer answered. AuraHealth can use it." -ForegroundColor Green
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "Saved, but the test call failed (HTTP $code). Check the key on build.nvidia.com." -ForegroundColor Yellow
} finally {
    Remove-Variable key -ErrorAction SilentlyContinue
}
Write-Host "Close this window and restart the AuraHealth server so it sees the key."
