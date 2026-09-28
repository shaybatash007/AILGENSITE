<#
.SYNOPSIS
  AILGEN doctor - deterministic health check for the agent environment.

.DESCRIPTION
  Everything here is a fact a script can measure, so no model has to guess it: config validity,
  memory-file budgets, handoff freshness, commit attribution, Hebrew copy integrity, terminal/RTL
  diagnosis. Output is deliberately ASCII-only, because a CP862 console cannot render Hebrew.

  Exit code is 0 when there is no FAIL. WARN does not fail the run, so an agent can call this
  cheaply. Use -Json for machine-readable output.
#>
[CmdletBinding()]
param([switch]$Json, [int]$StaleMinutes = 30)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$problems = New-Object System.Collections.ArrayList
$warns = New-Object System.Collections.ArrayList
$notes = New-Object System.Collections.ArrayList

function Read-Utf8([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}

function Chars([string]$s) { return $s.Length }

# --- 1. config ---------------------------------------------------------------------------
$cfgPath = Join-Path $root "opencode.json"
$cfgText = Read-Utf8 $cfgPath
$cfg = $null
if (-not $cfgText) {
  [void]$problems.Add("opencode.json missing at $cfgPath")
} else {
  try { $cfg = $cfgText | ConvertFrom-Json } catch { [void]$problems.Add("opencode.json is not valid JSON: $($_.Exception.Message)") }
}

if ($cfg) {
  $checks = @(
    @{ name = "tool_output.max_lines >= 400"; ok = ($cfg.tool_output.max_lines -ge 400) }
    @{ name = "tool_output.max_bytes >= 24000"; ok = ($cfg.tool_output.max_bytes -ge 24000) }
    @{ name = "compaction.auto"; ok = ($cfg.compaction.auto -eq $true) }
    @{ name = "compaction.prune"; ok = ($cfg.compaction.prune -eq $true) }
    @{ name = "instructions includes AGENTS.md"; ok = ($cfg.instructions -contains "AGENTS.md") }
    @{ name = "instructions includes memory/CORE.md"; ok = ($cfg.instructions -contains "memory/CORE.md") }
    @{ name = "permission.doom_loop = ask"; ok = ($cfg.permission.doom_loop -eq "ask") }
  )
  foreach ($c in $checks) { if (-not $c.ok) { [void]$warns.Add("config floor missing: " + $c.name + " (the plugin re-asserts it at runtime)") } }

  $bashKeys = @($cfg.permission.bash.PSObject.Properties.Name)
  $mustAsk = @("git push*", "git commit*", "rm *", "npm publish*")
  foreach ($p in $mustAsk) { if ($bashKeys -notcontains $p) { [void]$warns.Add("permission.bash has no '$p': ask rule") } }
  $extKeys = @($cfg.permission.external_directory.PSObject.Properties.Name)
  foreach ($p in @("~/.ssh/**", "~/.aws/**", "~/.config/opencode/auth.json")) {
    if ($extKeys -notcontains $p) { [void]$warns.Add("permission.external_directory is missing the deny for $p") }
  }
  # opencode evaluates the LAST matching rule, so a trailing "*": "allow" would void every ask rule.
  $last = $bashKeys[-1]
  if ($last -eq "*") { [void]$problems.Add('permission.bash: "*" is the last key, so it overrides every ask rule. Move broad rules first.') }
}

# --- 2. memory files ---------------------------------------------------------------------
$budgets = @{
  "memory/CORE.md"       = 3000
  "memory/DECISIONS.md"  = 4000
  "memory/ENVIRONMENT.md" = 2400
  "memory/SESSION.md"    = 2600
}
$memReport = @()
foreach ($rel in @("memory/CORE.md", "memory/DECISIONS.md", "memory/ENVIRONMENT.md", "memory/SESSION.md")) {
  $text = Read-Utf8 (Join-Path $root $rel)
  if ($null -eq $text) { [void]$problems.Add("missing memory file: $rel"); continue }
  $len = Chars $text
  $budget = $budgets[$rel]
  $elided = [Math]::Max(0, $len - $budget)
  $memReport += [pscustomobject]@{ file = $rel; chars = $len; digestBudget = $budget; elidedChars = $elided; injected = if ($elided -gt 0) { "$($len - $elided)" } else { "$len" } }
  if ($len -gt $budget * 3) { [void]$warns.Add("$rel is $len chars, over 3x its $budget digest budget - rotate it into memory/DECISIONS-ARCHIVE.md") }

  if ($text -match "\uFFFD") { [void]$problems.Add("$rel contains U+FFFD (replacement char): Hebrew text is corrupted by an encoding round-trip") }
  $marks = [regex]::Matches($text, "[\u200E\u200F\u202A-\u202E\u2066-\u2069]")
  if ($marks.Count -gt 0) { [void]$warns.Add("$rel contains $($marks.Count) bidi control mark(s): they can flip rendering when the file is read by a terminal or a different editor") }
}
foreach ($rel in @("AGENTS.md", "CLAUDE.md")) {
  $text = Read-Utf8 (Join-Path $root $rel)
  if ($null -eq $text) { [void]$warns.Add("missing instruction file: $rel"); continue }
  if ($text -match "\uFFFD") { [void]$problems.Add("$rel contains U+FFFD: Hebrew copy is corrupted") }
}

# --- 3. handoff freshness ---------------------------------------------------------------
$sessPath = Join-Path $root "memory/SESSION.md"
$sess = Read-Utf8 $sessPath
$stateBlock = $null
if ($sess) {
  foreach ($section in @("Goal reached", "Current state", "Exact next command", "Open questions")) {
    if ($sess -notmatch [regex]::Escape($section)) { [void]$warns.Add("memory/SESSION.md has no '$section' section") }
  }
  if ($sess -notmatch "Last updated: \d{4}-\d{2}-\d{2} \| ") { [void]$warns.Add("memory/SESSION.md 'Last updated' line has no '[date | Model]' stamp") }

  $startIdx = $sess.IndexOf("<!-- ailgen:auto:start -->")
  $endIdx = $sess.IndexOf("<!-- ailgen:auto:end -->")
  if ($startIdx -ge 0 -and $endIdx -gt $startIdx) {
    $stateBlock = $sess.Substring($startIdx, $endIdx - $startIdx)
    if ($stateBlock -match "^- refreshed: (.+)$", "Multiline") {
      $ts = [datetime]::Parse($Matches[1]).ToUniversalTime()
      $ageMin = [int]((Get-Date).ToUniversalTime() - $ts).TotalMinutes
      if ($ageMin -gt $StaleMinutes) { [void]$warns.Add("SESSION.md auto-state is $ageMin min old (limit $StaleMinutes). Run npm run handoff, or call a tool so the plugin refreshes it.") }
    }
    if ($stateBlock -match "^- model: unknown") { [void]$warns.Add("SESSION.md auto-state has no model attribution yet") }
  } else {
    [void]$warns.Add("memory/SESSION.md has no plugin-generated state block; the handoff is model-asserted and can drift from git")
  }
}

# --- 4. git facts + commit attribution ---------------------------------------------------
Push-Location $root
try {
  $head = (& git rev-parse --short HEAD 2>$null)
  $branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
  $status = @(& git status --porcelain=v1 2>$null)
  $unstamped = @()
  $subjects = @(& git log --format=%s -n 20 2>$null)
  foreach ($s in $subjects) { if ($s -notmatch "^\[Model: [^\]]+\]") { $unstamped += $s } }
  $ahead = (& git rev-list --count "@{u}..HEAD" 2>$null)
  if ($LASTEXITCODE -ne 0) { $ahead = $null }
} finally { Pop-Location }

if ($stateBlock -and $head -and $stateBlock -match "@ ([0-9a-f]{7,})") {
  if ($Matches[1] -ne $head) { [void]$warns.Add("SESSION.md auto-state records HEAD $($Matches[1]) but git is at $head - a commit landed without a handoff refresh") }
}

$recentUnstamped = @($unstamped | Select-Object -First 5)
if ($recentUnstamped.Count -gt 0) {
  [void]$warns.Add("$($unstamped.Count) of the last $($subjects.Count) commits have no [Model: ...] stamp (newest offenders: $($recentUnstamped -join ' | '))")
}

$hookPath = Join-Path $root ".githooks/pre-commit"
$hookState = if (Test-Path -LiteralPath $hookPath) {
  $configured = (& git config --get core.hooksPath 2>$null)
  if ($configured -eq ".githooks") { "installed" } else { "present but NOT active (git config core.hooksPath = '$configured')" }
} else { "absent" }
if ($hookState -ne "installed") { [void]$warns.Add("the [Model: ...] commit guard is $hookState. Fix: npm run setup") }

# --- 5. terminal / Hebrew RTL ------------------------------------------------------------
$host1 = $Host.Name
$isWt = [bool]$env:WT_SESSION
$codepage = (chcp) -replace "[^\d]", ""
$rtl = if ($isWt) { "OK: Windows Terminal with a Unicode font" }
elseif ($host1 -eq "ConsoleHost") { "BROKEN: legacy conhost (Host=ConsoleHost, no WT_SESSION) does no Unicode bidi. Hebrew renders left-to-right. Fix: npm run he" }
else { "UNKNOWN host '$host1' - verify Hebrew visually; fix: npm run he" }
if ($codepage -and [int]$codepage -ne 65001 -and -not $isWt) { [void]$warns.Add("console code page is $codepage, not 65001 (UTF-8): Hebrew glyphs may be substituted. Fix: npm run he") }

# --- report ------------------------------------------------------------------------------
$result = if ($problems.Count -gt 0) { "FAIL" } elseif ($warns.Count -gt 0) { "WARN" } else { "PASS" }

if ($Json) {
  [pscustomobject]@{
    result = $result
    head = $head
    branch = $branch
    changed = @($status).Count
    unpushed = $ahead
    memory = $memReport
    commitGuard = $hookState
    terminal = [pscustomobject]@{ host = $host1; windowsTerminal = $isWt; codePage = $codepage; rtl = $rtl }
    problems = @($problems)
    warnings = @($warns)
  } | ConvertTo-Json -Depth 5
} else {
  Write-Output "AILGEN doctor: $result"
  Write-Output "git: $branch @ $head | changed: $(@($status).Count) | unpushed: $ahead | commit guard: $hookState"
  Write-Output ""
  Write-Output "memory files (chars / digest budget / actually injected):"
  foreach ($m in $memReport) { Write-Output ("  {0,-24} {1,6} / {2,5} -> {3,6}" -f $m.file, $m.chars, $m.digestBudget, $m.injected) }
  Write-Output ""
  Write-Output "terminal: $rtl (code page $codepage)"
  foreach ($n in $notes) { Write-Output "note: $n" }
  foreach ($w in $warns) { Write-Output "WARN  $w" }
  foreach ($p in $problems) { Write-Output "FAIL  $p" }
  if ($warns.Count -eq 0 -and $problems.Count -eq 0) { Write-Output "clean: no problems found" }
}

if ($problems.Count -gt 0) { exit 1 }
exit 0
