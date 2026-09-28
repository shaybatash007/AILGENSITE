<#
.SYNOPSIS
  Snapshot the working site into versions/<timestamp>/ (gitignored, local only).

.DESCRIPTION
  Snapshots are a fast local undo for content and asset work - faster than git for a designer
  handing over a folder of images. versions/ is gitignored and excluded from the snapshot itself.
#>
[CmdletBinding()]
param([string]$Label = "")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$stamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
$dest = Join-Path $root "versions\$stamp$(if ($Label) { "-" + ($Label -replace "[^A-Za-z0-9_-]", "-") })"

New-Item -ItemType Directory -Path $dest -Force | Out-Null

$excludeDirs = @("versions", "node_modules", ".git", ".opencode\node_modules", "versions")
$excludeFiles = @("*.tmp", "*.tmp-*")

$robocopyArgs = @($root, $dest, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:1", "/W:1", "/XD") + $excludeDirs + @("/XF") + $excludeFiles
& robocopy @robocopyArgs | Out-Null
$code = $LASTEXITCODE
if ($code -ge 8) { throw "robocopy failed with exit code $code" }

$manifest = Get-ChildItem -LiteralPath $dest -Recurse -File |
  ForEach-Object { "{0}  {1}" -f $_.FullName.Substring($dest.Length + 1), (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
$manifest | Set-Content -LiteralPath (Join-Path $dest "MANIFEST.sha256") -Encoding UTF8

$count = (Get-ChildItem -LiteralPath $dest -Recurse -File).Count
Write-Output "snapshot: versions/$((Split-Path -Leaf $dest))  ($count files, manifest written)"
Write-Output "restore with: npm run restore -- $stamp"
