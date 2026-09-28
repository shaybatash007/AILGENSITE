<#
.SYNOPSIS
  Restore the site files from a snapshot in versions/.

.DESCRIPTION
  Restores content and assets only. It never touches versions/, .git/, .opencode/, node_modules/,
  memory/ or any tooling, so a restore cannot destroy the agent environment. Files present in the
  working tree but absent from the snapshot are reported, not deleted.
#>
[CmdletBinding()]
param([Parameter(Position = 0)][string]$Name, [switch]$List, [switch]$Force)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$base = Join-Path $root "versions"

if ($List -or -not $Name) {
  if (-not (Test-Path -LiteralPath $base)) { Write-Output "no snapshots yet - run: npm run save"; exit 0 }
  Get-ChildItem -LiteralPath $base -Directory | Sort-Object Name -Descending |
    ForEach-Object { "{0}  {1} files  {2}" -f $_.Name, (Get-ChildItem -LiteralPath $_.FullName -Recurse -File).Count, $_.LastWriteTime }
  if (-not $Name) { Write-Output ""; Write-Output "restore with: npm run restore -- <name>"; exit 0 }
}

$src = Join-Path $base $Name
if (-not (Test-Path -LiteralPath $src)) { throw "snapshot '$Name' not found. List them with: npm run restore -- --List" }

$protected = @("versions", ".git", ".opencode", "node_modules", "memory", "scripts")
$skip = @("MANIFEST.sha256")

$files = Get-ChildItem -LiteralPath $src -Recurse -File | Where-Object { $skip -notcontains $_.Name }
$restoreList = @()
$skippedList = @()

foreach ($f in $files) {
  $rel = $f.FullName.Substring($src.Length + 1)
  $top = ($rel -split "[\\/]")[0]
  if ($protected -contains $top) { $skippedList += $rel; continue }
  $target = Join-Path $root $rel
  if ((Test-Path -LiteralPath $target) -and -not $Force) {
    $existing = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
    if ($existing -eq (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash) { continue }
  }
  $restoreList += [pscustomobject]@{ rel = $rel; src = $f.FullName; dst = $target }
}

foreach ($item in $restoreList) {
  $dir = Split-Path -Parent $item.dst
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Copy-Item -LiteralPath $item.src -Destination $item.dst -Force
}

Write-Output "restored $($restoreList.Count) file(s) from versions/$Name"
if ($skippedList.Count) { Write-Output "skipped (protected): $($skippedList.Count) file(s) under $($protected -join ', ')" }
$extra = New-Object System.Collections.ArrayList
Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
  $rel2 = $_.FullName.Substring($root.Length + 1)
  if ($rel2 -match "^(versions|node_modules|\.git)\\" -or $rel2 -like ".opencode\node_modules\*") { return }
  $top2 = ($rel2 -split "[\\/]")[0]
  if ($protected -contains $top2) { return }
  if (-not (Test-Path -LiteralPath (Join-Path $src $rel2))) {
    if ($extra.Count -lt 10) { [void]$extra.Add($rel2) }
  }
}
if ($extra.Count) {
  Write-Output "note: these files exist in the working tree but not in this snapshot and were left untouched:"
  $extra | ForEach-Object { Write-Output "  $_" }
}
