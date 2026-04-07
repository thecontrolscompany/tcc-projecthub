param()

$projectRoot = "c:\Users\TimothyCollins\dev\tcc-projecthub"
$fontDir = "$projectRoot\public\fonts"
$globalsCSS = "$projectRoot\src\app\globals.css"

Write-Host "Fixing Raleway fonts..." -ForegroundColor Cyan

# Create fonts directory
if (-not (Test-Path $fontDir)) {
    New-Item -ItemType Directory -Path $fontDir -Force
}

# Download fonts
$fonts = @("Raleway-Regular.ttf", "Raleway-Medium.ttf", "Raleway-SemiBold.ttf", "Raleway-Bold.ttf")
$base = "https://github.com/google/fonts/raw/main/ofl/raleway"

foreach ($font in $fonts) {
    $url = "$base/$font"
    $out = "$fontDir\$($font.ToLower())"
    Write-Host "Downloading $font..."
    Invoke-WebRequest -Uri $url -OutFile $out -TimeoutSec 60
}

Write-Host "Downloaded fonts." -ForegroundColor Green

# Read CSS
$css = Get-Content $globalsCSS -Raw

# Remove old Raleway font-face blocks
$css = $css -replace '(?s)@font-face\s*\{\s*font-family:\s*"Raleway"[^}]*\}', ''

# Add new font-face blocks
$newFaces = '
@font-face { font-family: "Raleway"; src: url("/fonts/raleway-regular.woff2") format("woff2"), url("/fonts/raleway-regular.ttf") format("truetype"); font-weight: 400; font-display: swap; }
@font-face { font-family: "Raleway"; src: url("/fonts/raleway-medium.woff2") format("woff2"), url("/fonts/raleway-medium.ttf") format("truetype"); font-weight: 500; font-display: swap; }
@font-face { font-family: "Raleway"; src: url("/fonts/raleway-semibold.woff2") format("woff2"), url("/fonts/raleway-semibold.ttf") format("truetype"); font-weight: 600; font-display: swap; }
@font-face { font-family: "Raleway"; src: url("/fonts/raleway-bold.woff2") format("woff2"), url("/fonts/raleway-bold.ttf") format("truetype"); font-weight: 700; font-display: swap; }
'

$css = $css -replace '(:root\s*\{[^}]*\})', "`$1$newFaces"
Set-Content $globalsCSS $css -NoNewline

Write-Host "Updated CSS." -ForegroundColor Green

# Verify files
$found = $true
foreach ($font in $fonts) {
    $path = Join-Path $fontDir ($font.ToLower())
    if (Test-Path $path) {
        Write-Host "OK: $(Split-Path -Leaf $path)"
    } else {
        Write-Host "MISSING: $(Split-Path -Leaf $path)" -ForegroundColor Red
        $found = $false
    }
}

if (-not $found) {
    exit 1
}

# Build
Write-Host "Running npm build..." -ForegroundColor Cyan
Push-Location $projectRoot
npm run build
$buildOk = $LASTEXITCODE -eq 0
Pop-Location

if ($buildOk) {
    Write-Host "SUCCESS" -ForegroundColor Green
    exit 0
} else {
    Write-Host "BUILD FAILED" -ForegroundColor Red
    exit 1
}
