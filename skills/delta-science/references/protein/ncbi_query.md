# NCBI E-utilities Query (`protein_tools` / `ncbi_query`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

Query NCBI databases via the official E-utilities. Supported actions (auto-normalized):
`einfo` (list) | `epost` (stage) | `esearch` (search) | `esummary` (summary) | `elink` (link) |
`efetch` (fetch) | `egquery` (distribution) | `espell` (spell-correct) | `ecitmatch` (citation match).
- `action` (required): one of the actions above
- `db`: NCBI database (protein/gene/snp/clinvar/taxonomy/mesh/assembly/sra/pubmed/pmc)
- `query`: keyword (esearch/espell) or ID list (esummary/efetch/elink/epost); citation line for ecitmatch
- `from` (elink only): source database (db_from) of the ID list
- `rettype` (efetch only): `fasta` returns raw FASTA (max 2 IDs); otherwise parsed records
- `web_env` / `query_key` (epost->esummary/efetch): session handle from a staged `epost`

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint ncbi_query --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `action` | E-utilities action: einfo/epost/esearch/esummary/elink/efetch/egquery/espell/ecitmatch | - |
| `db` | NCBI database (protein/gene/snp/clinvar/taxonomy/mesh/assembly/sra/pubmed/pmc) | - |
| `query` | Search keyword or ID list, per action semantics | - |
| `from` | Source database for elink (db_from) | - |
| `rettype` | efetch return type; `fasta` for raw FASTA | - |
| `web_env` | epost session handle (with query_key) | - |
| `query_key` | epost query key (with web_env) | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`;
  the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`
  and `download_url`. `resultjson` may be a single object or an array — read only the keys
  documented in this file, do not recursively search.
- `resultjson`: unified shell `action/db/db_from/query/count/ids/ids_text/records/remaining_ids/fasta/truncated`
  plus per-action extras (esearch `query_translation`, elink `link_names`, epost `web_env`/`query_key`,
  einfo `dblist`/`dbinfo`, egquery `dbcounts`/`term`, espell `corrected_query`/`suggestions`, ecitmatch `matched`/`unmatched`).
- `download_url` is always empty for this tool.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Unified E-utilities shell (action/db/count/ids/ids_text/records/fasta/truncated) plus per-action extras (esearch query_translation, epost web_env/query_key, einfo dblist, egquery dbcounts, etc.)
- Presentation form: Record/ID list text; FASTA inline when efetch returns sequences; truncation flagged
- Downstream reuse: retrieved sequences/IDs can feed downstream protein/sequence endpoints
## Output Template

- Title: **NCBI E-utilities query result**
- Lead with the conclusion: action/db and hit count; list IDs/records per the action
- Show efetch FASTA verbatim in a code block; note truncation when flagged
- Do not restate raw JSON key names as body text

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
