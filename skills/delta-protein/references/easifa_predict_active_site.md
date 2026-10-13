# Enzyme Active-site Prediction (`huada_protein_tools` / `easifa_predict_active_site`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Predict enzyme active sites with EasIFA.
- Required: `input_mode` (structure/sequence/uniprot)
- structure mode requires `structure_file`; sequence mode requires `protein_sequence` or `sequence_file`
- Optional: `rxn_smiles` (reaction SMILES), `chain`
- Output: active-site predictions `resultjson`, `download_url`

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint easifa_predict_active_site --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `input_mode`

Server-side default parameters:

- `input_mode` = `structure`

Request fields:

| Field | Description | Default |
|---|---|---|
| `input_mode` | Input mode: structure/sequence/uniprot | structure |
| `structure_file` | PDB/CIF | - |
| `protein_sequence` |  | - |
| `sequence_file` | FASTA/FA | - |
| `rxn_smiles` | Reaction SMILES (substrate>>product) | - |
| `chain` | Protein chain identifier, default A | A |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Enzyme active-site/binding-site residues, positions and confidence; positions overlapping zero-shot mutant results are marked as not recommended for engineering
- Presentation form: Text/table
- Downstream reuse: site information cross-annotated with zero_shot_mutant_candidates overlap
## Output Template

- Title: **Enzyme active-site/binding-site prediction result (EasIFA)**
- Lead with the conclusion: active-site residues, positions, confidence
- When zero-shot mutant results exist, mark overlapping positions (overlaps not recommended for engineering)

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).