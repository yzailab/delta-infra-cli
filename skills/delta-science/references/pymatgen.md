# pymatgen reference

Make all calls with `delta-cli science invoke`. Prefer pymatgen for inorganic formulae,
composition and formula weight; do not use PubChem or a local element table as a substitute.
Structure operations require the complete structure text, not a local file path. Supported formats
are `cif`, `poscar`, `json`, `cssr` and `xsf`; LAMMPS data and dump files are not accepted.

## Health

Operation: `health`; no request body.

## Composition Parse

Operation: `composition-parse`.

```json
{"formula": "LiFePO4", "format": "formula"}
```

Key response fields in `data`: `valid`, `formula`, `reduced_formula`,
`alphabetic_formula`, `anonymous_formula`, `chemical_system`,
`number_of_atoms`, `weight`, `element_amounts`, `atomic_fractions`,
`weight_fractions`, `error`.

## Structure Parse / Summary

Operation: `structure-parse` or `structure-summary`.

```json
{"input": "<CIF text>", "format": "cif", "primitive": false}
```

Input formats: `cif`, `poscar`, `json`, `cssr`, `xsf`.

Summary fields include `formula`, `reduced_formula`, `chemical_system`,
`nsites`, `nelements`, `density`, `volume`, `lattice`, `element_amounts`, and
`species`.

## Structure Convert

Operation: `structure-convert`.

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

Operation: `structure-symmetry`.

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
