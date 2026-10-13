# skills/delta-protein — Protein Analysis Skill Package

**Parent:** `../AGENTS.md`

## OVERVIEW

Single public `delta-protein` skill: the unified entry point for Huada protein and
bioinformatics online analysis tools (mutation prediction, structure prediction, MSA,
protein design, docking, pocket/active-site analysis, conservation/InterPro,
enzyme kinetics, solubility/pH prediction, and PubMed/PubChem/UniProt/PISA/PLIP
lookup). It is host-neutral and routed exclusively through the Delta CLI
(`science invoke`) to the Science Server's `huada_protein_tools` tool. Per-endpoint
operation contracts live in `references/` and are loaded on demand; there are no
separate planner-visible per-tool skills and no workflow endpoints.

## STRUCTURE

```
delta-protein/
├── SKILL.md                 # single entry point: routing, CLI-only execution, safety red lines
├── agents/
│   └── openai.yaml          # host agent registration
└── references/
    └── <endpoint>.md        # one registered endpoint's operation contract
                             #  (39 endpoints under tool `huada_protein_tools`)
```

## DATA SOURCE

- Tool/endpoint identity and request fields come from the live Catalog
  (`delta-cli science list`, `delta-cli science endpoints list <tool>`) plus the
  authoritative parameter registry in
  `agent/protein_common/tool_registry/definitions.py` of the `delta-search-backend`
  project (per-tool `params`, `required_groups`, `default_params`, `timeout`).
- Response envelope is the Huada contract `{"status","message","tool_type",
  "resultjson","download_url"}`; per-tool `resultjson` keys are derived from the
  tool implementations, not invented.
- Each registered endpoint is a single tool call. Multi-step card workflows
  (cards/*.json) are NOT registered as endpoints and are not documented here; an
  agent may chain single endpoints in sequence when the task requires it.

## CONVENTIONS

- JSON/query operations go through `delta-cli science invoke --tool huada_protein_tools --endpoint <name>`; binary artifacts from `download_url` go through `delta-cli science file download`
- Endpoint names are exact server contracts, read from the Catalog — never invent fields/enums from memory
- Success is reported only when the subprocess exit is 0 AND top-level JSON `ok` is `true`; `data` holds the service response
- `references/` contains only registered real endpoints; routing and tool selection belong in `SKILL.md`
- Host-neutral: `delta-cli` is the sole service boundary; no host-specific tool/env dependencies
- Discover newly-deployed endpoints via `delta-cli science endpoints list huada_protein_tools`

## MAINTENANCE

- `scripts/gen_references.py` regenerates the `## Output Projection` and
  `## Output Template` sections in every reference from
  `scripts/output_metadata.json` (single source of truth for field projection /
  presentation form / downstream reuse / provenance marker). Stdlib only, idempotent.
- Workflow: update `output_metadata.json` → run
  `python scripts/gen_references.py` → run `python scripts/gen_references.py --check`.
  `--check` fails loudly on missing sections, drifting titles, broken SKILL links or
  references not covered by metadata.
- `output_metadata.json` `provenance` is `tested` (verified by a real `delta-cli`
  invocation) or `derived` (from ToolSpec descriptions / agent templates, marked
  "pending live calibration"). Newly verified endpoints should be flipped to `tested`.
- After changing references/SKILL, resync the opencode install dir:
  `python scripts/gen_references.py --sync "%USERPROFILE%\.config\opencode\skills\delta-protein"`.

## ANTI-PATTERNS

- Do not call `curl`/`requests`/`httpx`/browser/PowerShell web directly against any Huada or Gateway URL
- Do not bypass delta-cli or attach local MCP tool servers directly
- Do not fabricate protein sequences, structures, activity data, or algorithm results, and do not pass local-library results off as Science results
- Do not create extra JSON/CSV/report/image artifacts unless the user explicitly asks
- Do not break relative links between SKILL.md and `references/`