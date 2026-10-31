param([Parameter(Mandatory = $true)][string]$ImagePath)
# Windows' built-in text recognition (Windows.Media.Ocr): offline, no download. Prints one JSON object with each
# recognised line and its box in pixels. Used by ocr.py; never sends anything anywhere.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$type) {
    $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
    $task.Wait() | Out-Null
    $task.Result
}
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('en-US'))
if ($null -eq $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }
if ($null -eq $engine) { '{"error": "no_ocr_language"}'; exit 0 }
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$lines = @(foreach ($line in $result.Lines) {
    $r = @($line.Words | ForEach-Object { $_.BoundingRect })
    $x = ($r | Measure-Object -Property X -Minimum).Minimum
    $y = ($r | Measure-Object -Property Y -Minimum).Minimum
    $right = ($r | ForEach-Object { $_.X + $_.Width } | Measure-Object -Maximum).Maximum
    $bottom = ($r | ForEach-Object { $_.Y + $_.Height } | Measure-Object -Maximum).Maximum
    [ordered]@{ text = $line.Text; x = [int]$x; y = [int]$y; w = [int]($right - $x); h = [int]($bottom - $y) }
})
$stream.Dispose()
[ordered]@{ language = $engine.RecognizerLanguage.LanguageTag; lines = $lines } | ConvertTo-Json -Depth 4 -Compress
