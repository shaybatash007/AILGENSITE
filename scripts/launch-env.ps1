<#
.SYNOPSIS
  One-click AILGEN development environment.

.DESCRIPTION
  Starts everything the studio needs, in the right order, exactly once, and
  leaves nothing orphaned when it is closed.

  Services:
    * dev server   127.0.0.1:8000   static site
    * opencode web 127.0.0.1:4096   the browser interface (Hebrew renders)

  It is idempotent: running it twice does not create a second server, and it
  adopts servers that are already healthy. Stop with -Stop.

.PARAMETER Stop
  Stop only the processes this script owns. Never touches anything else.

.PARAMETER NoBrowser
  Start the services but do not open a browser.

.PARAMETER Port
  Dev server port. Default 8000.

.PARAMETER WebPort
  opencode web port. Default 4096.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\launch-env.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\launch-env.ps1 -Stop
#>
[CmdletBinding()]
param(
  [switch]$Stop,
  [switch]$NoBrowser,
  [switch]$NoTerminal,
  [int]$Port = 8000,
  [int]$WebPort = 4096
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $root '.launch'
$logDir = Join-Path $stateDir 'logs'

function Write-Step($msg) { Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Bad($msg) { Write-Host "  !!  $msg" -ForegroundColor Red }

function Get-PortOwner([int]$p) {
  try {
    $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop |
      Select-Object -First 1
    if ($c) { return $c.OwningProcess }
  } catch { }
  return $null
}

function Test-HttpOk([string]$url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 4
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500)
  } catch { return $false }
}

function Get-TrackedPids {
  $f = Join-Path $stateDir 'pids.json'
  if (-not (Test-Path $f)) { return @() }
  try { return @((Get-Content $f -Raw | ConvertFrom-Json).pids) } catch { return @() }
}

function Save-TrackedPids([int[]]$pids) {
  New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
  @{ pids = $pids; at = (Get-Date).ToString('o') } |
    ConvertTo-Json | Set-Content (Join-Path $stateDir 'pids.json') -Encoding utf8
}

# ---------------------------------------------------------------- stop ----
if ($Stop) {
  Write-Host "Stopping AILGEN environment" -ForegroundColor Yellow
  $pids = Get-TrackedPids
  # Also sweep anything still holding our two ports, so a crashed run does not
  # leave a listener behind that blocks the next launch.
  foreach ($p in @($pids) + (Get-PortOwner $Port) + (Get-PortOwner $WebPort)) {
    if (-not $p) { continue }
    try {
      Stop-Process -Id $p -Force -ErrorAction Stop
      Write-Ok "stopped pid $p"
    } catch { }
  }
  if (Test-Path $stateDir) { Remove-Item $stateDir -Recurse -Force -ErrorAction SilentlyContinue }
  Write-Host "Environment stopped." -ForegroundColor Yellow
  exit 0
}

Write-Host ""
Write-Host "  AILGEN Dev Suite" -ForegroundColor White
Write-Host "  $($root)" -ForegroundColor DarkGray
Write-Host ""

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$started = @()

