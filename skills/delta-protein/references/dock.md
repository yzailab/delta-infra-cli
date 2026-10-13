# Molecular Docking (`huada_protein_tools` / `dock`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Protein-ligand molecular docking with AutoDock Vina.
- Input: `structure_file` (PDB/CIF) or `protein_sequence` (structure must be predicted first) / `sequence_file` (FASTA) — choose one
- `ligand_source`: ligand SMILES string or ligand file path (.sdf/.mol2/.txt). Optional; when missing, the backend returns a friendly hint and the request is still forwarded to the backend for handling
- Optional:
- `cofactor_mode` (str): "keep" or "remove", default "keep"
- `cofactors` (list[str]): cofactor/ligand residue names, e.g. ["ATP","MG"], default auto-handled
- `box_center` (str): manually specified docking box center, format "x,y,z"
- `box_size` (str): manually specified docking box size, a single number or "w,h,d"
- `ph` (float): protonation pH, default 7.4
- `exhaustiveness` (int): Vina search exhaustiveness, default 16
- `n_poses` (int): number of output poses, default 10
- `cpu` (int): number of CPU cores, default 8
- Box behavior: `box_center`/`box_size` can be given alone or together — when both are given they are used directly; when only `box_size` is given, the center is auto-detected by local p2rank (size uses this value, default 20Å); when neither is given, the backend tries the bounding box of the removed cofactor residues / p2rank auto-detected pockets in turn; with p2rank auto-detection each detected pocket is docked separately (one box per pocket, max 10 pockets by score); when p2rank finds no pocket it errors and box parameters must be provided manually
- Output: `download_url` is the multi-conformer PDB (docked_poses.pdb, merged across pockets, containing all pose MODELs) for visualization; each `resultjson` entry contains {affinity, rmsd_lb, rmsd_ub, pocket, pdb_url}; `pocket` identifies the associated pocket (p2rank's rank/name/score/center; {"rank": N} for a single box); `pdb_url` is provided only on the rank-1 entry, pointing to a single clean best-complex PDB (full receptor + ligand, ligand in chain L), suitable for PLIP interaction analysis

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint dock --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `protein_sequence` / `sequence_file` / `structure_file` / `ligand_source`

Request fields:

| Field | Description | Default |
|---|---|---|
| `protein_sequence` |  | - |
| `sequence_file` | FASTA/FA | - |
| `structure_file` | PDB/CIF | - |
| `ligand_source` | Ligand SMILES string or ligand file path (.sdf/.mol2/.txt); optional, backend returns a hint when missing | - |
| `cofactor_mode` | Cofactor handling mode, default "keep" | keep |
| `cofactors` | Cofactor/ligand residue name list, default None | - |
| `box_center` | Manually specified docking box center, format x,y,z | - |
| `box_size` | Manually specified docking box size, a single number or w,h,d | - |
| `ph` | Protonation pH, default 7.4 | 7.4 |
| `exhaustiveness` | Vina search exhaustiveness, default 16 | 16 |
| `n_poses` | Number of output poses, default 10 | 10 |
| `cpu` | Number of CPU cores, default 8 | 8 |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: verified by a real `delta-cli` invocation

- Projection content: affinity per pose (binding energy, kcal/mol), rmsd_lb/rmsd_ub, associated pocket; rank-1 carries pdb_url (clean complex); best score read from message or the minimal affinity
- Presentation form: Pose list text (affinity & RMSD) + multi-conformer PDB download link
- Downstream reuse: rank-1 pdb_url -> plip_analyze structure_file
## Output Template

- Title: **Molecular docking result**
- Lead with the conclusion: best score (best affinity, kcal/mol) and the associated pocket
- List poses sorted by score (affinity/rmsd_lb/rmsd_ub, mark the pocket when multiple pockets)
- Add the multi-conformer PDB to the "Result files & downloads" section; give rank-1 pdb_url separately (usable as PLIP input)

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).