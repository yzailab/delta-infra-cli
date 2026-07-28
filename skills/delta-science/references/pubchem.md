# PubChem 详细规则

只能通过当前 Skill 目录下的 `scripts/invoke.py` 调用。wrapper 已解包服务
信封，因此以下文档所说的业务 `data` 在 wrapper 结果中就是 `result["native"]`
顶层；禁止再读取 `result["native"]["data"]`。本文件中的 URL 只用于说明 endpoint
schema，不授权直接 HTTP。普通名称基础查询只调用一次 `compound-summary`；多个名称
只调用一次 `compound-batch-summary`，默认 body 仅包含 `identifiers` 和
`namespace:"name"`，不得先调用 health/schema。

结果直接从 `native` 投影。批量记录位于 `native.results[*]`，原始标签在 `input`，
属性在嵌套 `properties`。SMILES 回退顺序固定为
`CanonicalSMILES -> ConnectivitySMILES -> SMILES -> IsomericSMILES`。
PubChem `XLogP` 与 RDKit `MolLogP` 不得互换；not_found 不得用本地计算补值。

Namespaces: `cid`, `name`, `smiles`, `inchi`, `inchikey`, `formula`.

## Health

operation：`health`，无 body。

## Resolve CIDs

operation：`compound-resolve-cids`。

```json
{"identifier": "aspirin", "namespace": "name", "max_records": 20}
```

`max_records`: 1-100.

## Properties

operation：`compound-properties`。

```json
{
  "identifier": "2244",
  "namespace": "cid",
  "properties": ["MolecularFormula", "MolecularWeight", "CanonicalSMILES", "IUPACName"]
}
```

Allowed properties include `MolecularFormula`, `MolecularWeight`,
`CanonicalSMILES`, `IsomericSMILES`, `SMILES`, `ConnectivitySMILES`,
`IUPACName`, `InChI`, `InChIKey`, `XLogP`, `TPSA`, `HBondDonorCount`,
`HBondAcceptorCount`, `RotatableBondCount`, `ExactMass`, `MonoisotopicMass`,
`Charge`, `HeavyAtomCount`, `Complexity`, `CovalentUnitCount`,
`DefinedAtomStereoCount`, `UndefinedAtomStereoCount`, `DefinedBondStereoCount`,
`UndefinedBondStereoCount`, and `IsotopeAtomCount`.

## Synonyms

operation：`compound-synonyms`。

```json
{"identifier": "2244", "namespace": "cid", "max_synonyms": 50}
```

`max_synonyms`: 1-500.

## Summary

operation：`compound-summary`。

```json
{
  "identifier": "aspirin",
  "namespace": "name",
  "properties": ["MolecularFormula", "MolecularWeight", "CanonicalSMILES", "IUPACName"],
  "synonym_limit": 20
}
```

`synonym_limit`: 0-100. Use this endpoint for general compound lookup because
it resolves CID, selected properties, and synonyms in one call.

Response fields include `valid`, `cid`, `properties`, `properties_raw`,
`aliases`, `synonyms`, and `metadata`. Numeric properties are coerced to JSON
numbers when possible. Requested SMILES aliases are filled when PubChem returns
an equivalent key such as `ConnectivitySMILES`.

## Batch Summary

operation：`compound-batch-summary`。

```json
{
  "identifiers": ["aspirin", "ibuprofen", "caffeine"],
  "namespace": "name",
  "properties": ["MolecularFormula", "MolecularWeight", "CanonicalSMILES", "XLogP", "TPSA"],
  "synonym_limit": 5
}
```

Limits: 1-100 identifiers. The response preserves input order and includes
per-item errors:

```json
{
  "valid": false,
  "namespace": "name",
  "properties_requested": ["CanonicalSMILES"],
  "results": [
    {
      "input": "aspirin",
      "valid": true,
      "cid": 2244,
      "properties": {
        "CanonicalSMILES": "CC(=O)Oc1ccccc1C(=O)O",
        "ConnectivitySMILES": "CC(=O)Oc1ccccc1C(=O)O",
        "_aliases": {"CanonicalSMILES": "ConnectivitySMILES"},
        "properties_raw": {}
      },
      "properties_raw": {},
      "aliases": {"CanonicalSMILES": "ConnectivitySMILES"},
      "synonyms": []
    },
    {
      "input": "bad-name",
      "valid": false,
      "error": "not found"
    }
  ],
  "count": 2,
  "failed_count": 1
}
```
