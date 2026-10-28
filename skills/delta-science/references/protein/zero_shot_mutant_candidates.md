# Zero-shot Mutant Candidate Prediction (`huada_protein_tools` / `zero_shot_mutant_candidates`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Zero-shot mutant candidate prediction: evaluate the benefit of single-site mutations
with pretrained models when no experimental data is available.
- Input: `protein_sequence` / `sequence_file` / `structure_file` (choose one)
- Optional: `chain` (A), `msa_file`, `model_name` (default ["esmc"]; options: esmc/esm2/saprot/thermompnn/protein_mpnn/soluble_mpnn)
- Output: mutation score results `download_url`, `resultjson`
- Use case: predicting beneficial mutations, optimizing protein stability
- Models that depend on a structure file: thermompnn/saprot/protein_mpnn/soluble_mpnn
- Model selection advice: thermostability → thermompnn; solubility → soluble_mpnn; activity → esmc/esm2/saprot.
- Input hints: "thermostability/stability" → `model_name` = `["thermompnn"]`; "solubility/soluble" → `["soluble_mpnn"]`; "activity" → `["esm2","esmc","saprot"]`.

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint zero_shot_mutant_candidates --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `protein_sequence` / `sequence_file` / `structure_file`

Server-side default parameters:

- `model_name` = `["esmc"]`

Request fields:

| Field | Description | Default |
|---|---|---|
| `protein_sequence` |  | - |
| `sequence_file` | FASTA/FA | - |
| `structure_file` | PDB/CIF | - |
| `chain` | Protein chain identifier, default A | A |
| `msa_file` | A3M MSA | - |
| `model_name` | Model name list, default ["esmc"] | ["esmc"] |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Mutant candidate summary: mutation (keep the tool's original notation), source model, score/confidence, recommendation/rationale; positions overlapping the active site are marked as not recommended
- Presentation form: Markdown table; score column names restated in natural language, not raw JSON key names
- Downstream reuse: result_files list -> summarize_result; ConSurf conservation / EasIFA active site / PubMed literature are annotations only, not recommendation criteria
## Output Template

- Title: **Zero-shot mutant candidate prediction result**
- Markdown table: `| Mutation | Source model | Score/confidence | Recommendation/rationale |`, keeping the tool's original mutation/model notation; column names adjustable per resultjson
- Positions overlapping the active site -> mark as "Overlaps active site, not recommended"; conservation is only a note in the rationale column
- If PubMed reports the mutation: note the PMID and distinguish "reported hotspot" / "new target not yet reported"
- Never invent evidence not present in the data; do not use raw JSON key names as body text

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).