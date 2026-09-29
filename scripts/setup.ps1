<#
.SYNOPSIS
  One-time environment setup: install the git commit guard, refresh the handoff, run the doctor.

.DESCRIPTION
  The pre-commit guard lives in .githooks/ (committed, reviewable) instead of .git/hooks/ (local,
  invisible). Activating it means pointing git at core.hooksPath, which is a per-clone git setting.
  Revert with: git config --unset core.hooksPath
#>
[CmdletBinding()]
param([switch]$HooksOnly)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Push-Location $root
try {
  if (Test-Path -LiteralPath (Join-Path $root ".githooks/pre-commit")) {
    & git config core.hooksPath .githooks
    Write-Output "git commit guard: active (core.hooksPath = .githooks)"
    Write-Output "revert with: git config --unset core.hooksPath"
  } else {
    Write-Output "git commit guard: .githooks/pre-commit is missing, nothing installed"
  }
} finally { Pop-Location }

if (-not $HooksOnly) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts/handoff.ps1")
  Write-Output ""
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts/doctor.ps1")
}
