# Protein Design (RFdiffusion3+MPNN) (`huada_protein_tools` / `protein_design`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

De novo protein design with RFdiffusion3 and MPNN.
- Required: `rfd3_json_url` (RFdiffusion3 config file)
- Optional: `input_file` (list of PDB files), `mpnn_type` (protein_mpnn/ligand_mpnn/soluble_mpnn), `rfd3_n` (1), `mpnn_n` (1)
- Output: designed sequences with scores `download_url`, `zip_download_url`
- Use case: de novo design of new proteins; use when the user uploads both a PDB and an RFdiffusion3 JSON, or explicitly mentions rfd3/RFdiffusion3

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint protein_design --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `rfd3_json_url`

Request fields:

| Field | Description | Default |
|---|---|---|
| `rfd3_json_url` | RFdiffusion3 config file | - |
| `input_file` | Input PDB file URL list | [] |
| `mpnn_type` | MPNN type, default protein_mpnn | protein_mpnn |
| `rfd3_n` | RFdiffusion3 sample count, default 1 | 1 |
| `mpnn_n` | MPNN sample count, default 1 | 1 |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Designed sequences with scores, download_url (design results), zip_download_url
- Presentation form: Download link list; structure files given as `[name](full URL)` per format
- Downstream reuse: terminal artifact
## Output Template

- Title: **Protein design result (RFdiffusion3 + MPNN)**
- Lead with the conclusion: number of designed sequences / scores
- Add design-result and scaffold-file links to the "Result files & downloads" section: `[Design result file](download_url)`, `[ZIP](zip_download_url)`

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).