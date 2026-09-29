---
description: Verify a claim end-to-end — run the real check, read the output, report the actual result.
agent: build
---

Verify: $ARGUMENTS

1. Identify the check that actually proves the claim. For a site or asset change that means
   loading it, not grepping for a string. For a script change that means running it. For config
   that means starting opencode and confirming it does not hard-fail.
2. Run it and read the full output. Use an explicit `timeout` in milliseconds for anything that
   can hang.
3. Report the literal result: what passed, what failed, and the exact error text if any. Never
   paraphrase a failure as a success.
4. Fix what failed, then re-verify. Repeat until it actually passes.
5. Clean up: stop background servers you started, remove temp files from the repo. Use
   `C:\Users\shayb\AppData\Local\Temp\opencode` for scratch.
6. Finish with one line stating what is now verified, and one line naming anything still
   unverified.

Never report success on an unverified claim. If it could not be verified, say so plainly.
