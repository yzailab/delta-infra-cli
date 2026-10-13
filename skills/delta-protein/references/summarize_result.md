# Multi-model Result Summary (`huada_protein_tools` / `summarize_result`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Summarize multi-model zero-shot prediction results as the final step of the
mutation-prediction flow.
- Required: `result_files` (list of paths to multiple prediction result files)
- Optional: `protein_sequence`, `topk` (10)
- Output: summarized ranking `download_url`

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint summarize_result --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `result_files`

Server-side default parameters:

- `topk` = `10`

Request fields:

| Field | Description | Default |
|---|---|---|
| `result_files` | URL list of result files from previous steps | [] |
| `protein_sequence` |  | - |
| `topk` | Return the top k results, default 10 | 10 |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Multi-model summarized ranking (topk) with all rows retained; restated as a table with the tool's original fields, prompting download of the full file when too long
- Presentation form: Full Markdown table (≤100 rows); better for filtering/sorting
- Downstream reuse: final step of the mutation-prediction chain (terminal)
## Output Template

- Title: **Multi-model result summary**
- Show the full summary table (≤100 rows, no truncation), column names restated in natural language
- Lead with the conclusion: positions where models agree/disagree; base final recommendations on the summary rather than restating single-model raw tables
- When more than 100 rows, prompt downloading the full file

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).