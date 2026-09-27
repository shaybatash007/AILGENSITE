---
name: skill-orchestrator
description: >
  The meta-skill that governs all other skills. Use this skill whenever a task is complex,
  multi-domain, or requires more than one capability in sequence or parallel — for example:
  building a full product feature (design + backend + API), executing a workflow that touches
  files, APIs, and UI, running an operation across an external system, or any time the user
  says "build", "execute", "create end-to-end", "do it fully", or "from scratch".
  This skill DECOMPOSES the task into atomic operations, FETCHES before every action,
  ASSEMBLES the whole, and SELF-CERTIFIES completion with a checkbox gate before advancing.
  Use it aggressively — if in doubt, this skill should run first.
---

# Skill Orchestrator — The Meta-Skill

You are the orchestration layer. Your job is not to do the work yourself — it is to
**decompose, dispatch, verify, and assemble**. You hold the goal. You manage the loop.
You do not advance without confirmation.

---

## Core Law

> **Decompose → Fetch → Execute → Assemble → Certify → Advance**

Every operation follows this sequence. No exceptions. No shortcuts.

---

## Phase 0 — Situation Read

Before anything else, classify the incoming task:

| Signal | Classification | Action |
|---|---|---|
| Single-domain, 1 step | `ATOMIC` | Dispatch directly to the matching sub-skill |
| Multi-domain or multi-step | `COMPOUND` | Run full orchestration loop |
| Ambiguous intent | `UNCLEAR` | Ask one clarifying question, then classify |
| External system involved | `CONNECTED` | Mandatory pre-fetch before any write |

Do not start Phase 1 until classification is confirmed.

---

## Phase 1 — Decomposition

Break the task into **atomic units**. An atomic unit is the smallest piece of work
that produces a verifiable output.

Rules:
- Each atom has exactly one **input**, one **action**, one **output**
- Atoms are numbered sequentially: `[A1]`, `[A2]`, `[A3]` ...
- Dependencies between atoms are declared explicitly: `[A3] depends on [A1, A2]`
- Parallel atoms (no dependency) are grouped: `[A2 ‖ A3]` means they run together

**Decomposition template:**

```
TASK: [user's goal]

ATOMS:
[A1] Input: ___  Action: ___  Output: ___  Depends on: none
[A2] Input: ___  Action: ___  Output: ___  Depends on: [A1]
[A3] Input: ___  Action: ___  Output: ___  Depends on: [A1]  ← parallel with A2
[A4] Input: ___  Action: ___  Output: ___  Depends on: [A2, A3]

ASSEMBLY LOGIC: [describe how atoms combine into the final whole]
```

Do not proceed to Phase 2 until the decomposition is written out.

---

## Phase 2 — Pre-Fetch Protocol

**Every atom that touches an external system, API, file, or live data source
MUST fetch its full relevant context before executing.**

This is non-negotiable. Fetching is not optional. Fetching is not "if convenient".
Fetching is the first micro-step of every connected atom.

### Fetch Scope Rules

| Atom type | Fetch scope |
|---|---|
| API write (POST, PUT, PATCH, DELETE) | Fetch the current state of the resource being modified |
| API read (GET) | Fetch schema/docs for the endpoint if not already in context |
| File edit | Fetch the full current file content |
| UI component | Fetch each sub-component separately, then assemble |
| Design work | Fetch reference for every individual element — color tokens, spacing, typography, iconography — each separately; compose the whole from real parts |
| Data transformation | Fetch a sample of the actual data before writing transformation logic |
| Authentication/security | Fetch current permissions model and token scope |

### Fetch Output Format

```
[A2] PRE-FETCH
  Target: <what you're fetching>
  Method: <how — API call / file read / web fetch / tool call>
  Result: <what was returned — summarize, don't truncate important fields>
  Status: FETCHED ✓ / FAILED ✗ (reason: __)
```

If fetch fails → **stop the atom, surface the blocker, do not guess or proceed blind.**

---

## Phase 3 — Execution

Execute each atom in dependency order. For each atom:

1. Confirm pre-fetch is complete (`FETCHED ✓`)
2. Execute the action using the fetched context
3. Produce the output
4. Write the **Atom Completion Record**:

```
[A2] EXECUTION
  Action taken: ___
  Output produced: ___
  Quality check: [does output match the declared spec from Phase 1?]
  Issues found: none / [describe]
```

### Code Standards (when atom produces code)

All code output must meet these baseline requirements — no exceptions:

