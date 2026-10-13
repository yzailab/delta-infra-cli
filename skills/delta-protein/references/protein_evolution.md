# Protein n-site Mutation Activity Prediction (`huada_protein_tools` / `protein_evolution`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Predict the activity of specified mutation sites with a protein-evolution method.
- Required: `mutant_url` (Excel/CSV file with a mutant column and at least one numeric column)
- Optional: `protein_sequence`/`sequence_file`/`structure_file`, `chain` (A), `mutant_n` (0), `topk` (-1), `model_name` (esm2/esmc), `threshold`, `regression_type` (randomforest/gp)
- Multi-objective optimization: `target_columns` (specify multiple numeric column names, e.g. ["yield","ee"]; auto-detected by default), `weights` (per-target weights; equal weights by default)
- Output: best mutations with activity scores `download_url`
- Use case: mutation activity data is available and the user explicitly specifies "2-site/3-site/n-site/multi-site mutation"

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint protein_evolution --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `mutant_url`

Server-side default parameters:

- `topk` = `30`

Request fields:

| Field | Description | Default |
|---|---|---|
| `mutant_url` | CSV/XLSX with a mutant column and at least one numeric column | - |
| `protein_sequence` |  | - |
| `sequence_file` | FASTA/FA | - |
| `structure_file` | PDB/CIF | - |
| `chain` | Protein chain identifier, default A | A |
| `mutant_n` | Specified number of n-site mutations, default 0 | 0 |
| `topk` | Number of results to return, default -1 (all) | -1 |
| `model_name` | Feature model name (esm2/esmc) | - |
| `threshold` | Threshold | - |
| `regression_type` | Regression model (randomforest/gp) | - |
| `target_columns` | Specify multiple target numeric column names, e.g. ['yield','ee']; auto-detects all numeric columns by default | - |
| `weights` | Weights per target column, e.g. [0.5,0.5]; equal weights by default | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Activity score topk for specified n-site/multi-site mutations (download_url)
- Presentation form: Text/table + download link
- Downstream reuse: -
## Output Template

- Title: **Protein n-site mutation activity prediction result**
- Lead with the conclusion: n-site/multi-site mutation activity prediction results (topk)
- Add details to the "Result files & downloads" section

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).