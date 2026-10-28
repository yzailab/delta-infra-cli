# PLIP Protein-Ligand Interaction Analysis (`huada_protein_tools` / `plip_analyze`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Analyze interactions between a protein and a ligand with PLIP.
- Input: `structure_file` (PDB/CIF file URL)
- Optional:
- `ligand_id`: ligand identifier, e.g. "LIG" or "A:LIG:301"; leave empty and PLIP auto-detects the largest ligand
- `interaction_types`: list of interaction types to return, e.g. ["hydrogen_bonds", "hydrophobic_interactions"]
- Output: interaction results `resultjson`, `summary`, `download_url`
- Use case: identify protein-ligand interactions such as hydrogen bonds, hydrophobic contacts, salt bridges, pi-pi stacking, halogen bonds, metal coordination

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint plip_analyze --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `structure_file`

Request fields:

| Field | Description | Default |
|---|---|---|
| `structure_file` | PDB/CIF | - |
| `ligand_id` | Ligand identifier, e.g. LIG or A:LIG:301; empty = auto-detect | - |
| `interaction_types` | List of interaction types to return; default returns all | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Protein-ligand interactions: hydrogen bonds, hydrophobic contacts, salt bridges, pi-pi stacking etc. + summary + download_url
- Presentation form: Interaction-category text/table + links
- Downstream reuse: input is often the rank-1 pdb_url returned by dock
## Output Template

- Title: **PLIP protein-ligand interaction analysis result**
- Lead with the conclusion: detected interaction categories (hydrogen bond/hydrophobic/salt bridge/pi-pi/halogen/metal coordination) and key residues
- Add result files and visualizations to the "Result files & downloads" section; note the source structure when the input came from dock

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).