# Every child MUST have its stdout and stderr redirected to a file.
# A Start-Process child that inherits this script's console handles keeps the
# parent's stdout pipe open, so the caller (npm, CI, an agent's bash tool)
# blocks forever waiting for output that will never close. Redirecting every
# handle is what makes this script return immediately instead of hanging.
function Start-Detached {
  param([string]$File, [string[]]$ArgList, [string]$Tag, [string]$WorkDir = $root)
  $o = Join-Path $logDir "$Tag.out.log"
  $e = Join-Path $logDir "$Tag.err.log"
  $p = Start-Process -FilePath $File -ArgumentList $ArgList -WorkingDirectory $WorkDir `
    -WindowStyle Hidden -RedirectStandardOutput $o -RedirectStandardError $e -PassThru
  return $p
}

# ------------------------------------------------------- dev server 8000 --
$devOwner = Get-PortOwner $Port
if ($devOwner) {
  if (Test-HttpOk "http://127.0.0.1:$Port/") {
    Write-Ok "dev server already healthy on $Port (pid $devOwner)"
    $started += $devOwner
  } else {
    Write-Bad "port $Port is busy but not serving (pid $devOwner) - stopping it"
    Stop-Process -Id $devOwner -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 800
  }
}
if (-not (Get-PortOwner $Port)) {
  Write-Step "starting dev server on $Port"
  $p = Start-Detached -File 'npx.cmd' -Tag 'serve' `
    -ArgList @('serve', '-l', "tcp://127.0.0.1:$Port", '--no-clipboard', '.')
  $started += $p.Id
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Milliseconds 400
    if (Test-HttpOk "http://127.0.0.1:$Port/") { break }
  }
  if (Test-HttpOk "http://127.0.0.1:$Port/") { Write-Ok "dev server up (pid $($p.Id))" }
  else { Write-Bad "dev server did not come up - see $logDir\serve.err.log" }
}

# --------------------------------------------------------- web ui 4096 ----
$webOwner = Get-PortOwner $WebPort
if ($webOwner) {
  if (Test-HttpOk "http://127.0.0.1:$WebPort/") {
    Write-Ok "opencode web already healthy on $WebPort (pid $webOwner)"
    $started += $webOwner
  } else {
    Write-Bad "port $WebPort is busy but not serving (pid $webOwner) - stopping it"
    Stop-Process -Id $webOwner -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 800
  }
}
if (-not (Get-PortOwner $WebPort)) {
  Write-Step "starting opencode web on $WebPort"
  # Run it from the repo root: the server resolves its project from its own
  # working directory, so this is what binds it to this repository.
  $p = Start-Detached -File 'opencode.cmd' -Tag 'web' `
    -ArgList @('web', '--hostname', '127.0.0.1', '--port', "$WebPort")
  $started += $p.Id
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-HttpOk "http://127.0.0.1:$WebPort/") { break }
  }
  if (Test-HttpOk "http://127.0.0.1:$WebPort/") { Write-Ok "opencode web up (pid $($p.Id))" }
  else { Write-Bad "opencode web did not come up - see $logDir\web.err.log" }
}

Save-TrackedPids (@($started | Where-Object { $_ } | Select-Object -Unique))

# ------------------------------------------------------------ terminal ----
# UTF-8 first, then the TUI in the repo. chcp 65001 must run before opencode
# starts or the console renders mojibake for every Hebrew glyph.
if (-not $NoTerminal) {
  $wt = Get-Command wt.exe -ErrorAction SilentlyContinue
  if ($wt) {
    Write-Step "opening Windows Terminal (UTF-8) in $root"
    Start-Detached -File $wt.Source -Tag 'wt' `
      -ArgList @('-d', $root, 'new-tab', '--title', 'AILGEN', 'cmd', '/k', 'chcp 65001 >nul && opencode') | Out-Null
    Write-Ok "terminal open"
  } else {
    Write-Bad "wt.exe not found - skipped the terminal"
  }
}

# ------------------------------------------------------------- browser ----
if (-not $NoBrowser) {
  $url = "http://127.0.0.1:$WebPort/"
  Write-Step "opening $url"
  try { Start-Detached -File $url -Tag 'browser' -ArgList @() | Out-Null; Write-Ok "browser open" }
  catch { Write-Bad "could not open a browser automatically" }
}

Write-Host ""
Write-Host "  dev server : http://127.0.0.1:$Port/" -ForegroundColor DarkGray
Write-Host "  web ui     : http://127.0.0.1:$WebPort/" -ForegroundColor DarkGray
Write-Host "  logs       : .launch\logs\" -ForegroundColor DarkGray
Write-Host "  stop with  : scripts\launch-env.ps1 -Stop" -ForegroundColor DarkGray
Write-Host ""
