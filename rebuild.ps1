# Build Hearth & Cellar and copy the fresh exe over EVERY known install
# location, so however you launch the app (Start Menu, taskbar pin, direct
# .exe click) you get the latest build.
#
# Usage:  .\rebuild.ps1                     # build + replace + launch
#         .\rebuild.ps1 -NoLaunch           # build + replace, don't open the app
#
# The first run of this script assumes the NSIS installer has been run once
# so SOME install dir exists. If none of the install paths below exist, run:
#   ${env:LOCALAPPDATA}\Temp\hc-target\release\bundle\nsis\Hearth & Cellar_2.2.0_x64-setup.exe

param(
    [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"
$ProjectRoot = "C:\Users\dtmat\Dropbox\Github Repos\MyMedia\hearth-cellar-project\app"
$TargetDir   = "C:\Users\dtmat\AppData\Local\Temp\hc-target"
$BuiltExe    = "$TargetDir\release\hearth-cellar.exe"

# Single canonical install location. The previous dual-write setup existed
# because the original NSIS install ran inside a Microsoft Store sandbox
# (Claude Code) and put a duplicate under that sandbox's LocalCache. That
# sandboxed copy was deleted on 2026-06-29 and the Start Menu shortcut was
# repointed here, so there's only one install dir now.
$InstallTargets = @(
    "C:\Users\dtmat\AppData\Local\Hearth & Cellar\hearth-cellar.exe",
    "C:\Users\dtmat\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\Hearth & Cellar\hearth-cellar.exe"
)

$anyExists = $false
foreach ($t in $InstallTargets) {
    $dir = Split-Path $t -Parent
    if (Test-Path $dir) { $anyExists = $true; break }
}
if (-not $anyExists) {
    Write-Host "No install dir found. Run the NSIS installer at:" -ForegroundColor Yellow
    Write-Host "  $TargetDir\release\bundle\nsis\Hearth & Cellar_2.2.0_x64-setup.exe" -ForegroundColor Yellow
    exit 1
}

Write-Host "Closing any running Hearth & Cellar..." -ForegroundColor Cyan
Get-Process hearth-cellar -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 600

Write-Host "Building (Tauri release, mingw-safe CARGO_TARGET_DIR)..." -ForegroundColor Cyan
$env:CARGO_TARGET_DIR = $TargetDir
Push-Location $ProjectRoot
try {
    & npx.cmd tauri build
    if ($LASTEXITCODE -ne 0) { throw "Tauri build failed (exit $LASTEXITCODE)" }
} finally {
    Pop-Location
}

if (-not (Test-Path $BuiltExe)) {
    throw "Build finished but expected exe not found at $BuiltExe"
}

$primaryWritten = $null
foreach ($dest in $InstallTargets) {
    $destDir = Split-Path $dest -Parent
    if (Test-Path $destDir) {
        Write-Host "Replacing → $dest" -ForegroundColor Cyan
        Copy-Item -Path $BuiltExe -Destination $dest -Force
        if (-not $primaryWritten) { $primaryWritten = $dest }
    } else {
        Write-Host "Skipping (dir missing) → $destDir" -ForegroundColor DarkGray
    }
}

if (-not $primaryWritten) {
    throw "No install destination was writable."
}

Write-Host "Done. Primary install at $primaryWritten" -ForegroundColor Green

if (-not $NoLaunch) {
    Write-Host "Launching..." -ForegroundColor Cyan
    Start-Process -FilePath $primaryWritten
}
