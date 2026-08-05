# skills/ — AI Agent Skill Packages

**Generated:** 2026-07-15
**Parent:** `../AGENTS.md`

## OVERVIEW

Markdown skill definitions consumed by the host planner. The package contains
shared and sandbox skills plus one public `delta-science` skill. Science tool
details are progressively loaded from references instead of exposed as
separate planner-visible skills.

## STRUCTURE

```
skills/
├── delta-sandbox/
│   ├── SKILL.md
│   └── references/
│       ├── commands.md
│       ├── lifecycle.md
│       └── recipes.md
├── delta-shared/
│   └── SKILL.md
└── delta-science/
    ├── SKILL.md
    └── references/
        ├── routing-index.md
        ├── workflows.md
        └── <science-tool>.md
```

## WHERE TO LOOK

| Path | Content |
|------|---------|
| `delta-sandbox/SKILL.md` | Create/run/read/write/kill workflow for sandbox tasks |
| `delta-sandbox/references/commands.md` | Command cheat sheet |
| `delta-sandbox/references/lifecycle.md` | Full create-to-kill lifecycle |
| `delta-sandbox/references/recipes.md` | Common task recipes |
| `delta-shared/SKILL.md` | Auth status, config init, exit-code/error mapping |
| `delta-science/SKILL.md` | Single Science entry point, routing, CLI-only execution, and cross-tool handoffs |
| `delta-science/references/` | Per-tool operation contracts, stable routing rules, and multi-tool workflows |

## CONVENTIONS

- YAML frontmatter: `name`, `description`, `metadata.requires.bins`, `metadata.cliHelp`
- Markdown body with command tables and copy-paste examples; cross-link via relative paths
- Each skill ships in the npm tarball through the `files` array in `package.json`
- `references/` holds supplementary docs like lifecycle guides and cheat sheets
- `delta-science` is host-neutral: `delta-cli` is the service boundary; do not add host-specific tool or environment dependencies
- Do not copy the server tool registry into the Skill; discover newly deployed tools through `delta-cli science list` and `delta-cli science endpoints list <tool>`
- Treat database `tools.name` and `tool_endpoints.name` as exact contracts; never add aliases or compatibility maps

## ANTI-PATTERNS

- Do not embed realistic credentials, API keys, or tokens in examples
- Do not break relative links between skills or references
- Do not reference internal Go package paths; use CLI command names
