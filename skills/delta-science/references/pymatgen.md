# pymatgen 详细规则

所有调用只走统一 wrapper。无机化学式、组成和式量优先使用 pymatgen，不用 PubChem
或本地元素表替代。结构 operation 必须发送完整结构文本，不能发送本地文件路径；
支持 `cif`、`poscar`、`json`、`cssr`、`xsf`，不接收 LAMMPS data/dump。

## Health

operation：`health`，无 body。

## Composition Parse

operation：`composition-parse`。

```json
{"formula": "LiFePO4", "format": "formula"}
```

Key response fields in `data`: `valid`, `formula`, `reduced_formula`,
`alphabetic_formula`, `anonymous_formula`, `chemical_system`,
`number_of_atoms`, `weight`, `element_amounts`, `atomic_fractions`,
`weight_fractions`, `error`.

## Structure Parse / Summary

operation：`structure-parse` 或 `structure-summary`。

```json
{"input": "<CIF text>", "format": "cif", "primitive": false}
```

Input formats: `cif`, `poscar`, `json`, `cssr`, `xsf`.

Summary fields include `formula`, `reduced_formula`, `chemical_system`,
`nsites`, `nelements`, `density`, `volume`, `lattice`, `element_amounts`, and
`species`.

## Structure Convert

operation：`structure-convert`。

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

operation：`structure-symmetry`。

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
