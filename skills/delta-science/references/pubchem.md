# PubChem reference

Call this tool only through `delta-cli science invoke`. Business responses are in the top-level
CLI `data`; read only the fields described here and do not search recursively. URLs in this file
explain the endpoint schema and do not authorise direct HTTP access. For a basic lookup by a
single common name, call `compound-summary` once. For multiple names, call
`compound-batch-summary` once with a default body containing only `identifiers` and
`namespace:"name"`; do not call health or schema first.

Project results directly from `data`. Batch records are in `data.results[*]`, the original label
is in `input`, and properties are nested under `properties`. Use this fixed SMILES fallback
order: `CanonicalSMILES -> ConnectivitySMILES -> SMILES -> IsomericSMILES`. Do not treat PubChem
`XLogP` and RDKit `MolLogP` as interchangeable; do not fill a `not_found` result with local
calculations.

Namespaces: `cid`, `name`, `smiles`, `inchi`, `inchikey`, `formula`.

## Health

Operation: `health`; no request body.

## Resolve CIDs

Operation: `compound-resolve-cids`.

```json
{"identifier": "aspirin", "namespace": "name", "max_records": 20}
```

`max_records`: 1-100.

## Properties

Operation: `compound-properties`.

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

Operation: `compound-synonyms`.

```json
{"identifier": "2244", "namespace": "cid", "max_synonyms": 50}
```

`max_synonyms`: 1-500.

## Summary

Operation: `compound-summary`.

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

Operation: `compound-batch-summary`.

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
