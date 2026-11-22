# Zero-shot Mutation Candidates — SolubleMPNN (`protein_tools` / `zero_shot_soluble_mpnn`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

Zero-shot single-point mutation candidate prediction with SolubleMPNN (structure class; requires a PDB).
- `structure_file` (required): protein structure file .pdb/.cif
- `chain` (default "A"): chain to read from the structure file
- `topk` (int, default 96): number of top-scoring mutations to return in `resultjson`

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint zero_shot_soluble_mpnn --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `structure_file` | Protein structure file .pdb/.cif | - |
| `chain` | Chain to read from the structure file | A |
| `topk` | Number of top-scoring mutations to return in `resultjson` | 96 |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`;
  the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`
  and `download_url`. `resultjson` may be a single object or an array — read only the keys
  documented in this file, do not recursively search.
- `resultjson`: mutated candidates sorted by algorithm; `download_url`: full result Excel.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: SolubleMPNN zero-shot single-point mutation candidates (structure-based; original mutation notation + score); download_url is the full Excel
- Presentation form: Markdown table of mutation candidates + Excel download link
- Downstream reuse: candidate list can feed summarize_result or guide downstream reading
## Output Template

- Title: **Zero-shot mutant candidate prediction (SolubleMPNN)**
- Markdown table: `| Mutation | Score |`, keeping the tool's original mutation notation; column names adjusted per resultjson
- Add the full result Excel to the "Result files & downloads" section
- Never invent scores/ranks not present in resultjson

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`file_url`/`source` etc.) take
  server-accessible URL/path strings, not local upload paths; a `download_url` or
  `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields
  declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results;
  do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation
  timeouts (the outcome may be unknown because the task may already have happened).
