---
description: Hebrew and RTL quality gate for a page, file or directory. Verbatim copy, honesty labels, bidi correctness.
agent: hebrew-qa
subtask: true
---

Run the Hebrew/RTL quality gate on: $ARGUMENTS

If the argument is empty, audit every `.html` file in the repository that contains Hebrew
characters. Delegate to the `hebrew-qa` subagent and report its findings verbatim, FAIL first.

Do not rewrite the copy in place. List the exact incorrect string and the exact corrected string,
and let the user apply or approve it.
