# BLAST Sequence Search (`protein_tools` / `blast_search`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

Search sequences against NCBI BLAST databases.
- `protein_sequence` (plain/multi-FASTA text) or `fasta_file` (URL/path) — provide one
- `program` (default "blastp"): blastp/blastn/blastx/tblastn/tblastx
- `database` (default "swissprot"): swissprot/nr/pdb/refseq_protein/env_nr/nt/refseq_rna/env_nt
- `expect` (default 10): E-value threshold
- `hitlist_size` (default 10, 1-100): max hits returned

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint blast_search --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `protein_sequence` | Query sequence(s); plain sequence or multi-FASTA text | - |
| `fasta_file` | FASTA file URL/path (may hold multiple sequences) | - |
| `program` | blastp/blastn/blastx/tblastn/tblastx | blastp |
| `database` | swissprot/nr/pdb/refseq_protein/env_nr/nt/refseq_rna/env_nt | swissprot |
| `expect` | E-value threshold | 10 |
| `hitlist_size` | Max hits returned (1-100) | 10 |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`;
  the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`
  and `download_url`. `resultjson` may be a single object or an array — read only the keys
  documented in this file, do not recursively search.
- `total_count`: number of hits; `resultjson`: hit list (accession/title/evalue/identity/alignment);
  `download_url`: Excel result file.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: BLAST hits (accession/title/evalue/identity/alignment), total_count; download_url is the Excel
- Presentation form: Hit table + Excel download link
- Downstream reuse: -
## Output Template

- Title: **BLAST search result**
- Lead with the conclusion: hit count and top hits (accession/title/evalue/identity)
- Add the Excel to the "Result files & downloads" section

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
