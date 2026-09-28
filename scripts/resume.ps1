<#
.SYNOPSIS
  Deterministic session-resume report. The model interprets this; it does not go fetch it.

.DESCRIPTION
  Emits the handoff note, the git facts, the auto-state block and the open questions in one
  machine-readable block, plus a STALE verdict when memory/SESSION.md disagrees with the working
  tree. Output is ASCII-only on purpose (a CP862 console cannot render Hebrew).
#>
[CmdletBinding()]
param([switch]$Json)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

function Read-Utf8([string]$p) { if (Test-Path -LiteralPath $p) { return [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8) } return $null }

$sess = Read-Utf8 (Join-Path $root "memory/SESSION.md")
$core = Read-Utf8 (Join-Path $root "memory/CORE.md")

Push-Location $root
try {
  $head = (& git rev-parse --short HEAD 2>$null)
  $branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
  $log = @(& git log --oneline -10 2>$null)
  $status = @(& git status --porcelain=v1 2>$null)
} finally { Pop-Location }

$stale = @()
$blockHead = $null
if ($sess) {
  $i = $sess.IndexOf("<!-- ailgen:auto:start -->")
  $j = $sess.IndexOf("<!-- ailgen:auto:end -->")
  if ($i -ge 0 -and $j -gt $i) {
    $block = $sess.Substring($i, $j - $i)
    if ($block -match "@ ([0-9a-f]{7,})") { $blockHead = $Matches[1] }
    if ($block -match "^- refreshed: (.+)$", "Multiline") {
      $age = [int]((Get-Date).ToUniversalTime() - [datetime]::Parse($Matches[1]).ToUniversalTime()).TotalMinutes
      if ($age -gt 60) { $stale += "auto-state is $age min old" }
    }
  } else { $stale += "no plugin-generated state block in SESSION.md" }
} else { $stale += "memory/SESSION.md is missing" }

if ($blockHead -and $head -and $blockHead -ne $head) { $stale += "SESSION.md records HEAD $blockHead, git is at $head" }
$tracked = @($status | Where-Object { $_ -notmatch "^\?\? (memory/|scripts/|\.githooks/|\.opencode/|opencode\.json|AGENTS\.md|CLAUDE\.md|package)" })
if ($tracked.Count -gt 0) { $stale += "working tree has $($tracked.Count) changed tracked file(s) the handoff does not mention" }

if ($Json) {
  [pscustomobject]@{
    head = $head; branch = $branch
    status = @($status); log = @($log)
    stale = @($stale)
    session = $sess
  } | ConvertTo-Json -Depth 4
  exit 0
}

Write-Output "=== AILGEN RESUME (deterministic) ==="
Write-Output "branch $branch @ $head"
Write-Output ""
Write-Output "--- git log --oneline -10 ---"
$log | ForEach-Object { Write-Output $_ }
Write-Output ""
Write-Output "--- git status --short ---"
if ($status.Count) { $status | ForEach-Object { Write-Output $_ } } else { Write-Output "(clean)" }
Write-Output ""
if ($core) { Write-Output "--- memory/CORE.md (invariants, non-negotiable) ---"; Write-Output $core; Write-Output "" }
if ($sess) {
  Write-Output "--- memory/SESSION.md (handoff note) ---"
  $k = $sess.IndexOf("<!-- ailgen:auto:start -->")
  $m = $sess.IndexOf("<!-- ailgen:auto:end -->")
  if ($k -ge 0 -and $m -gt $k) { Write-Output $sess.Substring(0, $k).TrimEnd() } else { Write-Output $sess }
  if ($k -ge 0 -and $m -gt $k) { Write-Output ""; Write-Output $sess.Substring($k, $m - $k + 24) }
}
Write-Output ""
if ($stale.Count -gt 0) {
  Write-Output "VERDICT: STALE - memory/SESSION.md has drifted from the working tree:"
  $stale | ForEach-Object { Write-Output "  - $_" }
  Write-Output "The working tree is the truth. Say so in one line, then rewrite memory/SESSION.md to match."
} else {
  Write-Output "VERDICT: FRESH - the handoff matches the working tree. Read the 'Exact next command' section and run it."
}
exit 0
