# RDKit Endpoint Reference

在 Memento 中只能通过 `delta-science/scripts/invoke.py` 调用。wrapper 已解包服务
信封，因此以下业务响应在 wrapper 结果中位于 `result["native"]` 顶层；禁止读取
`result["native"]["data"]`。本文件中的 URL 只说明 schema，不授权直接 HTTP。

All paths are relative to `http://111.2.199.31:52317/api/v1`.

## Health

`GET /chem/rdkit/health`

## Parse

`POST /chem/rdkit/parse`

```json
{"input": "CCO", "format": "smiles", "sanitize": true}
```

Formats: `smiles`, `inchi`, `molblock`.

Key response fields in `data`: `valid`, `canonical_smiles`, `formula`,
`molecular_weight`, `exact_molecular_weight`, `inchi_key`, `atom_count`,
`heavy_atom_count`, `bond_count`, `warnings`, `error`.

## Descriptors

`POST /chem/rdkit/descriptors`

```json
{"smiles": "CCO", "descriptor_set": "basic", "sanitize": true}
```

`descriptor_set` currently supports `basic`. Descriptor keys include `Formula`,
`MolWt`, `ExactMolWt`, `HeavyAtomMolWt`, `TPSA`, `MolLogP`, `NumHDonors`,
`NumHAcceptors`, `NumRotatableBonds`, `RingCount`, `FractionCSP3`,
`HeavyAtomCount`, `AtomCount`, and `BondCount`.

## Batch Descriptors

`POST /chem/rdkit/batch-descriptors`

```json
{"smiles": ["CCO", "c1ccccc1"], "descriptor_set": "basic", "sanitize": true}
```

Limits: 1-500 SMILES.

## Batch Parse Describe

`POST /chem/rdkit/batch-parse-describe`

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

`POST /chem/rdkit/render`

```json
{"smiles": "CCO", "image_format": "svg", "width": 450, "height": 320}
```

Image formats: `svg`, `png`. SVG returns text; PNG returns base64.
Width/height range: 150-2000.

## Fingerprint

`POST /chem/rdkit/fingerprint`

```json
{"smiles": "CCO", "radius": 2, "n_bits": 2048}
```

Morgan fingerprint parameters: `radius` 1-6, `n_bits` 128-8192.

## Similarity

`POST /chem/rdkit/similarity`

```json
{"query_smiles": "CCO", "target_smiles": "CCCO", "radius": 2, "n_bits": 2048}
```

Returns Tanimoto similarity.

## Similarity Matrix

`POST /chem/rdkit/similarity-matrix`

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

`POST /chem/rdkit/substructure`

```json
{"query_smarts": "c1ccccc1", "target_smiles": ["c1ccccc1", "CCO"]}
```

Limits: SMARTS max length 5000; target list size 1-500.
