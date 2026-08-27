# skills/delta-science — Science Skill Package

**Parent:** `../AGENTS.md`

## OVERVIEW

Single public `delta-science` skill: the company online-Science unified entrypoint. It is host-neutral and routed exclusively through `delta-cli science invoke -> Science Server`. Per-tool operation contracts live in `references/` and are loaded on demand; there are no separate planner-visible per-tool skills.

## STRUCTURE

```
delta-science/
├── SKILL.md                 # single entrypoint: routing, CLI-only execution, cross-tool handoff
├── agents/
│   └── openai.yaml          # host agent registration
└── references/
    └── <tool>.md            # one real tool's operation contract (pubchem, rdkit, pymatgen,
                             #  gsasii, lammps, delta-bo, ldm-bo, materials-design, qe,
                             #  strbo, synbo, antbo)
```

## WHERE TO LOOK

| Path | Content |
|------|---------|
| `SKILL.md` | Service boundary, 安全红线 (no curl/requests/httpx/browser direct gateway), invocation template, cross-tool handoff |
| `references/<tool>.md` | One real tool's authoritative operation, request-field, response and failure schema |

## CONVENTIONS

- All science operations go through `delta-cli science invoke --tool T --endpoint E --data JSON`; no alternate routes
- Tool/endpoint names are exact contracts from the server DB — read the matching reference first; never invent fields/enums from memory
- Success is reported only when subprocess exit is 0 AND top-level JSON `ok` is `true`; `data` holds the service response
- `references/` contains only one real tool per file; routing, service maps, catalogs and workflows belong in `SKILL.md` or live CLI discovery, not here
- `retired_skills` (old per-tool skills) are removed, not referenced
- Host-neutral: `delta-cli` is the sole service boundary; no host-specific tool/env dependencies
- Discover newly-deployed tools via `delta-cli science list` / `delta-cli science endpoints list <tool>`; do not copy the server registry into the Skill

## ANTI-PATTERNS

- Do not call `curl`/`requests`/`httpx`/browser/PowerShell web directly against the gateway
- Do not bypass delta-cli via the legacy `large-discovery-model` Skill or gateway scripts
- Do not fabricate science data or mislabel local-tool (RDKit/pymatgen/LAMMPS/etc.) results as Science results
- Do not create extra JSON/CSV/report/image artifacts unless the user explicitly asks to save/export/plot
- Do not embed realistic credentials or API keys in examples
- Do not break relative links between SKILL.md and `references/`
