# Antibody Design — RFantibody (`protein_tools` / `rfantibody_predict`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

RFantibody antibody design pipeline (rfdiffusion → ProteinMPNN → RF2).
- `pdb_files` (required): two PDB paths/URLs (one antibody framework + one antigen, order irrelevant)
- `num_designs` (optional): rfdiffusion scaffold count
- `design_loops` (optional): loop regions, e.g. `H1:,H2:,H3:,L1:,L2:,L3:`
- `hotspots` (optional): hotspot residues, e.g. `A305,A456`
- `diffuser_t` / `final_step` (optional): rfdiffusion time/start steps
- `deterministic` / `no_trajectory` (optional): rfdiffusion flags
- `proteinmpnn` / `rf2` (optional): sub-stage parameter objects

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint rfantibody_predict --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `pdb_files` | Two PDB paths/URLs (antibody framework + antigen) | - |
| `num_designs` | rfdiffusion scaffold count | - |
| `design_loops` | Loop regions, e.g. H1:,H2:,H3:,L1:,L2:,L3: | - |
| `hotspots` | Hotspot residues, e.g. A305,A456 | - |
| `diffuser_t` | rfdiffusion diffusion time steps | - |
| `final_step` | rfdiffusion start denoise step | - |
| `deterministic` | Deterministic diffusion flag | - |
| `no_trajectory` | Disable trajectory output flag | - |
| `proteinmpnn` | ProteinMPNN sub-stage parameters (object) | - |
| `rf2` | RF2 folding sub-stage parameters (object) | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`;
  the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`
  and `download_url`. `resultjson` may be a single object or an array — read only the keys
  documented in this file, do not recursively search.
- `resultjson`: design results (`tag`/`metrics`/`pdb_url`) and run metadata; `download_url`: `results.qv` package.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Antibody design results (tag/metrics/pdb_url) and run metadata; download_url is the results.qv package
- Presentation form: Design summary text + downloadable results
- Downstream reuse: designed pdb_url can feed downstream structure endpoints
## Output Template

- Title: **Antibody design result (RFantibody)**
- Lead with the conclusion: number of designs and key metrics
- Add the results.qv download to the "Result files & downloads" section

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
