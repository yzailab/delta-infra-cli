# Molecule Enrichment 详细规则

这是一个由 Science Server 编排的联合 workflow：先用 PubChem 批量解析输入，再按服务
返回的 SMILES 回退顺序调用 RDKit 批量解析/描述符/指纹。它适合用户明确要求“一次拿到
身份信息和结构计算结果”的场景；推荐结果仍只来自当前 CLI 业务响应。

当前 Science Server 的注册标签是 `chemistry`，operation 是 `molecule.enrich`。实际
名称必须以当前 catalog 返回值为准；该 operation 的存在不能通过直接访问
`/chem/molecule/enrich` 推断或替代。所有调用都使用：

```text
delta-cli science invoke --tool chemistry --endpoint molecule.enrich --data JSON
```

## Request

请求体：

```json
{
  "inputs": ["aspirin", "caffeine"],
  "namespace": "name",
  "pubchem": {
    "properties": ["MolecularFormula", "MolecularWeight", "CanonicalSMILES"],
    "synonym_limit": 5
  },
  "rdkit": {
    "descriptors": true,
    "canonicalize": true,
    "fingerprint": {"type": "morgan", "radius": 2, "n_bits": 2048},
    "sanitize": true
  }
}
```

`inputs` 接受 1–100 个字符串；`namespace` 为 `cid`、`name`、`smiles`、`inchi`、
`inchikey` 或 `formula`。`pubchem.properties` 和 `synonym_limit` 遵循 PubChem reference。
RDKit 默认执行 descriptors、canonicalize 和 sanitize；`fingerprint` 可为 `false` 或
Morgan 配置对象，radius 为 1–6，n_bits 为 128–8192。不要把一个服务的字段名改写成
另一个服务的字段名。

## Result

成功业务结果通常包含 `valid`、`count`、`failed_count`、`results`、`warnings` 和
`metadata`。每个 `results[*]` 保留：

- 原始输入 `input`；
- PubChem 的 `valid`、`cid`、`smiles`、`formula`、`properties`、`aliases`、`synonyms`
  和 `error`；
- 可选 RDKit 的 `valid`、`canonical_smiles`、`descriptors`、`fingerprint_metadata`、
  `on_bits`、`bit_count`、`warnings` 和 `error`。

SMILES 回退顺序固定为 `CanonicalSMILES -> ConnectivitySMILES -> SMILES ->
IsomericSMILES`。PubChem 没有可用 SMILES，或 RDKit 失败时，该条记录保持无效并计入
`failed_count`；不要用本地 RDKit/PubChem 或人工字符串补齐。

只要用户需要单一中间结果，就不要为了使用 workflow 额外调用另一服务。不要主动调用
health 或保存文件；用户明确要求图片时仍单独使用 RDKit `render`，不要把本 workflow 的
描述符响应当成图像。
