# RDKit reference

Call this tool only through `delta-cli science invoke`. Business responses are in the top-level
CLI `data`; read only the fields described here and do not search recursively. This document
records operation schemas and does not authorise direct HTTP access.

Make only the calls needed to meet the request. To validate, canonicalise and calculate basic
descriptors in one request, use `batch-parse-describe` with the `molecules:[{id,smiles}]` payload;
do not split it into parse and descriptors calls. For all-pairs similarity across multiple
molecules, use one `similarity-matrix` call. Its fixed ranking fields are `a`, `b` and
`similarity`, not `i`, `j` or `score`.

Report only descriptors actually present in the business response. When rendering a PNG, decode
only the field specified in the documentation and verify that the bytes begin with
`89 50 4e 47 0d 0a 1a 0a`; do not save a JSON envelope as an image.

## Health

Operation: `health`; no request body.

## Parse

Operation: `parse`.

```json
{"input": "CCO", "format": "smiles", "sanitize": true}
```

Formats: `smiles`, `inchi`, `molblock`.

Key response fields in `data`: `valid`, `canonical_smiles`, `formula`,
`molecular_weight`, `exact_molecular_weight`, `inchi_key`, `atom_count`,
`heavy_atom_count`, `bond_count`, `warnings`, `error`.

## Descriptors

Operation: `descriptors`.

```json
{"smiles": "CCO", "descriptor_set": "basic", "sanitize": true}
```

`descriptor_set` currently supports `basic`. Descriptor keys include `Formula`,
`MolWt`, `ExactMolWt`, `HeavyAtomMolWt`, `TPSA`, `MolLogP`, `NumHDonors`,
`NumHAcceptors`, `NumRotatableBonds`, `RingCount`, `FractionCSP3`,
`HeavyAtomCount`, `AtomCount`, and `BondCount`.

## Batch Descriptors

Operation: `batch-descriptors`.

```json
{"smiles": ["CCO", "c1ccccc1"], "descriptor_set": "basic", "sanitize": true}
```

Limits: 1-500 SMILES.

## Batch Parse Describe

Operation: `batch-parse-describe`.

```json
{
  "molecules": [
    {"id": "aspirin", "smiles": "CC(=O)Oc1ccccc1C(=O)O"},
    {"id": "caffeine", "smiles": "Cn1cnc2c1c(=O)n(C)c(=O)n2C"}
  ],
  "descriptor_set": "basic",
  "fingerprint": {"type": "morgan", "radius": 2, "n_bits": 2048},
  "sanitize": true
}
```

Limits: 1-500 molecules. Returns per-item `valid`, `canonical_smiles`, parse
fields, `descriptors`, optional `fingerprint_metadata`, `on_bits`, `bit_count`,
`warnings`, and `error`.

## Render

Operation: `render`.

```json
{"smiles": "CCO", "image_format": "svg", "width": 450, "height": 320}
```

Image formats: `svg`, `png`. SVG returns text; PNG returns base64.
Width/height range: 150-2000.

## Fingerprint

Operation: `fingerprint`.

```json
{"smiles": "CCO", "radius": 2, "n_bits": 2048}
```

Morgan fingerprint parameters: `radius` 1-6, `n_bits` 128-8192.

## Similarity

Operation: `similarity`.

```json
{"query_smiles": "CCO", "target_smiles": "CCCO", "radius": 2, "n_bits": 2048}
```

Returns Tanimoto similarity.

## Similarity Matrix

Operation: `similarity-matrix`.

```json
{
  "molecules": [
    {"id": "aspirin", "smiles": "CC(=O)Oc1ccccc1C(=O)O"},
    {"id": "ibuprofen", "smiles": "CC(C)Cc1ccc(cc1)[C@@H](C)C(=O)O"}
  ],
  "fingerprint": {"type": "morgan", "radius": 2, "n_bits": 2048},
  "sanitize": true
}
```

Returns `matrix` in input order and `ranked_pairs` sorted by descending
Tanimoto similarity. Each ranked record is named, not index-based:

```json
{"a":"aspirin","b":"ibuprofen","similarity":0.195122}
```

Do not expect `i`, `j`, or `score` fields.

## Substructure

Operation: `substructure`.

```json
{"query_smarts": "c1ccccc1", "target_smiles": ["c1ccccc1", "CCO"]}
```

Limits: SMARTS max length 5000; target list size 1-500.
