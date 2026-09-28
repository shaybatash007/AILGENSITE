---
description: Rotate and re-stamp the memory layer. Use when a memory file outgrows its digest budget or two entries contradict.
agent: archivist
subtask: true
---

Maintain the memory layer for: $ARGUMENTS

If the argument is empty, run the full rotation pass. Delegate to the `archivist` subagent, then
report: character counts before and after per memory file, the new digest elision percentage, and
any contradiction that was resolved and how.
