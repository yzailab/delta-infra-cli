# ProTrek API Search (`huada_protein_tools` / `protrek_search`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Open-ended protein retrieval (text/sequence/structure) across multiple databases
with the ProTrek protein search API.
- Typical scenarios:
- Search related proteins by functional/reaction/family descriptions in protein
  databases (`input_type=text`).
- Search similar proteins by sequence (`input_type=sequence`).
- Search similar structures by structure (`input_type=structure`).
- Not for: exact metadata queries of a known UniProt accession / UniParc ID / gene
  name / protein name (use `uniprot_query` for those).
- Optional parameters: `input_type` (text/sequence/structure), `query_type`
  (sequence/structure), `topk` (10), `db` (Swiss-Prot), `protein_sequence`,
  `sequence_file`, `structure_file`, `chain` (A), `text`
- `query_type` defaults to `sequence`;
- when the user mentions "structure search / structure / 3D structure", choose `structure`;
- `input_type` is inferred from whether a sequence/structure file is provided; when
  neither is provided, `input_type` is `text`;
- the `text` parameter is specifically for functional/reaction/family
  description-style text searches;
- Supported databases: with `query_type=sequence`, Swiss-Prot/UniRef50/Uncharacterized/OMG_prot50/PDB/GOPC/NCBI/MGnify/OMG are supported; with `query_type=structure`, only PDB

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint protrek_search --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `protein_sequence` / `sequence_file` / `structure_file` / `text`

Server-side default parameters:

- `input_type` = `sequence`
- `query_type` = `sequence`
- `topk` = `10`
- `db` = `Swiss-Prot`

Request fields:

| Field | Description | Default |
|---|---|---|
| `input_type` | Input type: text/sequence/structure; inferred from whether a sequence/structure file is provided, text when neither | sequence |
| `query_type` | Query type: sequence/structure; default sequence; choose structure when "structure search" is mentioned | sequence |
| `topk` | Number of results to return, default 10 | 10 |
| `db` | Database name or list, default Swiss-Prot; with query_type=sequence supports ['Swiss-Prot', 'UniRef50', 'Uncharacterized', 'OMG_prot50', 'PDB', 'GOPC', 'NCBI', 'MGnify', 'OMG']; with query_type=structure only PDB | Swiss-Prot |
| `protein_sequence` |  | - |
| `sequence_file` | FASTA/FA | - |
| `structure_file` | PDB/CIF | - |
| `chain` | Protein chain identifier, default A | A |
| `text` | Core search description when input_type=text, e.g. function/reaction/family; translate to English | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Hit protein entries, similarity and functional information
- Presentation form: Hit list text/table
- Downstream reuse: for known targets with metadata use uniprot_query; this endpoint is for open-ended retrieval
## Output Template

- Title: **ProTrek database search result**
- Lead with the conclusion: number of hit protein entries; list similarity per hit (score vs query) and functional information
- For structure/sequence search, state the retrieval mode (query_type/input_type)

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).