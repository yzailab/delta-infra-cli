# Multiple Sequence Alignment Computation (`huada_protein_tools` / `generate_msa`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Compute a homolog protein MSA (A3M format) with MMseqs2 against the uniref100
database.
- Input: `protein_sequence` / `fasta_file` (choose one)
- Output: A3M MSA file `download_url`

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint generate_msa --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `protein_sequence` / `fasta_file`

Request fields:

| Field | Description | Default |
|---|---|---|
| `protein_sequence` |  | - |
| `fasta_file` | FASTA/FA | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Homolog MSA (A3M), download_url
- Presentation form: Download link; note MSA can be used for homology/conservation inference
- Downstream reuse: download_url -> msa_file for consensus_mutation / evcouplings_mutation / zero_shot_mutant_candidates
## Output Template

- Title: **Multiple sequence alignment (MSA) result**
- Lead with the conclusion: MSA computed, usable for homology and conservation inference
- Add the MSA file link to the "Result files & downloads" section and note it can serve as downstream msa_file

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).