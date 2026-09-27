# Gate Failure & Recovery Reference

This reference is loaded when an atom fails its completion gate.
The gate is not a formality. A failed gate is a real event that requires a real response.

---

## Gate Failure Classification

When an atom fails its gate, classify the failure before taking action:

| Failure type | Indicator | Recovery path |
|---|---|---|
| `FETCH_INCOMPLETE` | Action was based on assumptions, not fetched data | Return to Phase 2, re-fetch |
| `OUTPUT_MISMATCH` | Output doesn't match Phase 1 spec | Revise execution; if spec was wrong, update spec first |
| `QUALITY_VIOLATION` | Code/design doesn't meet standards | Fix specific violations, re-run gate |
| `INTEGRATION_BREAK` | Output is incompatible with dependent atoms | Re-examine dependency chain |
| `SILENT_FAILURE` | External call appeared to succeed but didn't | Add confirmation fetch, surface to user |
| `SPEC_AMBIGUITY` | Phase 1 spec was underspecified | Clarify spec, update decomposition, re-execute |

---

## Recovery Protocol

### First failure — attempt recovery internally

```
1. Document the failure type and specific reason
2. Do NOT advance to the next atom
3. Return to the earliest phase that caused the failure
4. Re-execute with the failure reason explicitly addressed
5. Re-run the complete gate checklist
6. If gate passes → lock atom, continue
7. If gate fails again → escalate
```

### Second failure — escalate to user

```
Surface to user:
  "Atom [A2] has failed its gate twice.
   Failure reason: [specific description]
   I cannot proceed without your input.
   Options:
   A) [describe one resolution path]
   B) [describe alternative resolution path]
   Which would you prefer?"
```

Do not attempt a third automatic retry. The second failure means the atom's spec,
the approach, or the external system has a fundamental issue that needs human judgment.

---

## The Checkbox Integrity Rule

The gate checkbox is a **commitment**. It means:

> "I have verified this. I am certain. I stake the quality of the entire output on this."

Marking a gate PASS on a failing output is the most serious error this skill can make.
It means:
- The downstream atoms build on a broken foundation
- The assembly produces a defective whole
- The user receives something that appears complete but is broken
- Trust in the system collapses

**A skill that lies on its checklist is not a skill. It is a trap.**

---

## Post-Failure Documentation

Every gate failure is logged, regardless of whether it was recovered:

```
GATE FAILURE LOG
  Atom: [A2]
  Failure #: 1 / 2
  Type: QUALITY_VIOLATION
  Specific issue: async call has no error handler on line 47
  Recovery action: added try/catch with specific error classification
  Gate re-run result: PASS ✓
  Total retries: 1
```

This log is part of the Delivery Certification in Phase 6.

---

## What Makes a Gate Pass vs. Fail

### Code atoms — gate FAIL triggers:
- Any `console.log` or debug output in production code
- Any hardcoded secret or credential
- Any unhandled Promise rejection
- Any `any` type in TypeScript (unless explicitly documented as intentional)
- Any function doing more than one thing
- Any file with more than one responsibility
- Any external call without a failure path

### Design atoms — gate FAIL triggers:
- Any color specified as a name ("blue") instead of a hex value
- Any font that wasn't explicitly fetched and validated as loadable
- Any spacing value that is not part of the declared scale
- Any component that has no mobile/responsive behavior
- Any animation that ignores `prefers-reduced-motion`
- Any layout that was not checked for the twist
- Any placeholder text (Lorem Ipsum, "coming soon", etc.)

### API atoms — gate FAIL triggers:
- Any write that was not preceded by a fetch
- Any payload that doesn't include the fetched current state
- Any response that wasn't validated against expected shape
- Any error state that isn't surfaced to the caller
- Any operation that could silently overwrite without detecting conflicts
