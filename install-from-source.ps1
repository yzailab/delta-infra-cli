#!/usr/bin/env pwsh
# Install delta-cli from the current source tree on Windows.
# Usage (run from repository root):
#   .\install-from-source.ps1
# Or with a custom install directory:
#   .\install-from-source.ps1 -InstallDir "$env:USERPROFILE\bin"

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\delta-cli"
)

$RepoRoot = $PSScriptRoot
$MainPackage = "github.com/delta-infra/delta-infra-cli"

# Validate repository layout
if (-not (Test-Path "$RepoRoot\cmd\delta-cli\main.go") -or
    -not (Test-Path "$RepoRoot\go.mod")) {
    Write-Error "This script must be run from the delta-infra-cli repository root."
    exit 1
}

# Validate Go toolchain
if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Error "Go is not installed or not in PATH. Please install Go 1.23+ first."
    exit 1
}

# Determine version metadata
$Version = (git -C $RepoRoot describe --tags --always --dirty 2>$null)
if (-not $Version) { $Version = "dev" }
$Commit = (git -C $RepoRoot rev-parse --short HEAD 2>$null)
if (-not $Commit) { $Commit = "unknown" }
$Date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")

$Ldf = "-X $MainPackage/internal/build.Version=$Version " +
       "-X $MainPackage/internal/build.Commit=$Commit " +
       "-X $MainPackage/internal/build.Date=$Date"

Write-Host "[delta-cli] Building delta-cli from source..."
Write-Host "  version : $Version"
Write-Host "  commit  : $Commit"
Write-Host "  output  : $InstallDir\delta-cli.exe"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$ExePath = "$InstallDir\delta-cli.exe"
$Source = "$RepoRoot\cmd\delta-cli"

$Proc = Start-Process go -ArgumentList "build", "-ldflags", $Ldf, "-o", $ExePath, $Source `
    -NoNewWindow -Wait -PassThru
if ($Proc.ExitCode -ne 0) {
    Write-Error "Build failed."
    exit 1
}

# Add to user PATH if not already present
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$UserPath;$InstallDir",
        "User"
    )
    Write-Host "[delta-cli] Added $InstallDir to user PATH."
    Write-Host "[delta-cli] Restart your terminal to use 'delta-cli'."
} else {
    Write-Host "[delta-cli] $InstallDir is already in user PATH."
}

Write-Host "[delta-cli] Installed successfully: $ExePath"
