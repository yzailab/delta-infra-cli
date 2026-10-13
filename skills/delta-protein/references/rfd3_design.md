# Protein Scaffold Design (RFdiffusion3) (`huada_protein_tools` / `rfd3_design`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Protein scaffold design with RFdiffusion3 (without MPNN sequence design).
- Required: `structure_file` (cropped PDB/CIF structure URL or path, e.g. the `download_url` returned by pocket_prediction)
- Optional: `chain_id` (design only this chain, default "A"; specifying a single chain on a multi-chain structure such as a tetramer avoids cross-chain cost-matrix conflicts), `length` (design length range, e.g. "100-200", default "100-200"), `rfd3_n` (RFdiffusion3 sample count, default 1)
- The backend auto-infers `unindex` / `select_fixed_atoms` / `ori_token`
- Output: generated PDB structure files and sequence FASTA files packaged as a ZIP `download_url`; `resultjson` contains `{structures: [...], structure_links: [...]}`, where each `structures` entry carries chain/length/sequence/sample_score/quality_metrics, and `quality_metrics` includes insertion RMSD, clashes, chain breaks, secondary structure, etc.; `structure_links` are the best ≤5 scaffold PDB links sorted by `sample_score` (highest score first)
- Use case: scaffold design only, without MPNN sequence design

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint rfd3_design --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `structure_file`

Request fields:

| Field | Description | Default |
|---|---|---|
| `structure_file` | Cropped PDB/CIF | - |
| `chain_id` | Design only this protein chain, default "A" | A |
| `length` | Design length range, e.g. "100-200" | 100-200 |
| `rfd3_n` | RFdiffusion3 sample count, default 1 | 1 |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: structure_links (best ≤5 scaffold PDBs sorted by sample_score) with structures overview (chain/length/sequence/sample_score/quality metrics)
- Presentation form: Scaffold PDB link list; quality metrics include insertion RMSD, clashes, chain breaks, secondary structure
- Downstream reuse: scaffolds can feed mpnn_design_sequence / protein_design for sequence design
## Output Template

- Title: **RFdiffusion3 protein scaffold design result**
- Lead with the conclusion: number of scaffolds generated (best ≤5), sample_score range
- Add scaffold PDB links to the "Result files & downloads" section; summarize quality metrics in text (insertion RMSD/clashes/chain breaks/secondary structure)

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).