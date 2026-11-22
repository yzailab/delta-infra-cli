# Format Conversion — OpenBabel (`protein_tools` / `obabel_convert`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

Convert among sdf/mol/mol2/pdb/pdbqt/smi/cif with OpenBabel.
- `source` (required): molecule file URL/path, or a SMILES string (files: sdf/mol/mol2/pdb/pdbqt/smi/cif/mmcif or .txt of one SMILES)
- `output_format` (required): sdf/mol/mol2/pdb/pdbqt/smi/cif
- `input_format` (optional): input format when the path has no suffix, or `smiles` for a SMILES string
- `ph` (optional): protonate at this pH (-p)
- `gen3d` (optional): generate 3D coordinates (--gen3d); defaults true only for SMILES→coordinate format
- `rigid_receptor` (bool, default false): write rigid receptor PDBQT (-xr), only valid for pdbqt output

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint obabel_convert --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `source` | Molecule file URL/path, or a SMILES string | - |
| `output_format` | sdf/mol/mol2/pdb/pdbqt/smi/cif | - |
| `input_format` | Input format when path has no suffix, or `smiles` | - |
| `ph` | Protonate at this pH (-p) | - |
| `gen3d` | Generate 3D coordinates (--gen3d) | auto |
| `rigid_receptor` | Write rigid receptor PDBQT (-xr), pdbqt only | false |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`;
  the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`
  and `download_url`. `resultjson` may be a single object or an array — read only the keys
  documented in this file, do not recursively search.
- `resultjson`: `input_format`/`output_format`/`preview`/`warnings`; `download_url`: converted file.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Converted file + metadata (input_format/output_format/preview/warnings); download_url is the converted file
- Presentation form: Conversion summary + download link
- Downstream reuse: converted file can feed downstream file inputs
## Output Template

- Title: **OpenBabel format conversion result**
- Lead with the conclusion: source -> output_format conversion done
- Add the converted file to the "Result files & downloads" section; note warnings when present

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
