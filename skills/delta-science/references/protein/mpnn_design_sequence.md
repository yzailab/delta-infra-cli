# MPNN Sequence Design (`huada_protein_tools` / `mpnn_design_sequence`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Protein sequence design with the ProteinMPNN family of models.
- Required: `structure_file` (.pdb/.cif)
- Optional: `model_type` (protein_mpnn/ligand_mpnn/soluble_mpnn), `number` (1), `fixed_residues`, `redesigned_residues`, `chain`
- Output: designed sequences with scores `resultjson`, `download_url`
- Use case: when only a PDB/CIF structure file is provided

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint mpnn_design_sequence --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `structure_file`

Server-side default parameters:

- `model_type` = `protein_mpnn`
- `number` = `1`

Request fields:

| Field | Description | Default |
|---|---|---|
| `structure_file` | PDB/CIF | - |
| `model_type` | Model type, default protein_mpnn | protein_mpnn |
| `number` | Number of sequences to generate, default 1 | 1 |
| `fixed_residues` | Fixed residue positions, space-separated | - |
| `redesigned_residues` | Positions to redesign only, space-separated | - |
| `chain` | PDB chain identifier | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Number of designed sequences, scores/confidence, download_url
- Presentation form: Text + download link
- Downstream reuse: -
## Output Template

- Title: **MPNN sequence design result**
- Lead with the conclusion: number of designed sequences and scores/confidence
- Add the design-result file link to the "Result files & downloads" section

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).