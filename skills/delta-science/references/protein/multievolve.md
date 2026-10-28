# Multi-site Mutation Activity Prediction (`huada_protein_tools` / `multievolve`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Predict the activity of multi-site combinatorial mutations with MultiEvolve.
- Required: `training_dataset` (file with mutant and activity columns)
- Optional: `mutant_pool`, `protein_sequence`/`sequence_file`/`structure_file`, `chain` (A), `topk` (5), `fix` (True)
- Output: multi-site mutation activity scores `download_url`
- Use case: predicting combinatorial mutation effects when training data is available; used when the user does not explicitly specify a mutation-site count

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint multievolve --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `training_dataset`

Server-side default parameters:

- `topk` = `5`
- `fix` = `true`

Request fields:

| Field | Description | Default |
|---|---|---|
| `training_dataset` | CSV/XLSX with mutant/activity columns | - |
| `mutant_pool` | CSV/XLSX mutant pool file, optional | - |
| `protein_sequence` |  | - |
| `sequence_file` | FASTA/FA | - |
| `structure_file` | PDB/CIF | - |
| `chain` | Protein chain identifier, default A | A |
| `topk` | Number of results to return, default 5 | 5 |
| `fix` | Whether to fix the random seed, default True | true |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Multi-site combinatorial mutation activity score topk (download_url)
- Presentation form: Ranking text/table + download link
- Downstream reuse: -
## Output Template

- Title: **Multi-site mutation activity prediction result**
- Lead with the conclusion: recommended combinatorial mutations and activity-score trend (topk)
- Add the full ranking to the "Result files & downloads" section

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).