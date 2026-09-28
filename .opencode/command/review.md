---
description: Adversarial review of the uncommitted diff (or of a path), ranked by likelihood x damage.
agent: oracle
subtask: true
---

Review the current work for failure modes. The diff under review:

!`git diff HEAD`

!`git status --porcelain=v1`

Scope: $ARGUMENTS

If the scope is empty, review everything uncommitted. For each finding give the exact failure
condition, the observable symptom, the file:line, and the cheapest fix — ranked by likelihood times
damage. State which single item you would fix first. Do not fix anything and do not praise the work.
