# Starts the AILGENSITE static dev server (serve) detached, verifies it is healthy.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\dev.ps1 [-Port 8000]
param(
    [int]$Port = 8000,
    [string]$Addr = '127.0.0.1'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$mainJs = Join-Path $root 'node_modules\serve\build\main.js'
$state = Join-Path $env:TEMP 'ailgensite-dev'
$pidFile = Join-Path $state 'serve.pid'
$outLog = Join-Path $state 'serve.log'
$errLog = Join-Path $state 'serve.err.log'
New-Item -ItemType Directory -Force -Path $state | Out-Null

function Test-Health {
    try {
        $r = Invoke-WebRequest -Uri "http://${Addr}:${Port}/" -UseBasicParsing -TimeoutSec 4
        return ($r.StatusCode -eq 200 -and $r.Content.Length -gt 0)
    } catch { return $false }
}

function Get-PortOwner {
    (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty OwningProcess)
}

# already running and healthy?
if (Get-PortOwner) {
    if (Test-Health) {
        "OK  server already running on http://${Addr}:${Port}"
        exit 0
    }
    "Port $Port is held by an unresponsive process - killing it..."
    Get-PortOwner | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 800
}

if (-not (Test-Path $mainJs)) {
    "serve is not installed yet - running npm install..."
    Push-Location $root
    npm install | Out-Null
    Pop-Location
    if (-not (Test-Path $mainJs)) { throw "npm install failed: $mainJs not found" }
}

# stale pid file from a previous run
Remove-Item $pidFile -ErrorAction SilentlyContinue

$proc = Start-Process -FilePath 'node' `
    -ArgumentList @($mainJs, '-l', "tcp://${Addr}:${Port}", '--no-clipboard', '--no-port-switching', $root) `
    -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardOutput $outLog -RedirectStandardError $errLog `
    -PassThru
$proc.Id | Out-File -FilePath $pidFile -Encoding ascii

# wait for a real response (max ~15s)
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Health) { $ok = $true; break }
    if ($proc.HasExited) { break }
}

if ($ok) {
    "OK  AILGENSITE dev server running"
    "    URL   http://${Addr}:${Port}"
    "    PID   $($proc.Id)"
    "    LOG   $outLog"
    exit 0
}

"FAIL server did not become healthy on port $Port"
if ($proc.HasExited) { "     node exited with code $($proc.ExitCode)" }
if (Test-Path $errLog) { Get-Content $errLog -Tail 20 | ForEach-Object { "     $_" } }
try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
exit 1
