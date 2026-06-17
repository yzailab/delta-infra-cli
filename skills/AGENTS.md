# skills/ — AI Agent Skill Packages

**Generated:** 2026-06-16 (Deep Refresh)
**Parent:** `../AGENTS.md`

## OVERVIEW

Markdown-based skill definitions for AI agents interacting with delta-cli. Two packages: `delta-sandbox` (sandbox lifecycle operations) and `delta-shared` (auth, config, error handling conventions).

## STRUCTURE

```
skills/
├── delta-sandbox/
│   ├── SKILL.md              # YAML frontmatter + Markdown operation guide
│   └── references/           # (empty or planned)
└── delta-shared/
    └── SKILL.md              # Shared auth/config rules
```

## WHERE TO LOOK

| Path | Content |
|------|---------|
| `delta-sandbox/SKILL.md` | Sandbox create/run/read/write/kill workflow for AI agents |
| `delta-shared/SKILL.md` | Shared auth commands, config management, error interpretation |

## CONVENTIONS

- YAML frontmatter with `name`, `description`, `metadata.requires.bins`, `metadata.cliHelp`
- Markdown body with tables for commands and examples; sections for preconditions
- Skills are included in npm package `files` array and shipped with the CLI distribution
- References directory for supplementary docs (lifecycle guides, command cheatsheets)

## ANTI-PATTERNS

- Do not embed realistic credentials, API keys, or tokens in skill examples
- Do not break relative links between skills or references
- Do not reference internal Go package paths in skill docs — use CLI command names
