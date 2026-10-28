# PubMed Literature Search (`huada_protein_tools` / `pubmed_search`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Call PubMed (NCBI) to search academic literature, supporting cascaded retrieval of
PMC/Europe PMC/OA PDF full texts. Various tasks may attempt to obtain relevant
information through literature search.
- `query` must be an English PubMed boolean search expression. If the user inputs
  Chinese, first translate the core concepts into English academic terms, then
  assemble them into a boolean expression. Recommended format:
  ("concept A" OR "synonym A2") AND ("concept B" OR "synonym B2") AND ... Split
  into 2-4 core concept groups, each with 2-4 English synonyms/related terms/MeSH
  terms; phrases wrapped in double quotes.
- Correct example: ("human enterokinase" OR "human enteropeptidase" OR
  "enterokinase catalytic subunit") AND (solubility OR "soluble expression") AND
  (mutation OR mutagenesis); when the user asks about "溶菌酶 活性位点" (lysozyme
  active site), the query should be ("lysozyme" OR "muramidase") AND ("active site"
  OR "catalytic site") AND (mutation OR mutagenesis).
- Forbidden: UniProt IDs, full English questions, meaningless words (analysis of /
  study of / improvement / optimization / design of / engineering of).
- Optional: `max_results` (default 10, max 10), `min_year` (default 2000),
  `max_year` (default 2026)
- Output: literature results `resultjson`

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint pubmed_search --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `query`

Request fields:

| Field | Description | Default |
|---|---|---|
| `query` | PubMed English boolean search expression; when the user inputs Chinese, provide the translated & expanded English boolean expression here, never pass Chinese | - |
| `max_results` | Maximum number of papers to return, default 10, max 10 | 10 |
| `min_year` | Start year, default 2000 | 2000 |
| `max_year` | End year, default 2026 | 2026 |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: extracted_papers and summary; table grouped by PMID (protein name, mutation (original notation), key finding, source reference)
- Presentation form: Markdown table; keep original mutation notation (e.g. Y126A/Y206F); site-level comparison only when zero-shot mutant results exist and the literature contains those mutations
- Downstream reuse: literature evidence can be cross-checked with zero_shot_mutant_candidates positions (note the PMID, distinguish reported hotspots/new targets)
## Output Template

- Title: **PubMed literature search result**
- Lead with a review summary: 4-6 bullet points depending on focus (mutation/engineering vs application/mechanism)
- Table grouped by PMID with the source reference in the last column (`PMID: XXXXXXXX`, fall back to the title when missing); keep original mutation notation
- Papers with empty mutations do not show mutation-related columns; site-level comparison only when zero-shot mutant results exist and the literature contains those mutations

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).