# PISA Protein Interface Analysis (`huada_protein_tools` / `pisa_query`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Query PDBePISA for protein interface analysis data.
- Input (choose one):
- `pdb_id`: PDB ID (e.g. 1B9E, 3WWJ, or the newer pdb_xxxxxxxx format)
- `structure_file`: local/remote protein structure file path or URL (.pdb/.cif)
- Processing path: `pdb_id` and `structure_file` both go through the PDBe new REST API (upload → submit → poll → filter p_value<0.5); plain HTTP, no browser
- Output:
- `resultjson`: {n_interfaces, interfaces[]} (filtered to p_value<0.5), each interface contains
  interface_id / interface_area / solvation_energy / stabilization_energy /
  p_value / n_interface_residues / n_hydrogen_bonds / n_salt_bridges /
  n_other_bonds / residues (interface residues only, split across the two sides) / hydrogen_bonds / salt_bridges
- `download_url`: download link for the full interface JSON (same structure as resultjson; residues keep details such as buried_surface_area)
- Use case: analyze protein complex interface stability, identify key interface residues

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint pisa_query --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `pdb_id` / `structure_file`

Request fields:

| Field | Description | Default |
|---|---|---|
| `pdb_id` | PDB ID (e.g. 1B9E, 3WWJ or pdb_xxxxxxxx), mutually exclusive with structure_file | - |
| `structure_file` | PDB/CIF | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: verified by a real `delta-cli` invocation

- Projection content: n_interfaces and per interface: interface_id, interface_area, solvation_energy, stabilization_energy, p_value, hydrogen_bonds, salt_bridges, n_interface_residues, key interface residues
- Presentation form: Interface summary text/table + full JSON download link
- Downstream reuse: key interface residues can be used for interaction annotation
## Output Template

- Title: **PISA protein interface analysis result**
- Lead with the conclusion: number of interfaces (n_interfaces) and stability (p_value/stabilization energy)
- Per interface give interface_area, solvation/stabilization energy, p_value, hydrogen bond/salt bridge counts, n_interface_residues, key interface residues
- Add the full interface JSON to the "Result files & downloads" section

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).