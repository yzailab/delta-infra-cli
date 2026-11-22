# Protein Physicochemical Parameters (`protein_tools` / `protparam_predict`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

Compute protein physicochemical parameters (ProtParam-equivalent, biopython).
- `protein_sequence` (required): single-letter sequence of the standard 20 amino acids, e.g. `MKTAYIAKQR...`

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint protparam_predict --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `protein_sequence` | Single-letter protein sequence (standard 20 amino acids) | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`;
  the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`
  and `download_url`. `resultjson` may be a single object or an array — read only the keys
  documented in this file, do not recursively search.
- `resultjson`: `length`/`molecular_weight`/`theoretical_pi`/`amino_acid_composition`/
  `amino_acid_percent`/`negatively_charged_residues`/`positively_charged_residues`/
  `extinction_coefficients`/`instability_index`/`gravy`. `download_url` always empty.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Physicochemical parameters: length/molecular_weight/theoretical_pi/amino_acid_composition/instability_index/gravy/extinction_coefficients/charged-residue counts
- Presentation form: Parameter summary text/table, restated in natural language
- Downstream reuse: -
## Output Template

- Title: **Protein physicochemical parameter prediction (ProtParam)**
- Lead with the conclusion: molecular weight and theoretical pI
- List key parameters as natural-language text or a small table; do not use raw JSON key names

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
