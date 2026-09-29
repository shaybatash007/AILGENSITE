---
description: Health-check the whole agent environment — config, memory budgets, commit attribution, Hebrew copy integrity, terminal and RTL. Fix what is safe to fix.
agent: build
---

Run the environment doctor and act on it.

!`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\doctor.ps1`

1. Read the report. For every FAIL, diagnose the cause from the file it names and fix it if the fix
   is unambiguous and reversible. Read the file before editing it.
2. For every WARN, state in one line whether it is a real problem or an accepted trade-off. Do not
   silence a warning by weakening the check that produced it.
3. Re-run `scripts/doctor.ps1` and confirm the FAIL list is empty. Report the exact result.
4. If the terminal report says BROKEN, the Hebrew text direction cannot be fixed from configuration:
   the TUI paints per cell and has no bidi. Give the user the one command that gives correct
   rendering today (`npm run web`, the browser interface) and say plainly that the TUI needs an
   upstream fix.

Finish with: one line naming what is now healthy, one line naming what is still failing.
Never report a clean result you did not read in the tool output.
