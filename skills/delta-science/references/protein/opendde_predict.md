# OpenDDE Co-folding Prediction (`protein_tools` / `opendde_predict`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

OpenDDE co-folding / structure prediction (synchronous wait; returns results and per-sample CIF links).
- Provide at least one chain: `protein_sequences[]` and/or `sequence_file` (FASTA), `dna_sequences[]`, `rna_sequences[]`
- `ligand`: comma-separated CCD codes or SMILES (optional)
- `sample` (int, default 2, range 1-7): number of diffusion samples (= number of output CIFs)
- `model` ("general"|"abag", default "general"): `abag` is antibody-antigen specific (protein-only, ≥2 chains)
- `use_msa` (bool, default false): protein MSA via network ColabFold (rate-limited)
- `use_template` (bool, default false): protein template search, requires `use_msa=true`
- `use_rna_msa` (bool, default false): RNA MSA (forces `use_msa=true`)

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint opendde_predict --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `protein_sequences` | List of protein sequences (multi-chain complex) | - |
| `sequence_file` | FASTA path/URL (.fa/.fasta/.faa), merged with protein_sequences when consistent | - |
| `dna_sequences` | List of DNA sequences | - |
| `rna_sequences` | List of RNA sequences | - |
| `ligand` | Comma-separated CCD codes or SMILES | - |
| `sample` | Diffusion sample count = output CIF count (1-7) | 2 |
| `model` | general (generic) | abag (antibody-antigen, protein-only ≥2 chains) | general |
| `use_msa` | Enable protein MSA (network ColabFold, rate-limited) | false |
| `use_template` | Enable protein template search (requires use_msa) | false |
| `use_rna_msa` | Enable RNA MSA (forces use_msa) | false |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`;
  the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`
  and `download_url`. `resultjson` may be a single object or an array — read only the keys
  documented in this file, do not recursively search.
- `resultjson`: `run_id`/`job_name`/`seed`/`model`/`sample` + `samples[]` each with `rank`/`cif_url`/`metrics`
  (metrics: `plddt`/`ptm`/`iptm`/`gpde`/`has_clash`/`disorder`/`ranking_score` and per-chain `chain_*`).
- `download_url` is empty; download CIFs from `resultjson.samples[].cif_url`.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Predicted structures: run_id/model/sample + samples[] (rank, cif_url, metrics: plddt/ptm/iptm/gpde/has_clash/disorder/ranking_score and per-chain metrics)
- Presentation form: Structure CIF link list + confidence text
- Downstream reuse: predicted cif_url can serve as downstream structure_file
## Output Template

- Title: **OpenDDE co-folding structure prediction result**
- Lead with the conclusion: number of samples and top-model confidence (plddt/ptm/iptm)
- Add each sample CIF link to the "Result files & downloads" section

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
