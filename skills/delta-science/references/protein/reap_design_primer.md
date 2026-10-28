# Single-site Mutation Primer Design (`huada_protein_tools` / `reap_design_primer`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

REAP Step 7: design overlapping PCR site-directed mutagenesis primers for single-site
mutations.
- Required: `mutant_list_file` (Excel/CSV with a mutant column)
- Required: `plasmid_fasta` (user-uploaded DNA FASTA template)
- Required: `cds_start` (0-based CDS start in `plasmid_fasta`; needs to be extracted from the user's question)
- Optional: `mutation_format` (protein default A123C / dna → G367A), `codon_pref_file`, `sheet`
- Output: primer Excel `download_url`, ZIP `zip_download_url`, `resultjson` (primer preview and Tm)

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint reap_design_primer --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `mutant_list_file` **and** `template_file` / `plasmid_fasta`

Request fields:

| Field | Description | Default |
|---|---|---|
| `mutant_list_file` | Excel/CSV/TXT mutation list | - |
| `template_file` | Segmented template TXT (upstream/gene/downstream) | - |
| `plasmid_fasta` | Plasmid/template DNA FASTA | - |
| `cds_start` | 0-based CDS start position in plasmid_fasta mode | - |
| `mutation_format` | Mutation format: protein or dna, default protein | protein |
| `codon_pref_file` | AA:CODON codon preference file | - |
| `sheet` | Excel sheet index or name, default 0 | 0 |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Primer design table (mutation id, forward/reverse primer sequences, Tm) + Excel download_url + ZIP zip_download_url
- Presentation form: Markdown table + Excel/ZIP download links
- Downstream reuse: -
## Output Template

- Title: **Single-site mutation primer design result (REAP Step 7)**
- Markdown table: `| Mutation ID | Forward primer | Reverse primer | Tm |`
- Add the Excel and ZIP to the "Result files & downloads" section

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).