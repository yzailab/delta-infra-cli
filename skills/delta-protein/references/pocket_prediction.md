# Pocket Prediction (`huada_protein_tools` / `pocket_prediction`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Predict protein pockets with p2rank (local).
- Required: `structure_file` (.pdb/.cif)
- Optional: `model_config_name` (default | alphafold), default "default"; AlphaFold/NMR/cryo-EM structures are best served by "alphafold"
- Output: `resultjson` contains `n_pockets` and a `pockets` list (rank/name/score/probability/center/residue_ids/n_residues); `download_url` is the cropped pocket PDB download link ({structure_name}_pocket_cut.pdb, pocket residues + ligand HETATM only), suitable as RFdiffusion3 design input
- Use case: identify functionally important residues and ligand binding sites

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint pocket_prediction --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `structure_file`

Request fields:

| Field | Description | Default |
|---|---|---|
| `structure_file` | PDB/CIF | - |
| `model_config_name` | p2rank model configuration: default or alphafold | default |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: verified by a real `delta-cli` invocation

- Projection content: n_pockets and pockets list (rank/name/score/probability/center/residue_ids/n_residues) + cropped pocket PDB download_url
- Presentation form: Pocket list + link; n_pockets=0 is a valid result (p2rank found no pocket), not a failure
- Downstream reuse: cropped pocket PDB (download_url) -> structure_file for rfd3_design
## Output Template

- Title: **Binding pocket prediction result**
- Lead with the conclusion: number of pockets, per-pocket score/probability, location of the top ones (center and residues)
- Add the cropped pocket PDB to the "Result files & downloads" section and note it can feed rfd3_design
- Report n_pockets=0 truthfully (p2rank found no pocket), not a failure

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).