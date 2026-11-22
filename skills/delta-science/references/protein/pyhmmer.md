# Family Classification & Alignment — PyHMMER (`protein_tools` / `pyhmmer`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

PyHMMER classify_align: given sequences, classify the protein family, extract the family HMM and align to an MSA
(in-process synchronous).
- `sequences`: `{"content": <FASTA text>}` or `{"path": <path/URL>}`
- `trim` (bool, default false): trim non-core N/C terminal residues
- `all_consensus_cols` (bool, default true): keep one column per consensus column
- `cpus` (int, default 1): worker threads
- `preview` (int, default 3): aligned preview rows returned
- `E` / `domE` (optional): classification / domain report E-value thresholds

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint pyhmmer --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `sequences` | Object: content (FASTA text) or path (path/URL) | - |
| `trim` | Trim non-core N/C terminal residues | false |
| `all_consensus_cols` | Keep one column per consensus column | true |
| `cpus` | Worker threads | 1 |
| `preview` | Aligned preview rows returned | 3 |
| `E` | Classification report E-value threshold | - |
| `domE` | Domain report E-value threshold | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status`, `message`, `tool_type`, `resultjson` and `download_urls[]` (list of output files).

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Protein family classification + HMM extraction + hmmalign MSA; resultjson holds classification/alignment summary; download_urls[] are output files
- Presentation form: Classification summary text + download link list
- Downstream reuse: aligned MSA can serve as downstream msa_file
## Output Template

- Title: **PyHMMER family classification & alignment (pyhmmer)**
- Lead with the conclusion: classified family and alignment summary
- Add each output file from download_urls[] to the "Result files & downloads" section

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
