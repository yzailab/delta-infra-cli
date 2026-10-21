# skills/delta-sandbox — Sandbox AI Agent Skill

**Generated:** 2026-10-21
**Parent:** `../AGENTS.md`

## OVERVIEW

The primary sandbox skill. It teaches an AI agent (Planner → executor) how to drive `delta-cli sandbox` end to end: create a sandbox, run commands in it, read and write files, tunnel ports, and collect artifacts. Ships as one skill directory in the npm tarball (`package.json` `files`) and is installed to every supported agent platform by `scripts/install-wizard.js`.

## WHERE TO LOOK

| Path | Content |
|------|---------|
| `SKILL.md` | The whole contract (401 lines): when to use, scope, sandbox environment, mandatory rules, request wording, required_outputs, quick routing, full lifecycle, tunnelling, structured-output convention, reading output, Planner guidance, recovery |
| `references/commands.md` | Command cheat sheet (72 lines): discovery, lifecycle, command execution, file operations, tunnelling |
| `references/lifecycle.md` | Full create-to-kill workflow (111 lines) incl. background tasks and polling patterns |
| `references/recipes.md` | Standard task request patterns (139 lines): required_outputs templates, script output template, GPU/CUDA check, run-a-script, install-and-run, train-and-save-metrics, general data processing |
| `agents/openai.yaml` | OpenAI-format agent descriptor |

## CONVENTIONS

- YAML frontmatter carries `name`, `description`, `metadata.requires.bins: ["delta-cli"]` and `metadata.cliHelp: "delta-cli sandbox --help"`
- The `description` is what the Planner matches against — it encodes the output convention and the `required_outputs` requirement
- `SKILL.md` opens with a **CRITICAL** instruction to read `../delta-shared/SKILL.md` first (auth, config, error handling)
- "Mandatory rules" is a failure section: breaking any of them makes the task a failure
- Request wording: describe commands with neutral verbs (run/execute); use create/write/save only when a file is actually written
- When the Planner calls this skill it must declare `[{kind: 'file', extensions: ['.json']}]` in `required_outputs` for the plan step
- Sandbox scripts/commands print structured JSON at the end of stdout; on the SSE path the CLI detects the trailing JSON and exposes it as `result_summary` in the complete frame
- Cross-link to sibling skills and references with relative paths only

## ANTI-PATTERNS

- Do not embed realistic credentials, API keys, or tokens in the examples
- Do not break the relative links between `SKILL.md`, `references/` and `../delta-shared/SKILL.md`
- Do not reference internal Go package paths — use CLI command names
- Do not document a command that `delta-cli sandbox` does not expose
- Do not state that a sandbox has no TTL or auto-reclaim: the platform TTL is the primary expiry path, and the server also reclaims stale sandboxes — keep the wording consistent with `references/lifecycle.md` and the CLI help
