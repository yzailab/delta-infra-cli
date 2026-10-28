# skills/delta-science — Science Skill Package

**Generated:** 2026-09-07
**Parent:** `../AGENTS.md`

## OVERVIEW

Single public `delta-science` skill: the company online-Science unified entrypoint. It is host-neutral and routed exclusively through Delta CLI (`science invoke`, durable `science task`, or controlled `science file`) to the Science Server. Per-tool operation contracts live in `references/` and are loaded on demand; there are no separate planner-visible per-tool skills. The retired `delta-protein` skill is folded in here: the `huada_protein_tools` tool's 39 endpoint contracts live under `references/protein/` and are routed via `references/huada_protein_tools.md`.

## STRUCTURE

```
delta-science/
├── SKILL.md                 # single entrypoint: routing, CLI-only execution, cross-tool handoff
├── agents/
│   └── openai.yaml          # host agent registration
├── references/
│   ├── <tool>.md            # one real tool's operation contract (pubchem, rdkit, pymatgen,
│   │                        #  gsasii, lammps, delta-bo, ldm-bo, materials-design, qe,
│   │                        #  strbo, synbo, antbo, xrd, huada_protein_tools)
│   └── protein/             # 39 huada_protein_tools endpoint contracts, linked from
│                            #  references/huada_protein_tools.md
└── scripts/
    ├── catalog.py           # catalog generation helpers
    ├── generated_catalog.py
    ├── invoke.py            # invoke helpers
    └── protein/             # gen_references.py + output_metadata.json (huada_protein_tools)
```

## WHERE TO LOOK

| Path | Content |
|------|---------|
| `SKILL.md` | Service boundary, security guardrails (no curl/requests/httpx/browser direct gateway), invoke/task/file templates, cross-tool handoff |
| `references/<tool>.md` | One real tool's authoritative operation, request-field, response and failure schema |
| `references/huada_protein_tools.md` | Router for the 39 `huada_protein_tools` endpoint contracts |
| `references/protein/` | One `huada_protein_tools` endpoint contract per file |
| `scripts/protein/gen_references.py` | Regenerates / checks the protein endpoint Output Projection + Template sections |

## CONVENTIONS

- JSON endpoint operations go through `delta-cli science invoke`; durable jobs go through `delta-cli science task`; raw/multipart operations go through `delta-cli science file`; no direct HTTP alternate routes
- Tool/endpoint names are exact contracts from the server DB — read the matching reference first; never invent fields/enums from memory
- Success is reported only when subprocess exit is 0 AND top-level JSON `ok` is `true`; `data` holds the service response
- `references/` contains only one real tool per file; routing, service maps, catalogs and workflows belong in `SKILL.md` or live CLI discovery, not here
- `retired_skills` (old per-tool skills) are removed, not referenced
- Host-neutral: `delta-cli` is the sole service boundary; no host-specific tool/env dependencies
- Discover newly-deployed tools via `delta-cli science list` / `delta-cli science endpoints list <tool>`; do not copy the server registry into the Skill

## PROTEIN ENDPOINTS (`huada_protein_tools`)

- Endpoint identity and request fields come from the live Catalog (`delta-cli science endpoints list huada_protein_tools`) plus the authoritative parameter registry in `agent/protein_common/tool_registry/definitions.py` of the `delta-search-backend` project.
- Response envelope is the Huada contract `{"status","message","tool_type","resultjson","download_url"}`; per-endpoint `resultjson` keys are derived from the tool implementations, not invented.
- Each registered endpoint is one tool call. Multi-step `cards/*.json` workflows are NOT registered as endpoints; chain single endpoints when the task requires it.

## MAINTENANCE (protein references)

- `scripts/protein/gen_references.py` regenerates the `## Output Projection` and `## Output Template` sections of every `references/protein/<endpoint>.md` from `scripts/protein/output_metadata.json` (single source of truth). Stdlib only, idempotent.
- Workflow: update `output_metadata.json` → run `python scripts/protein/gen_references.py` → run `python scripts/protein/gen_references.py --check`. `--check` fails on missing sections, drifted titles, broken router links, or references not covered by metadata.
- `output_metadata.json` `provenance` is `tested` (verified by a real `delta-cli` invocation) or `derived` (from ToolSpec/agent templates, pending live calibration).
- Resync the opencode install dir: `python scripts/protein/gen_references.py --sync "%USERPROFILE%\.config\opencode\skills\delta-science"`.

## ANTI-PATTERNS

- Do not call `curl`/`requests`/`httpx`/browser/PowerShell web directly against the gateway
- Do not bypass delta-cli via the legacy `large-discovery-model` Skill or gateway scripts
- Do not bypass delta-cli or attach local MCP tool servers directly
- Do not fabricate science data or mislabel local-tool (RDKit/pymatgen/LAMMPS/etc.) results as Science results
- Do not fabricate protein sequences, structures, activity data, or algorithm results
- Do not create extra JSON/CSV/report/image artifacts unless the user explicitly asks to save/export/plot
- Do not embed realistic credentials or API keys in examples
- Do not break relative links between SKILL.md and `references/`