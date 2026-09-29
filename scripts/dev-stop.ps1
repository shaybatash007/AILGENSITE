# Stops the AILGENSITE dev server and frees the port.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\dev-stop.ps1 [-Port 8000]
param([int]$Port = 8000)
$ErrorActionPreference = 'Continue'
$state = Join-Path $env:TEMP 'ailgensite-dev'
$pidFile = Join-Path $state 'serve.pid'

$stopped = @()

# 1. the pid we recorded
if (Test-Path $pidFile) {
    $saved = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($saved) {
        $p = Get-Process -Id ([int]$saved) -ErrorAction SilentlyContinue
        if ($p) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue; $stopped += "PID $($p.Id) (pid file)" }
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
}

# 2. anything still listening on the port (orphaned child, other server, ...)
for ($i = 0; $i -lt 10; $i++) {
    $owner = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
             Select-Object -First 1 -ExpandProperty OwningProcess
    if (-not $owner) { break }
    $p = Get-Process -Id $owner -ErrorAction SilentlyContinue
    if ($p) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue; $stopped += "PID $($p.Id) (port $Port owner)" }
    Start-Sleep -Milliseconds 400
}

Start-Sleep -Milliseconds 500
$left = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($left) {
    "WARN port $Port is still held by PID $($left.OwningProcess)"
    exit 1
}
if ($stopped) { "OK  stopped: " + ($stopped -join ', ') } else { "OK  nothing was running" }
"    port $Port is free"
exit 0
