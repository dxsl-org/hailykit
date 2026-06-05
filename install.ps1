<#
.SYNOPSIS
  hailykit installer for Windows — no npm or account required.
.DESCRIPTION
  Bootstraps the compiled hailykit CLI, then (best-effort) installs the skill
  catalog for the chosen provider via the CLI.
.EXAMPLE
  irm https://raw.githubusercontent.com/dxsl-org/hailykit/main/install.ps1 | iex
.EXAMPLE
  ./install.ps1 -Provider cursor -Version v0.1.0
#>
[CmdletBinding()]
param(
  [string]$Version = "latest",
  [string]$Provider = "claude",
  [switch]$Project,
  [switch]$NoVenv,
  [switch]$NoCatalog
)

$ErrorActionPreference = "Stop"

$GithubApi  = "https://api.github.com"
$GithubBase = "https://github.com"
$Repo       = "dxsl-org/hailykit"
$Home_      = if ($env:HAILYKIT_HOME) { $env:HAILYKIT_HOME } else { Join-Path $env:USERPROFILE ".hailykit" }
$BinDir     = if ($env:HAILYKIT_BIN)  { $env:HAILYKIT_BIN }  else { Join-Path $env:USERPROFILE ".local\bin" }
$ApiHeaders = @{ "User-Agent" = "hailykit-installer"; Accept = "application/vnd.github+json" }

function Die($msg) { Write-Error "x $msg"; exit 1 }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Die "Node.js >=20 is required. Install from https://nodejs.org"
}

# ── Fetch release metadata ──────────────────────────────────────────────────
Write-Host "Fetching hailykit release ($Version)..."
$url = if ($Version -eq "latest") {
  "$GithubApi/repos/$Repo/releases/latest"
} else {
  "$GithubApi/repos/$Repo/releases/tags/$Version"
}
$release = Invoke-RestMethod -Uri $url -Headers $ApiHeaders
$tagName = $release.tag_name
if (-not $tagName) { Die "Could not parse tag name from release API response" }

$asset = $release.assets | Where-Object { $_.name -eq "hailykit.zip" } | Select-Object -First 1
$downloadUrl = if ($asset) { $asset.browser_download_url } else { "$GithubBase/$Repo/archive/refs/tags/$tagName.zip" }

# ── Download & extract ──────────────────────────────────────────────────────
$tmp = Join-Path $env:TEMP ("hailykit-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
try {
  $zip = Join-Path $tmp "hailykit.zip"
  Write-Host "  Downloading $tagName..."
  Invoke-WebRequest -Uri $downloadUrl -OutFile $zip -Headers $ApiHeaders

  Write-Host "  Extracting..."
  $extracted = Join-Path $tmp "extracted"
  Expand-Archive -Force -LiteralPath $zip -DestinationPath $extracted

  # Locate the dir that actually contains dist/ (archives may nest one level).
  if (-not (Test-Path (Join-Path $extracted "dist"))) {
    $inner = Get-ChildItem -Path $extracted -Directory -Recurse -Depth 1 |
      Where-Object { Test-Path (Join-Path $_.FullName "dist") } | Select-Object -First 1
    if (-not $inner) { Die "Release archive does not contain a built dist/ directory" }
    $extracted = $inner.FullName
  }
  if (-not (Test-Path (Join-Path $extracted "dist\bin.js"))) {
    Die "Release archive is missing dist/bin.js"
  }

  # ── Install the CLI ─────────────────────────────────────────────────────
  Write-Host "  Installing CLI to $Home_..."
  New-Item -ItemType Directory -Path $Home_ -Force | Out-Null
  $distDest = Join-Path $Home_ "dist"
  if (Test-Path $distDest) { Remove-Item -Recurse -Force $distDest }
  Copy-Item -Recurse (Join-Path $extracted "dist") $distDest
  $pkg = Join-Path $extracted "package.json"
  if (Test-Path $pkg) { Copy-Item $pkg (Join-Path $Home_ "package.json") -Force }

  New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
  $binJs = Join-Path $Home_ "dist\bin.js"
  # A .cmd shim so `hailykit` works from any shell on PATH.
  "@node `"$binJs`" %*" | Set-Content -Encoding ASCII -Path (Join-Path $BinDir "hailykit.cmd")

  # ── Install the skill catalog via the CLI (best-effort) ──────────────────
  if (-not $NoCatalog) {
    Write-Host ""
    Write-Host "  Installing skill catalog (provider: $Provider)..."
    $cliArgs = @("$binJs", "install", "--provider", $Provider, "--version", $tagName)
    if ($Project) { $cliArgs += "--project" }
    if ($NoVenv)  { $cliArgs += "--no-venv" }
    try {
      & node @cliArgs
      # Native exits don't throw in PS 5.1; check the exit code explicitly.
      if ($LASTEXITCODE -ne 0) { throw "catalog install exited $LASTEXITCODE" }
    } catch {
      Write-Host "  (catalog install skipped — run 'hailykit install' once a catalog release is available)"
    }
  }

  Write-Host ""
  Write-Host "OK hailykit $tagName installed"

  $pathEntries = ($env:PATH -split ';') | ForEach-Object { $_.TrimEnd('\') }
  if ($pathEntries -inotcontains $BinDir.TrimEnd('\')) {
    Write-Host ""
    Write-Host "  Add $BinDir to your PATH to use the hailykit command:"
    Write-Host "    `$env:PATH += `";$BinDir`""
  }
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
