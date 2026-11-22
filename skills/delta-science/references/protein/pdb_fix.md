# PDB Repair — PDBFixer (`protein_tools` / `pdb_fix`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

Repair a protein structure with PDBFixer (missing heavy atoms, nonstandard residues).
- `structure_file` (required): URL/local path (.pdb/.cif/.mmcif) or a 4-char PDB ID
- `chain` (optional): keep only this chain; omit to keep every chain

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint pdb_fix --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `structure_file` | Structure URL/path (.pdb/.cif/.mmcif) or 4-char PDB ID | - |
| `chain` | Chain to keep (omit to keep all) | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`;
  the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`
  and `download_url`. `resultjson` may be a single object or an array — read only the keys
  documented in this file, do not recursively search.
- `resultjson`: repair summary (missing atoms, nonstandard residues replaced, waters removed);
  `download_url`: repaired PDB.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Repair summary: missing atoms, nonstandard residues replaced, waters removed; download_url is the repaired PDB
- Presentation form: Summary text + repaired PDB download link
- Downstream reuse: repaired PDB can serve as downstream structure_file
## Output Template

- Title: **PDB repair result (PDBFixer)**
- Lead with the conclusion: what was fixed (missing atoms / nonstandard residues / waters)
- Add the repaired PDB to the "Result files & downloads" section

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
