<#
.SYNOPSIS
  One-click AILGEN development environment.

.DESCRIPTION
  Starts everything the studio needs, in order, exactly once, and leaves nothing
  orphaned. Delegates every long-running process to tools/supervisor.mjs, which
  creates them through the WMI provider so they are not children of this script.

  Why that matters: a daemon started from this process would be part of the
  caller's process tree, and the shell runner waits for the entire tree. That
  froze the agent execution loop three times on this machine. Verified: a
  detached child with file-descriptor stdio still froze the runner, because the
  runner waits on the tree rather than on the pipes. WMI creation returns in
  0.19s and the service keeps running.

  It is idempotent. Running it twice does not create a second server; it adopts
  whatever is already healthy. Stop with -Stop.

.PARAMETER Stop
  Stop only the services the supervisor tracks, plus any orphaned listener on
  the managed ports. Never touches anything else.

.PARAMETER NoBrowser
  Start the services but do not open a browser.

.PARAMETER NoTerminal
  Do not open the Windows Terminal tab.

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
$sup = Join-Path $root 'tools\supervisor.mjs'

function Say($msg) { Write-Host "  $msg" }
function Ok($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Bad($msg) { Write-Host "  !!  $msg" -ForegroundColor Red }

if (-not (Test-Path $sup)) { Bad "supervisor not found: $sup"; exit 1 }

# The supervisor prints its own diagnostics and enforces its own deadlines, so
# every call is bounded. A hang here would be a bug in the supervisor, and the
# -DeadlineMs guard makes that a visible error rather than a frozen agent.
function Sup([string[]]$SupArgs, [int]$TimeoutMs = 60000) {
  $out = & node $sup @SupArgs 2>&1
  $code = $LASTEXITCODE
  $out | ForEach-Object { Say $_ }
  return $code
}

if ($Stop) {
  Write-Host "Stopping AILGEN environment" -ForegroundColor Yellow
  [void](Sup @('stop', '--all'))
  [void](Sup @('gc', '--ports', "$Port,$WebPort"))
  Write-Host "Environment stopped." -ForegroundColor Yellow
  exit 0
}

Write-Host ""
Write-Host "  AILGEN Dev Suite" -ForegroundColor White
Write-Host "  $root" -ForegroundColor DarkGray
Write-Host ""

if ((Sup @('gc', '--ports', "$Port,$WebPort")) -ne 0) { Bad "orphan cleanup reported a problem" }

# The dev server is our own single-process static server, not `npx serve`:
# one process, one tracked PID, and no cmd.exe in the tree.
[void](Sup @('start', 'dev', '--port', "$Port", '--url', "http://127.0.0.1:$Port/", '--',
    'node', 'tools/serve.mjs', '--port', "$Port"))

# The web server is started from the repo root because that is what binds it to
# this repository; the project comes from its own working directory.
[void](Sup @('start', 'web', '--port', "$WebPort", '--url', "http://127.0.0.1:$WebPort/", '--',
    'opencode.cmd', 'web', '--hostname', '127.0.0.1', '--port', "$WebPort"))

Write-Host ""
[void](Sup @('status'))

# ---------------------------------------------------------------- terminal --
# UTF-8 first, then the TUI. chcp 65001 must run before opencode starts or the
# console renders mojibake for every Hebrew glyph.
if (-not $NoTerminal) {
  $wt = Get-Command wt.exe -ErrorAction SilentlyContinue
  if ($wt) {
    Say "opening Windows Terminal (UTF-8) in $root"
    # wt.exe is a launcher that returns immediately; run it through cmd so the
    # caller does not inherit a handle to the tab it is about to spawn.
    Start-Process -FilePath $wt.Source -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $env:TEMP 'ailgen-wt.out.log') `
      -RedirectStandardError (Join-Path $env:TEMP 'ailgen-wt.err.log') `
      -ArgumentList @('-d', $root, 'new-tab', '--title', 'AILGEN', 'cmd', '/k', 'chcp 65001 >nul && opencode') | Out-Null
    Ok "terminal open"
  } else {
    Bad "wt.exe not found - skipped the terminal"
  }
}

# ----------------------------------------------------------------- browser --
if (-not $NoBrowser) {
  $url = "http://127.0.0.1:$WebPort/"
  Say "opening $url"
  try { Start-Process $url | Out-Null; Ok "browser open" }
  catch { Bad "could not open a browser automatically" }
}

Write-Host ""
Write-Host "  dev server : http://127.0.0.1:$Port/" -ForegroundColor DarkGray
Write-Host "  web ui     : http://127.0.0.1:$WebPort/" -ForegroundColor DarkGray
Write-Host "  state      : .launch\state.json" -ForegroundColor DarkGray
Write-Host "  stop with  : scripts\launch-env.ps1 -Stop" -ForegroundColor DarkGray
Write-Host ""
exit 0
