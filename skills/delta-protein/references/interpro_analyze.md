# InterProScan Domain & Function Annotation (`huada_protein_tools` / `interpro_analyze`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Annotate protein domains and functions with InterProScan.
- Input: `protein_sequence` / `sequence_file` (FASTA/FA) / `structure_file` (PDB/CIF) — choose one; when `structure_file` is provided the backend extracts the sequence automatically
- Optional: `chain` (protein chain identifier, default A)
- Output: domain/family/GO summary `resultjson`, Excel (.xlsx) download link `download_url`

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint interpro_analyze --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `protein_sequence` / `sequence_file` / `structure_file`

Request fields:

| Field | Description | Default |
|---|---|---|
| `protein_sequence` |  | - |
| `sequence_file` | FASTA/FA | - |
| `structure_file` | PDB/CIF | - |
| `chain` | Protein chain identifier, default A | A |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Domain, family, GO annotation summary + Excel (download_url)
- Presentation form: Annotation summary text + Excel download link
- Downstream reuse: -
## Output Template

- Title: **InterProScan domain and function annotation result**
- Lead with the conclusion: key domain/family/GO annotation entries
- Add the Excel detail file to the "Result files & downloads" section

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).