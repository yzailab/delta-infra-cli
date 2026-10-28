# Surface Residue Charge Analysis (`huada_protein_tools` / `surface_charge`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Analyze protein surface residue charges with ProCaliper + APBS.
- Required: `structure_file` (.pdb/.cif/.ent)
- Optional: `pH` (default 7.4), `forcefield` (default PARSE), `chain_ids` (e.g. 'A,B'),
  `sasa_threshold` (default 20.0 Å²), `potential_threshold` (default 1.0 kT/e), `precision` (standard/high)
- ProCaliper computes SASA + PROPKA pKa to determine surface/buried status and charge type; pH affects PDB2PQR protonation (APBS) and charge-type determination
- APBS solves the electrostatic potential .dx grid → maps it back to surface residues, identifying charge patches
- Use case: analyze protein surface electrostatic properties, identify charge patches, assist binding-interface analysis

This endpoint's `resultjson` is a flat structure (tested, not an analysis/visualization wrapper):

- `negative_surface` / `positive_surface` / `net_surface_charge`: negative/positive/net charge residue counts
- `patch_count` / `patches[]`: charge patches (non-empty only when APBS is available)
- `residues[]`: per residue `chain` / `res3` / `seq` / `sasa` / `pka` / `charge_type` /
  `is_surface` / `protonation_state` / `potential` / `potential_type` / `in_patch` / `patch_id`
- `sasa_threshold` / `surface_residues`: surface-determination threshold and surface residue count
- `pdb2pqr{pka_df[]}`: PROPKA pKa details; `procaliper{sasa, titration}`: SASA and titration state
- `apbs{status, message}`: electrostatic-potential solving status. When APBS is unavailable the overall
  `status` is `partial`, `message` notes the reason (e.g. `APBS executable 'apbs' not found. Set APBS_BIN.`),
  `potential` is null and `patch_count=0`; in that case report only the ProCaliper charge results and do
  not misreport it as a call failure
- `download_url`: the electrostatic potential `.dx` grid download link when APBS is available

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint surface_charge --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `structure_file`

Request fields:

| Field | Description | Default |
|---|---|---|
| `structure_file` | PDB/CIF | - |
| `pH` | pH value; affects APBS protonation and residue charge-type determination | 7.4 |
| `forcefield` | PDB2PQR forcefield | PARSE |
| `chain_ids` | Select chains in multi-chain structures, e.g. A,B; default all chains | - |
| `sasa_threshold` | Surface residue SASA threshold (Å²) | 20.0 |
| `potential_threshold` | Potential polarity threshold (kT/e) | 1.0 |
| `precision` | Grid precision: standard / high | standard |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: verified by a real `delta-cli` invocation

- Projection content: Charge summary: negative_surface / positive_surface / net_surface_charge / surface_residues / patch_count / patches; residues[] details (sasa/pka/charge_type/is_surface)
- Presentation form: Text/table; when APBS is unavailable status=partial — report only ProCaliper results and explain why; download_url is the .dx grid (when APBS available)
- Downstream reuse: -
## Output Template

- Title: **Surface residue charge analysis result (ProCaliper + APBS)**
- Lead with the conclusion: net charge (positive/negative/net_surface_charge), surface residue count, charge patch count
- List key surface positive/negative-charge residues (with pKa/sasa)
- When APBS is unavailable (status=partial) state plainly that electrostatics were not solved and report only ProCaliper results; add the .dx grid (if any) to the "Result files & downloads" section

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).