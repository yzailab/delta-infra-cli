# Residue Conservation Analysis (`huada_protein_tools` / `consurf_predict`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Compute protein residue conservation with ConSurf.
- Required: `structure_file` (.pdb/.cif)
- Required: `DB` (server-validated required; SWISS-PROT/UNIREF100, default UNIREF100 — but **must be passed explicitly**; omitting it returns a validation error)
- Optional: `chain` (A)
- Output: conservation results `resultjson`, `download_url`
- Use case: identify functionally important residues, conserved regions

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint consurf_predict --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `structure_file`

Request fields:

| Field | Description | Default |
|---|---|---|
| `structure_file` | PDB/CIF | - |
| `chain` | Protein chain identifier, default A | A |
| `DB` | Database: SWISS-PROT/UNIREF100. **Server-required** (defaults to UNIREF100 but errors when omitted — must be passed explicitly) | UNIREF100 |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: verified by a real `delta-cli` invocation

- Projection content: Conserved residue count and list (pos/seq/conserved_rank/conserved_score); presented grouped by conservation level
- Presentation form: Residue list; interpretation: lower conserved_score = more conserved, larger conserved_rank = more conserved
- Downstream reuse: conservation is only a reference annotation for the zero_shot_mutant_candidates recommendation rationale, not a recommendation criterion
## Output Template

- Title: **Residue conservation analysis result (ConSurf)**
- Interpretation: larger conserved_rank = more conserved (7/8/9 conserved, 1/2/3 variable); lower conserved_score = more conserved
- List positions grouped as conserved/variable (pos/residue/rank/score), explaining the functional or engineering significance of conserved/variable regions
- May provide conservation reference notes for the "Recommendation/rationale" column of zero_shot_mutant_candidates (annotation only, not a recommendation criterion)

## Boundaries & Failure Modes

- `DB` is a server-required field: omitting it returns a validation error (e.g. missing DB); always pass it explicitly, e.g. `--data '{"structure_file":...,"DB":"UNIREF100"}'`.
- General principle: fields marked as "default" in this package's references and ToolSpecs are fill-in conveniences for the backend agent orchestration layer; they are **NOT omissible when calling the CLI directly**; whatever the server actually validates is authoritative — when validation reports a missing field, supply it per the error and write it back into the reference.
- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).