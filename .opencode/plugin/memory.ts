// Persistent-memory plugin for the AILGEN workspace.
//
// Two jobs:
//   1. Re-inject a compact digest of the memory files into the system prompt on every request,
//      so decisions survive compaction and session boundaries.
//   2. Append project-decision context to the compaction prompt, so a compaction summary keeps
//      architectural decisions, file paths and Hebrew copy instead of just the last few turns.
//
// Only `node:` builtins are imported at runtime. @opencode-ai/plugin is intentionally NOT
// imported: a project-local plugin cannot assume it resolves from this directory, so the hook
// shapes are declared locally instead.

import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"

type MemoryFile = {
  path: string
  label: string
  maxChars: number
  // DECISIONS/ENVIRONMENT are append-only, so the newest entries are at the end.
  // SESSION.md is rewritten wholesale each handoff, so its head is the live state.
  keep: "head" | "tail"
}

type CacheEntry = {
  stamp: string
  digest: string
}

const FILES: MemoryFile[] = [
  // AGENTS.md and CLAUDE.md are already loaded by opencode's `instructions`, so they are not
  // repeated here. These three carry the state that changes between sessions.
  { path: "memory/DECISIONS.md", label: "DECISIONS", maxChars: 1800, keep: "tail" },
  { path: "memory/ENVIRONMENT.md", label: "ENVIRONMENT", maxChars: 1000, keep: "tail" },
  { path: "memory/SESSION.md", label: "SESSION HANDOFF", maxChars: 1400, keep: "head" },
]

const cache = new Map<string, CacheEntry>()

function stampOf(root: string): string {
  let stamp = ""
  for (const file of FILES) {
    try {
      const st = statSync(join(root, file.path))
      stamp += `${file.path}:${st.mtimeMs}:${st.size};`
    } catch {
      stamp += `${file.path}:missing;`
    }
  }
  return stamp
}

function readTrimmed(root: string, file: MemoryFile): string | undefined {
  try {
    const raw = readFileSync(join(root, file.path), "utf8")
    const body = raw.trim()
    if (body.length <= file.maxChars) return body
    if (file.keep === "head") {
      return body.slice(0, file.maxChars) + "\n...[older remainder trimmed]..."
    }
    return "...[earlier entries trimmed]...\n" + body.slice(body.length - file.maxChars)
  } catch {
    return undefined
  }
}

function digest(root: string): string {
  const stamp = stampOf(root)
  const hit = cache.get(root)
  if (hit && hit.stamp === stamp) return hit.digest

  const parts: string[] = [
    "=== AILGEN PERSISTENT MEMORY (auto-injected from memory/ — authoritative over chat) ===",
  ]
  for (const file of FILES) {
    const body = readTrimmed(root, file)
    if (!body) continue
    parts.push(`\n--- ${file.label} (${file.path}) ---\n${body}`)
  }
  parts.push(
    "\n=== END MEMORY ===",
    "Rules: treat the above as ground truth. If chat history disagrees with these files, the files win.",
    "Record a new durable fact by writing it to memory/DECISIONS.md or memory/ENVIRONMENT.md; never leave it only in chat.",
  )

  const out = parts.join("\n")
  cache.set(root, { stamp, digest: out })
  return out
}

const COMPACTION_CONTEXT = [
  "This is a long-running engineering session in the AILGEN static-site repo. When you write the compaction summary, preserve the following, in this order:",
  "1. GOAL — what the user is ultimately trying to achieve, in their terms.",
  "2. DONE — work completed and verified, with the exact commands that verified it.",
  "3. STATE — the current working tree state: which files changed, what is uncommitted, what is broken or half-finished.",
  "4. NEXT — the single exact next command or action to run, plus any open questions for the user.",
  "5. FACTS TO RETAIN — architectural decisions from memory/DECISIONS.md that are still in force, environment quirks from memory/ENVIRONMENT.md, every relevant file path, and any Hebrew copy (RTL strings) verbatim. Hebrew strings must never be paraphrased or translated.",
  "Do NOT carry forward raw terminal logs, full file dumps, or crawl output. Summarize, do not transcribe.",
  "Do NOT drop or contradict a decision recorded in memory/DECISIONS.md. If this session changed one, say so explicitly.",
].join("\n")

export default async function memoryPlugin(input: {
  directory: string
  worktree: string
}) {
  const root = input.worktree || input.directory

  return {
    "experimental.chat.system.transform": async (_i: unknown, output: { system: string[] }) => {
      try {
        output.system.push(digest(root))
      } catch {
        // never break the request because memory injection failed
      }
    },

    "experimental.session.compacting": async (_i: unknown, output: { context: string[] }) => {
      try {
        output.context.push(COMPACTION_CONTEXT)
        output.context.push(digest(root))
      } catch {
        // fall back to the default compaction prompt
      }
    },
  }
}
