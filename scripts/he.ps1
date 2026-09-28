<#
.SYNOPSIS
  Launch opencode where Hebrew actually renders: Windows Terminal, UTF-8, Unicode font.

.DESCRIPTION
  Honest diagnosis, because the fix is not where people expect it:

  * Windows Terminal + a Unicode font fixes *encoding* and *font coverage*, and fixes bidi for any
    app that emits plain text (a browser, an editor, `cat`).
  * It does NOT fix the opencode TUI. The TUI paints each cell itself and implements no bidi
    algorithm, so Hebrew is laid out in logical order and the glyphs appear reversed. There is no
    configuration that changes this; it is an upstream limitation of the TUI renderer.

  For correct Hebrew today, use the browser interface: `npm run web`. Browsers implement the
  Unicode bidi algorithm, so both your input and the model's answers render right-to-left.

.PARAMETER Web
  Skip the terminal launch and start the browser interface instead.

.PARAMETER PatchTerminal
  Back up and patch %LOCALAPPDATA%\Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json
  to set profiles.defaults.font.face to Consolas. Off by default; it writes outside the repo.
#>
[CmdletBinding()]
param([switch]$Web, [switch]$PatchTerminal)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$fontCandidates = @("CascadiaMono.ttf", "CascadiaCode.ttf", "consola.ttf")

if ($PatchTerminal) {
  $state = Join-Path $env:LOCALAPPDATA "Packages\Microsoft.WindowsTerminal_8wekyb3d8bbwe\LocalState\settings.json"
  if (-not (Test-Path -LiteralPath $state)) { Write-Output "Windows Terminal settings.json not found at $state" }
  else {
    $font = $fontCandidates | Where-Object { Test-Path (Join-Path $env:WINDIR "Fonts\$_") } | Select-Object -First 1
    if (-not $font) { Write-Output "no Unicode monospace font found; leaving settings.json untouched" }
    else {
      $backup = "$state.ailgen-backup"
      if (-not (Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $state -Destination $backup }
      $json = [System.IO.File]::ReadAllText($state, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
      if (-not $json.profiles) { $json | Add-Member -NotePropertyName profiles -NotePropertyValue ([pscustomobject]@{}) }
      if (-not $json.profiles.defaults) { $json.profiles | Add-Member -NotePropertyName defaults -NotePropertyValue ([pscustomobject]@{}) }
      if (-not $json.profiles.defaults.font) { $json.profiles.defaults | Add-Member -NotePropertyName font -NotePropertyValue ([pscustomobject]@{}) }
      $face = [System.IO.Path]::GetFileNameWithoutExtension($font)
      $json.profiles.defaults.font | Add-Member -NotePropertyName face -NotePropertyValue $face -Force
      [System.IO.File]::WriteAllText($state, ($json | ConvertTo-Json -Depth 20), (New-Object System.Text.UTF8Encoding($false)))
      Write-Output "Windows Terminal font set to $face. Backup: $backup"
      Write-Output "Revert: Copy-Item `"$backup`" `"$state`" -Force"
    }
  }
}

if ($Web) {
  Write-Output "starting the browser interface - this is where Hebrew renders correctly"
  Push-Location $root
  try { & opencode web --hostname 127.0.0.1 --port 4096 } finally { Pop-Location }
  exit 0
}

if ($env:WT_SESSION) {
  Write-Output "already inside Windows Terminal (WT_SESSION=$env:WT_SESSION)"
  Write-Output "code page: $(chcp)"
  Write-Output "If Hebrew still renders left-to-right here, that is the TUI, not the terminal: use 'npm run web'."
  exit 0
}

$wt = Get-Command wt.exe -ErrorAction SilentlyContinue
if (-not $wt) {
  Write-Output "Windows Terminal is not installed. Install it, or use the browser interface: npm run web"
  exit 1
}

Push-Location $root
try {
  # chcp 65001 in the new tab so the console is UTF-8 before opencode starts.
  & wt.exe -d $root new-tab --title "AILGEN" cmd /k "chcp 65001 >nul && opencode"
  Write-Output "launched opencode in Windows Terminal (UTF-8)."
  Write-Output "For correct Hebrew input and output, use 'npm run web' - the browser interface implements bidi, the TUI does not."
} finally { Pop-Location }
