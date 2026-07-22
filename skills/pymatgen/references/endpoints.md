# pymatgen Endpoint Reference

All paths are relative to `http://111.2.199.31:52317/api/v1`.

## Health

`GET /chem/pymatgen/health`

## Composition Parse

`POST /chem/pymatgen/composition/parse`

```json
{"formula": "LiFePO4", "format": "formula"}
```

Key response fields in `data`: `valid`, `formula`, `reduced_formula`,
`alphabetic_formula`, `anonymous_formula`, `chemical_system`,
`number_of_atoms`, `weight`, `element_amounts`, `atomic_fractions`,
`weight_fractions`, `error`.

## Structure Parse / Summary

`POST /chem/pymatgen/structure/parse`

`POST /chem/pymatgen/structure/summary`

```json
{"input": "<CIF text>", "format": "cif", "primitive": false}
```

Input formats: `cif`, `poscar`, `json`, `cssr`, `xsf`.

Summary fields include `formula`, `reduced_formula`, `chemical_system`,
`nsites`, `nelements`, `density`, `volume`, `lattice`, `element_amounts`, and
`species`.

## Structure Convert

`POST /chem/pymatgen/structure/convert`

```json
{
  "input": "<CIF text>",
  "input_format": "cif",
  "output_format": "poscar",
  "primitive": false
}
```

Output formats: `cif`, `poscar`, `json`, `cssr`, `xsf`.

## Symmetry

`POST /chem/pymatgen/structure/symmetry`

```json
{
  "input": "<CIF text>",
  "format": "cif",
  "primitive": false,
  "symprec": 0.01,
  "angle_tolerance": 5.0
}
```

Returns `space_group_symbol`, `space_group_number`, `crystal_system`,
`point_group_symbol`, `hall`, and `nsites`.