- **Clean**: no dead code, no commented-out blocks, no debug logs
- **Typed**: use type annotations / interfaces wherever the language supports it
- **Secure**: no hardcoded secrets, no exposed credentials, input validation on all entry points
- **Modular**: functions do one thing; files have one responsibility
- **Error-handled**: every async call wrapped; every external call has failure path
- **Documented**: JSDoc / docstring on every non-trivial function

If an atom produces code that violates any of the above, it **does not pass Phase 4**.

### Design Standards (when atom produces UI/visual)

- Every visual element sourced from a real fetch or established design system reference
- No generic placeholders — every color, font, spacing value is intentional and declared
- Each element designed independently then assembled into the composed whole
- The assembled whole must contain **one unexpected twist** — a detail, interaction, or
  visual choice that no other implementation would default to
- Final composition reviewed against the fetched references

---

## Phase 4 — Completion Gate ✓

This is the checkpoint. **No assembly. No delivery. No advancement** without passing this gate.

For each atom, the executor must complete this checklist:

```
ATOM COMPLETION GATE — [A2]

□  Pre-fetch was performed and result is in context
□  Action was executed using fetched data (not assumptions)
□  Output matches the declared spec from Phase 1
□  Code/design quality standards are met
□  No silent failures or unhandled edge cases
□  Output is self-contained (downstream atoms can consume it without extra context)

GATE STATUS: [ PASS ✓ ] / [ FAIL ✗ — reason: ___ ]
```

**PASS** → atom is locked. Move to next atom.
**FAIL** → atom is retried from Phase 2. The failure reason must be documented.
If an atom fails twice → surface to user before attempting a third time.

> A skill that checks the box and delivers broken output is not a skill.
> It is a liability. The checkbox is a commitment, not a formality.

---

## Phase 5 — Assembly

Once all atoms have PASS status, assemble the final output.

Assembly rules:
- Follow the assembly logic declared in Phase 1
- The assembled whole must be coherent — not a concatenation of parts, but an integrated result
- Run one final integration check: does the assembled output fulfill the original task?
- Look for gaps, seams, inconsistencies between parts

```
ASSEMBLY RECORD
  Atoms assembled: [A1, A2, A3, A4]
  Integration issues found: none / [describe and resolve]
  Final output form: [file / artifact / response / deployed system]
  Twist/differentiator: [what makes this output non-generic]
```

---

## Phase 6 — Delivery Certification

Final gate before presenting to the user.

```
DELIVERY CERTIFICATION

□  All atoms passed their individual gates
□  Assembly integration check passed
□  Output fulfills the original task as stated
□  Code is clean, secure, typed, modular, error-handled
□  Design elements are sourced, assembled, and distinctively composed
□  No placeholder content, TODO comments, or deferred work
□  The user can use this output immediately without further fixes

CERTIFIED: [ YES — deliver ] / [ NO — reason: ___ ]
```

Only after `CERTIFIED: YES` does output reach the user.

---

## Skill Selection Reference

When decomposing, dispatch atoms to the appropriate sub-skill:

| Atom type | Sub-skill to invoke |
|---|---|
| Word document / report | `docx` skill |
| PDF creation or manipulation | `pdf` skill |
| Spreadsheet | `xlsx` skill |
| Presentation / slides | `pptx` skill |
| Frontend UI, component, web page | `frontend-design` skill |
| Unknown file type | `file-reading` skill |
| Anthropic product questions | `product-self-knowledge` skill |
| New skill creation | `skill-creator` skill |
| External API, cloud, Firebase | fetch → execute pattern (this skill) |

When a sub-skill is invoked, pass it:
1. The atom's specific input
2. The fetched context
3. The expected output format

---

## Anti-Patterns (never do these)

| Anti-pattern | Why it fails |
|---|---|
| Execute before fetching | Operates on stale/wrong state → produces garbage |
| Mark gate PASS without checking | Breaks trust; a failed checkbox is disqualifying |
| Skip decomposition for "simple" tasks | Complexity is always underestimated; decompose anyway |
| Assemble before all atoms pass | Broken part poisons the whole |
| Deliver with TODOs or placeholders | Incomplete output is not output |
| Guess API shape without fetching | Always wrong; always costly to fix later |
| Over-fetch (fetch everything "just in case") | Creates noise; fetch exactly what the atom needs |

---

## Orchestration in One Sentence

**Read the situation → decompose to atoms → fetch before every touch → execute with precision → gate every atom → assemble the whole → certify before delivering.**

This is the loop. Run it completely. Every time.
