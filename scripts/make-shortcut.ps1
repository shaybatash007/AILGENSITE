# Create the one-click desktop shortcut for the AILGEN dev suite.
# The real desktop is OneDrive-redirected, so it is read from the shell folder
# API rather than assumed to be C:\Users\shayb\Desktop (which does not exist).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $root 'scripts\launch-env.ps1'
$desktop = [Environment]::GetFolderPath('Desktop')
$link = Join-Path $desktop 'AILGEN-Dev-Suite.lnk'

if (-not (Test-Path $script)) { throw "launcher not found: $script" }
New-Item -ItemType Directory -Force -Path $desktop | Out-Null

$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($link)
$sc.TargetPath = (Get-Command powershell.exe).Source
$sc.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$sc.WorkingDirectory = $root
$sc.Description = 'AILGEN dev suite: dev server :8000, opencode web :4096, UTF-8 terminal'
$sc.IconLocation = "$env:SystemRoot\System32\imageres.dll,15"
# Open in a normal window so the supervisor's own output is visible: a silent
# failure here is exactly the class of problem this environment keeps hitting.
$sc.WindowStyle = 1
$sc.Save()

Write-Host "shortcut: $link"
Write-Host "target  : powershell -File `"$script`""
Write-Host "verified: $(Test-Path $link)"
