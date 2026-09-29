# DECISIONS — architectural decisions that must not be re-litigated

Append-only, newest last. Superseded or now-enforced entries were rotated to
`memory/DECISIONS-ARCHIVE.md` on 2026-09-28/29, keeping their original stamps and an
"Enforced by" pointer. 18 archived: read it before re-litigating an older subject. `/archive`.

---

## [2026-09-29 | Space Bunny Free] Decision: opencode's canonical path spelling is FORWARD slashes, and the migration wrote them backwards

Decision: the canonical form for a Windows path in `opencode.db` is `C:/Users/shayb/...`, not
`C:\Users\shayb\...`. `tools/canonicalize-paths.mjs` normalises to forward slashes, and
`tools/migrate-home.mjs` is the tool that introduced the wrong spelling.

Why: measured on `opencode.db.bak_1790663969179`, the pre-migration database, which opencode itself
had written over days: `project.worktree`, `project_directory.directory` and all 14 sessions were
`C:/mastercoding/AILGENSITE`. The `Videos` session, also written by opencode, was
`C:/Users/shayb/Videos`. Every session opencode created after the move is forward-slash too. The
backslashes appeared only after `migrate-home.mjs` ran. The migration's intent was right and its
spelling was wrong, so it rewrote 14 rows into a form opencode does not recognise, added a second
`project_directory` row instead of updating the existing one, and left the Web UI with a project
that resolved to no sessions. The premise of the first `canonicalize-paths.mjs` - "native Windows
form means backslashes" - was the exact inverse of the truth.

Consequences: the correct repair is the reverse direction. After the fix, 15 sessions share one
string (`C:/Users/shayb/projects/AILGENSITE`), the duplicate `project_directory` row is gone, and
`GET /api/session?directory=C:/Users/shayb/projects/AILGENSITE` returns all 15. The Web UI still
renders "Nothing here yet" - that is the client-side binding bug archived on 2026-09-28, and
repairing the data did not fix it. Any tool that writes a path into this database must copy
opencode's spelling, not Windows'.

## [2026-09-29 | Space Bunny Free] Decision: a database tool rehearses on a copy and proves non-destruction before it opens the real file for writing

Decision: `tools/canonicalize-paths.mjs` runs its exact transformation against a `VACUUM INTO` copy
first, and refuses to touch the live file unless the copy produced the expected result. A
row-count invariant runs over every table, and only a dedupe declared per table may lose a row.

Why: the first version of this tool destroyed 14 sessions, 675 messages and 2,825 parts. Its
dedupe step was `DELETE FROM session WHERE directory = ? AND directory != ?` - the second predicate
excludes exactly what the first one selects, so it was true for every row it matched and it deleted
the entire non-canonical spelling. The `UPDATE` that followed matched zero rows and reported
success. The run that was mid-write then started throwing `Failed query: insert into "part"`, which
is how the loss was finally noticed, several sessions later. Three things would each have caught it
and none were there: no rehearsal, no row-count assertion, and a dedupe predicate that was never
executed against a fixture.

Consequences: the rehearsal is not optional decoration - it is what makes the live write safe to
attempt, and it also caught a wrong `canon()` in the rewritten version, before it reached the real
database. A 24-check fixture at `tools/test-canonicalize.mjs` (`npm run test:canon`) reproduces the
live database's exact shape, including the duplicate `project_directory` row and a path-in-primary-key
collision that must be refused. The general rule: a tool that writes to a store holding irreplaceable
history gets a copy, an assertion, and a fixture, in that order. Recovery, when it is needed, is
additive - `INSERT OR IGNORE` from a pre-deletion snapshot, which is how the 14 sessions were
restored from `~/.local/share/opencode/backups/opencode-2026-09-29T06-47-55-166Z.db` — the opencode
data directory, NOT the repo, which has no `backups/`.
