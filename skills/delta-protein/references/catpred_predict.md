# Enzyme Kinetic Parameter Prediction (`huada_protein_tools` / `catpred_predict`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Predict enzyme kinetic parameters (kcat, Km, kcat/Km).
- Required: `primary_smiles` (substrate SMILES)
- Optional: `protein_sequence`/`sequence_file`/`structure_file`, `chain` (A), `additional_smiles`
- Output: kinetic parameter predictions `resultjson`, `download_url`

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint catpred_predict --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `primary_smiles`

Request fields:

| Field | Description | Default |
|---|---|---|
| `primary_smiles` | Substrate SMILES string | - |
| `protein_sequence` |  | - |
| `sequence_file` | FASTA/FA | - |
| `structure_file` | PDB/CIF | - |
| `chain` | Protein chain identifier, default A | A |
| `additional_smiles` | List of additional substrate SMILES | [] |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: kcat, Km, kcat/Km predictions (restate resultjson per the actual keys returned)
- Presentation form: Text
- Downstream reuse: -
## Output Template

- Title: **Enzyme kinetic parameter prediction result (CatPred)**
- Lead with the conclusion: predicted kcat, Km, kcat/Km and trends
- Restate key parameters in natural language or a small table

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).