# PubChem Endpoint Reference

在 Memento 中只能通过 `delta-science/scripts/invoke.py` 调用。wrapper 已解包服务
信封，因此以下文档所说的业务 `data` 在 wrapper 结果中就是 `result["native"]`
顶层；禁止再读取 `result["native"]["data"]`。本文件中的 URL 只用于说明 endpoint
schema，不授权直接 HTTP。

All paths are relative to `http://111.2.199.31:52317/api/v1`.

Namespaces: `cid`, `name`, `smiles`, `inchi`, `inchikey`, `formula`.

## Health

`GET /chem/pubchem/health`

## Resolve CIDs

`POST /chem/pubchem/compound/resolve-cids`

```json
{"identifier": "aspirin", "namespace": "name", "max_records": 20}
```

`max_records`: 1-100.

## Properties

`POST /chem/pubchem/compound/properties`

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

`POST /chem/pubchem/compound/synonyms`

```json
{"identifier": "2244", "namespace": "cid", "max_synonyms": 50}
```

`max_synonyms`: 1-500.

## Summary

`POST /chem/pubchem/compound/summary`

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

`POST /chem/pubchem/compound/batch-summary`

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
