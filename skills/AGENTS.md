# skills/ — AI Agent Skill Packages

**Generated:** 2026-07-15
**Parent:** `../AGENTS.md`

## OVERVIEW

Markdown skill definitions consumed by the host planner. Two skills: `delta-sandbox` (sandbox lifecycle, command execution, file I/O) and `delta-shared` (auth, config, error interpretation).

## STRUCTURE

```
skills/
├── delta-sandbox/
│   ├── SKILL.md
│   └── references/
│       ├── commands.md
│       ├── lifecycle.md
│       └── recipes.md
└── delta-shared/
    └── SKILL.md
```

## WHERE TO LOOK

| Path | Content |
|------|---------|
| `delta-sandbox/SKILL.md` | Create/run/read/write/kill workflow for sandbox tasks |
| `delta-sandbox/references/commands.md` | Command cheat sheet |
| `delta-sandbox/references/lifecycle.md` | Full create-to-kill lifecycle |
| `delta-sandbox/references/recipes.md` | Common task recipes |
| `delta-shared/SKILL.md` | Auth status, config init, exit-code/error mapping |

## CONVENTIONS

- YAML frontmatter: `name`, `description`, `metadata.requires.bins`, `metadata.cliHelp`
- Markdown body with command tables and copy-paste examples; cross-link via relative paths
- Each skill ships in the npm tarball through the `files` array in `package.json`
- `references/` holds supplementary docs like lifecycle guides and cheat sheets

## ANTI-PATTERNS

- Do not embed realistic credentials, API keys, or tokens in examples
- Do not break relative links between skills or references
- Do not reference internal Go package paths; use CLI command names
