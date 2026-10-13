# Vina Single-pose Scoring (`huada_protein_tools` / `dock_score`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Single-pose scoring (score_only) of a protein-ligand complex with AutoDock Vina.
- Input: `structure_file` (PDB/CIF complex file URL) + `dock_ligand` (ligand residue name in the complex, e.g. BTA)
- Optional: `chain_id` (chain ID of the ligand, default A); `box_center`/`box_size` (manual box, format x,y,z or w,h,d) — when not provided, computed automatically from the ligand bounding box
- Optional defaults: padding=8.0, min_box_size=20.0, ph=7.4, cpu=8, seed=42
- Output: `resultjson` contains `best_score` (total binding energy, kcal/mol) and `scores` (energy breakdown dict)

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint dock_score --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `structure_file` **and** `dock_ligand`

Request fields:

| Field | Description | Default |
|---|---|---|
| `structure_file` | PDB/CIF complex | - |
| `dock_ligand` | Ligand residue name in the complex to be scored, e.g. BTA | - |
| `chain_id` | Chain ID of the ligand, default A | A |
| `box_center` | Manually specified scoring box center, format x,y,z | - |
| `box_size` | Manually specified scoring box size, a single number or w,h,d | - |
| `padding` | Padding around the bounding box (Å) when the box is auto-computed | 8.0 |
| `min_box_size` | Minimum length per side (Å) when the box is auto-computed | 20.0 |
| `ph` | Protonation pH | 7.4 |
| `cpu` | Number of CPU cores | 8 |
| `seed` | Random seed | 42 |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: verified by a real `delta-cli` invocation

- Projection content: best_score (total binding energy kcal/mol), per-term energy breakdown, box_size/center, mode=score_only
- Presentation form: Text (total binding energy + energy breakdown)
- Downstream reuse: -
## Output Template

- Title: **Vina single-pose scoring result**
- Lead with the conclusion: best_score (kcal/mol) and the box used (center/box_size)
- Give the energy breakdown (gauss/hydrophobic/hbond etc., restated per returned keys)

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).