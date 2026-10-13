# Protein Tunnel/Channel Analysis (`huada_protein_tools` / `caver_tunnel_analyze`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Analyze protein internal tunnels and channels with CAVER 3.x.
- Required: `structure_file` (PDB/CIF URL, local path, or 4-character PDB ID; never pass FASTA/raw sequences)
- Optional: `probe_radius` (probe radius Å; when omitted, the server-side default is used)
- The tunnel start is auto-predicted by PrankWeb (center of the top-ranked pocket); no manual specification needed
- Output: tunnel analysis results, visualization/download links
- Use case: structural analysis such as enzyme active-site channels, ligand entry/exit pathways

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint caver_tunnel_analyze --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `structure_file`

Request fields:

| Field | Description | Default |
|---|---|---|
| `structure_file` | 3D protein structure: PDB/CIF URL, local path, or 4-character PDB ID; never pass FASTA/raw sequences | - |
| `probe_radius` | Probe radius (Å); when omitted the server-side config.yaml default is used | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Tunnel/channel location, length, bottleneck residues + visualization/download links
- Presentation form: Text/table + links
- Downstream reuse: -
## Output Template

- Title: **Protein tunnel/channel analysis result (CAVER)**
- Lead with the conclusion: tunnel/channel location, length, bottleneck residues
- Add visualization outputs to the "Result files & downloads" section

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).