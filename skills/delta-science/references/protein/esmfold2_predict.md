# Protein Structure Prediction (ESMFold2) (`huada_protein_tools` / `esmfold2_predict`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Predict the three-dimensional structure of protein/DNA/RNA/ligand complexes with
ESMFold2; supports combined prediction.
- Protein input: `protein_sequence` (sequence) / `sequence_file` (FASTA) — choose one
- Optional: `msa_file` (A3M), `dna_sequence` (DNA sequence), `rna_sequence` (RNA sequence), `ligand` (ligand CCD code or SMILES)
- Distinguish from Protenix: use ESMFold2 when DNA/RNA/ligand are involved; use Protenix for pure protein structure prediction
- Output: predicted structure CIF file `download_url`, confidence metrics `resultjson`

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint esmfold2_predict --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `protein_sequence` / `sequence_file`

Request fields:

| Field | Description | Default |
|---|---|---|
| `protein_sequence` |  | - |
| `sequence_file` | FASTA/FA | - |
| `msa_file` | A3M MSA | - |
| `dna_sequence` | DNA sequence, single str or list[str] | - |
| `rna_sequence` | RNA sequence, single str or list[str] | - |
| `ligand` | Small-molecule ligand: CCD code (e.g. ATP, MG) or SMILES string | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: verified by a real `delta-cli` invocation

- Projection content: Complex structure download_url (.cif, composition when protein+DNA/RNA/ligand) with confidence: plddt_mean, ptm, iptm, sequence_length
- Presentation form: Structure file link + confidence text
- Downstream reuse: structure can serve as downstream structure_file
## Output Template

- Title: **ESMFold2 structure prediction result**
- Lead with the conclusion: prediction done (complex composition, e.g. protein(47aa)+dna(12nt)) and confidence (plddt_mean/ptm/iptm), sequence_length
- Add the structure CIF link to the "Result files & downloads" section

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).