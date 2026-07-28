# RDKit 详细规则

只能通过当前 Skill 目录下的 `scripts/invoke.py` 调用。wrapper 已解包服务
信封，因此以下业务响应在 wrapper 结果中位于 `result["native"]` 顶层；禁止读取
`result["native"]["data"]`。这里只记录 operation schema，不授权直接 HTTP。

一个请求只执行完成目标所需的最少调用。同时校验、规范化并计算基础描述符时使用一次
`batch-parse-describe`，payload 使用 `molecules:[{id,smiles}]`，不得拆成 parse 和
descriptors。多个分子的全对相似度使用一次 `similarity-matrix`；排名字段固定为
`a`、`b`、`similarity`，不是 `i`、`j`、`score`。

只报告 native 实际存在的描述符。渲染 PNG 时只解码文档指定字段，并验证字节以
`89 50 4e 47 0d 0a 1a 0a` 开头；不得把 JSON envelope 保存成图片。

## Health

operation：`health`，无 body。

## Parse

operation：`parse`。

```json
{"input": "CCO", "format": "smiles", "sanitize": true}
```

Formats: `smiles`, `inchi`, `molblock`.

Key response fields in `data`: `valid`, `canonical_smiles`, `formula`,
`molecular_weight`, `exact_molecular_weight`, `inchi_key`, `atom_count`,
`heavy_atom_count`, `bond_count`, `warnings`, `error`.

## Descriptors

operation：`descriptors`。

```json
{"smiles": "CCO", "descriptor_set": "basic", "sanitize": true}
```

`descriptor_set` currently supports `basic`. Descriptor keys include `Formula`,
`MolWt`, `ExactMolWt`, `HeavyAtomMolWt`, `TPSA`, `MolLogP`, `NumHDonors`,
`NumHAcceptors`, `NumRotatableBonds`, `RingCount`, `FractionCSP3`,
`HeavyAtomCount`, `AtomCount`, and `BondCount`.

## Batch Descriptors

operation：`batch-descriptors`。

```json
{"smiles": ["CCO", "c1ccccc1"], "descriptor_set": "basic", "sanitize": true}
```

Limits: 1-500 SMILES.

## Batch Parse Describe

operation：`batch-parse-describe`。

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

operation：`render`。

```json
{"smiles": "CCO", "image_format": "svg", "width": 450, "height": 320}
```

Image formats: `svg`, `png`. SVG returns text; PNG returns base64.
Width/height range: 150-2000.

## Fingerprint

operation：`fingerprint`。

```json
{"smiles": "CCO", "radius": 2, "n_bits": 2048}
```

Morgan fingerprint parameters: `radius` 1-6, `n_bits` 128-8192.

## Similarity

operation：`similarity`。

```json
{"query_smiles": "CCO", "target_smiles": "CCCO", "radius": 2, "n_bits": 2048}
```

Returns Tanimoto similarity.

## Similarity Matrix

operation：`similarity-matrix`。

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

operation：`substructure`。

```json
{"query_smarts": "c1ccccc1", "target_smiles": ["c1ccccc1", "CCO"]}
```

Limits: SMARTS max length 5000; target list size 1-500.
