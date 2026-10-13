# PubChem Compound Search (`huada_protein_tools` / `pubchem_search`)

This endpoint is a real endpoint of the `huada_protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list huada_protein_tools`; use them verbatim — never
guess, truncate, or alias.

## Overview

Call PubChem (NCBI) to search basic chemical molecule information.
- Supports querying compounds by name, SMILES, InChI, InChIKey, PubChem CID.
- `input_type` options: name (default) | smiles | inchi | inchikey | cid.
- `query` passes the corresponding identifier per input_type: name like "aspirin",
  SMILES like "CC(=O)OC1=CC=CC=C1C(=O)O", CID like "2244".
- Optional: `max_results` (default 10, max 100)
- Output: compound results `resultjson`, containing
  cid/name/molecular_formula/molecular_weight/canonical_smiles/inchi/inchikey/
  iupac_name/synonyms/pubchem_url

## Invocation

```text
delta-cli science invoke --tool huada_protein_tools --endpoint pubchem_search --data JSON
```

Required input groups (at least one per group; all groups must be satisfied):

- `query`

Request fields:

| Field | Description | Default |
|---|---|---|
| `query` | Query string: name, SMILES, InChI, InChIKey, or CID | - |
| `input_type` | Query type: name \| smiles \| inchi \| inchikey \| cid, default name | name |
| `max_results` | Maximum number of compounds to return, default 10, max 100 | 10 |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`, `download_url`; some endpoints also return `total_count`. `resultjson` may be a single object or an array — read only the keys documented in this file, do not recursively search.
- Binary/file artifacts (such as the PDB/XLSX/FASTA/ZIP files that `download_url` points to) are downloaded and verified with
  `delta-cli science file download --tool huada_protein_tools --endpoint ... --output <path>`;
  do not treat file contents as ordinary JSON results.

## Output Projection

> Verification status: verified by a real `delta-cli` invocation

- Projection content: Compound entries: name, synonyms, molecular_formula, molecular_weight, canonical_smiles, inchi, inchikey, cid, pubchem_url
- Presentation form: Text (formula/weight/name/SMILES) + entry URL
- Downstream reuse: canonical_smiles -> smiles / primary_smiles for catpred_predict / catapro_predict
## Output Template

- Title: **PubChem compound search**
- Lead with the conclusion: compound name, molecular formula, molecular weight
- Also give: canonical_smiles / InChIKey, cid, `[PubChem entry](pubchem_url)` (URL in a safe form)
- Avoid listing every JSON key

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`msa_file` etc.) take server-accessible URL/path strings, not local upload paths; a `download_url` or `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results; do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation timeouts (the outcome may be unknown because the task may already have happened).