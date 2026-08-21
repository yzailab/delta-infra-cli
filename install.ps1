# Copyright (c) 2026 Delta Infra Authors
# SPDX-License-Identifier: MIT
#
# Install delta-cli on Windows.
#
# Behavior:
#   - If npm is available -> install the @delta-infra/cli npm package (preferred).
#   - Otherwise            -> pure PowerShell + curl download from GitHub Release
#                             with mirror fallback (no Node.js/npm required).
#
# Usage:
#   .\install.ps1                     # default install dir
#   .\install.ps1 -InstallDir "$env:USERPROFILE\bin"
#   $env:DELTA_CLI_VERSION = "1.0.95"; .\install.ps1   # pin a version
#
# Env overrides (same semantics as scripts/install.js):
#   DELTA_CLI_VERSION        pin version (default: latest GitHub release)
#   DELTA_CLI_MIRROR         force a single mirror (full-URL-prefix format)

[CmdletBinding()]
param(
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\delta-cli"
)

$Repo = "yzailab/delta-infra-cli"
$BinName = "delta-cli"
$ArchiveBase = "delta-cli-windows-"

# Mirror prefix format matches scripts/install.js: https://<mirror>/https://github.com/...
$Mirrors = @(
    "https://gh.ddlc.top"
    "https://ghproxy.net"
    "https://gh-proxy.com"
)

function Write-Step { param([string]$Msg) Write-Host "[delta-cli] $Msg" }
function Write-Err  { param([string]$Msg) Write-Host "[delta-cli] ERROR: $Msg" -ForegroundColor Red }

# ── 1. Prefer npm when available ────────────────────────────────────────────
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $Package = "@delta-infra/cli"
    $Registries = @(
        "https://registry.npmmirror.com"
        "https://registry.npmjs.org"
    )
    foreach ($Registry in $Registries) {
        Write-Step "Detected npm; installing $Package from $Registry..."
        npm install -g $Package --registry=$Registry
        if ($LASTEXITCODE -eq 0) {
            Write-Step "Installed successfully from $Registry"
            exit 0
        }
        Write-Step "Failed, trying next registry..."
    }
    # npm failed everywhere -> fall through to the pure download path below.
    Write-Step "npm install failed; falling back to direct binary download."
}
else {
    Write-Step "npm not found; using direct binary download (no Node.js required)."
}

# ── 2. Resolve architecture ─────────────────────────────────────────────────
$Arch = switch ($env:PROCESSOR_ARCHITECTURE) {
    "AMD64" { "amd64" }
    "ARM64" { "arm64" }
    "x86"   { "386" }
    default { "amd64" }
}

# ── 3. Resolve version ──────────────────────────────────────────────────────
$Version = $env:DELTA_CLI_VERSION
if (-not $Version) {
    Write-Step "Resolving latest version from GitHub..."
    try {
        $latestJson = curl.exe -sS --connect-timeout 10 --max-time 30 "https://api.github.com/repos/$Repo/releases/latest"
        $m = [regex]::Match($latestJson, '"tag_name"\s*:\s*"v?([^"]+)"')
        if ($m.Success) { $Version = $m.Groups[1].Value }
    } catch {
        $Version = $null
    }
    if (-not $Version) {
        Write-Err "Could not resolve latest version (network issue?). Set DELTA_CLI_VERSION to pin one."
        exit 1
    }
}
$Version = $Version.TrimStart('v')

# ── 4. Build download URLs (mirrors first, then GitHub) ─────────────────────
$ArchiveName = "$ArchiveBase$Arch.zip"
$RelPath = "releases/download/v$Version/$ArchiveName"
$GithubUrl = "https://github.com/$Repo/$RelPath"
$Urls = New-Object System.Collections.Generic.List[string]
foreach ($mirror in $Mirrors) {
    $Urls.Add("$mirror/https://github.com/$Repo/$RelPath")
}
$Urls.Add($GithubUrl)
# Env override forces a single mirror first (full-URL-prefix format).
if ($env:DELTA_CLI_MIRROR) {
    $Urls.Insert(0, ($env:DELTA_CLI_MIRROR.TrimEnd('/') + "/https://github.com/$Repo/$RelPath"))
}

