# REAP Mutant Ranking (`protein_tools` / `reap`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

Rank mutants with REAP from a wild-type sequence and a wet-lab mutant/activity table.
- `protein_sequence` (wild-type) or `sequence_file` (single-sequence FASTA) — provide one
- `assay_file` (required): wet-lab table with `mutant` and `activity` columns (e.g. `A12G` or `A12G_G45D`)
- `top_n` (int, default 96): number of top UCB candidates written to selected_candidates.xlsx
- `lambda_sigma` (float, default 1.0): UCB coefficient = prediction_mean + lambda_sigma * prediction_std

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint reap --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `protein_sequence` | Wild-type protein sequence (one of two inputs) | - |
| `sequence_file` | Wild-type single-sequence FASTA (one of two inputs) | - |
| `assay_file` | Wet-lab table (columns: mutant, activity) | - |
| `top_n` | Top UCB candidates written to xlsx | 96 |
| `lambda_sigma` | UCB coefficient | 1.0 |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`;
  the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`
  and `download_url`. `resultjson` may be a single object or an array — read only the keys
  documented in this file, do not recursively search.
- `resultjson`: REAP training summary and selected-mutant preview; `download_url`: selected_candidates.xlsx
  (mutant/rank/UCB score).

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: REAP training summary and selected mutant preview (mutant/rank/UCB score); download_url is selected_candidates.xlsx
- Presentation form: Ranking preview text + Excel download link
- Downstream reuse: -
## Output Template

- Title: **REAP mutant ranking result**
- Lead with the conclusion: number of measured mutants ranked and top candidates
- Add selected_candidates.xlsx to the "Result files & downloads" section

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
