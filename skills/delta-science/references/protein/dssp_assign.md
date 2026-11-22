# Secondary Structure — DSSP (`protein_tools` / `dssp_assign`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

Annotate secondary structure with PyDSSP and generate a ribbon diagram.
- `structure_file` (required): local .pdb/.ent/.cif path, HTTP(S) URL, or 4-char PDB ID
- `chain` (optional): chain ID; omit to assign every protein chain on one ribbon

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint dssp_assign --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `structure_file` | Structure .pdb/.ent/.cif path/URL or 4-char PDB ID | - |
| `chain` | Chain ID (omit to assign all chains) | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`;
  the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`
  and `download_url`. `resultjson` may be a single object or an array — read only the keys
  documented in this file, do not recursively search.
- `resultjson`: per-chain `sequence`/`ss` (H/E/-)/`summary`/`segments`; `warnings` for skipped residues
  or discontinuous numbering; `download_url`: ribbon diagram image.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Per-chain secondary structure: sequence, ss (H/E/-), summary, segments; warnings for skipped residues
- Presentation form: Secondary-structure summary text/table + ribbon image link
- Downstream reuse: -
## Output Template

- Title: **DSSP secondary structure annotation result**
- Lead with the conclusion: per-chain secondary structure summary (helices/sheets/coil)
- Add the ribbon diagram to the "Result files & downloads" section when present

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