# ── 5. Download + verify ────────────────────────────────────────────────────
$TmpDir = Join-Path $env:TEMP ("delta-cli-install-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null
$ArchivePath = Join-Path $TmpDir $ArchiveName

$Downloaded = $false
foreach ($url in $Urls) {
    Write-Step "Downloading from $url"
    & curl.exe -fSL --connect-timeout 10 --max-time 120 --speed-limit 50000 --speed-time 10 --output $ArchivePath $url 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $ArchivePath)) {
        $Downloaded = $true
        break
    }
    Write-Step "Failed, trying next source..."
    Remove-Item $ArchivePath -Force -ErrorAction SilentlyContinue
}
if (-not $Downloaded) {
    Write-Err "Failed to download delta-cli from all sources."
    Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

# ── 6. Verify SHA-256 against checksums.txt ─────────────────────────────────
# checksums.txt lives alongside the release; try mirrors (full-prefix) first.
$ChecksumPath = Join-Path $TmpDir "checksums.txt"
Write-Step "Verifying SHA-256 checksum..."
$ChecksumFetched = $false
$ChecksumUrls = New-Object System.Collections.Generic.List[string]
foreach ($mirror in $Mirrors) {
    $ChecksumUrls.Add("$mirror/https://github.com/$Repo/releases/download/v$Version/checksums.txt")
}
$ChecksumUrls.Add("https://github.com/$Repo/releases/download/v$Version/checksums.txt")
foreach ($cu in $ChecksumUrls) {
    & curl.exe -fSL --connect-timeout 10 --max-time 30 --output $ChecksumPath $cu 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $ChecksumPath)) {
        $ChecksumFetched = $true
        break
    }
    Remove-Item $ChecksumPath -Force -ErrorAction SilentlyContinue
}
if ($ChecksumFetched) {
    $Expected = $null
    foreach ($line in (Get-Content $ChecksumPath)) {
        $parts = $line -split '\s+', 2
        if ($parts.Count -ne 2) { continue }
        $hash = $parts[0]
        $name = $parts[1].TrimStart('*').Trim()
        if ($hash -match '^[a-fA-F0-9]{64}$' -and $name -eq $ArchiveName) {
            $Expected = $hash
            break
        }
    }
    if ($Expected) {
        $Actual = (Get-FileHash $ArchivePath -Algorithm SHA256).Hash
        if ($Actual -ieq $Expected) {
            Write-Step "Checksum verified."
        } else {
            Write-Err "Checksum mismatch! expected $Expected, got $Actual"
            Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
            exit 1
        }
    } else {
        Write-Step "[WARN] No checksum entry for $ArchiveName; skipping verification."
    }
} else {
    Write-Step "[WARN] Could not fetch checksums.txt; skipping verification."
}

# ── 7. Extract ──────────────────────────────────────────────────────────────
Write-Step "Extracting archive..."
try {
    # .NET ZipFile first (no external dependency), then Expand-Archive fallback
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($ArchivePath, $TmpDir)
}
catch {
    Expand-Archive -LiteralPath $ArchivePath -DestinationPath $TmpDir -Force
}

# ── 8. Locate the binary and install ────────────────────────────────────────
# Inside the archive the binary may be delta-cli-<platform>-<arch>.exe
# (current format) or delta-cli.exe (older format).
$CandidateNames = @("$BinName-windows-$Arch.exe", "$BinName.exe")
$ExtractedExe = $null
foreach ($cand in $CandidateNames) {
    $candPath = Join-Path $TmpDir $cand
    if (Test-Path $candPath) {
        $ExtractedExe = Get-Item $candPath
        break
    }
}
if (-not $ExtractedExe) {
    $ExtractedExe = Get-ChildItem -Path $TmpDir -Recurse -Filter *.exe -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "$BinName*" } | Select-Object -First 1
}
if (-not $ExtractedExe) {
    Write-Err "Binary not found in extracted archive."
    Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue
    exit 1
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$ExePath = Join-Path $InstallDir "$BinName.exe"
Copy-Item $ExtractedExe.FullName $ExePath -Force
Remove-Item $TmpDir -Recurse -Force -ErrorAction SilentlyContinue

# ── 9. Add to user PATH if not present ──────────────────────────────────────
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
    Write-Step "Added $InstallDir to user PATH."
    Write-Step "Restart your terminal to use '$BinName'."
} else {
    Write-Step "$InstallDir is already in user PATH."
}

Write-Step "Installed successfully: $ExePath"
$env:Path += ";$InstallDir"
& $ExePath --version
exit 0
