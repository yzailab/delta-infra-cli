# LAMMPS 详细规则

所有调用只走统一 wrapper。LAMMPS 不从化学式、CIF 或 POSCAR 自动推断 data、原子
类型、势函数与边界条件。成功执行不表示物理收敛或生产可用。

## Health

operation：`health`，无 body。

Key response fields in `data`: `status`, `service`, `lammps_available`,
`metadata`, and `limits`.

只有用户明确要求健康检查时才调用；不要在模拟前自动增加 health。

## Built-In Lennard-Jones Example

operation：`lj-melt-example`。

Returns a complete `request` payload for the `run` operation, plus workflow notes
showing where pymatgen and GSAS-II fit around LAMMPS.

## Run

operation：`run`。

```json
{
  "input_script": "<LAMMPS input script>",
  "files": [
    {"path": "system.data", "content": "<LAMMPS data file text>", "encoding": "text"}
  ],
  "timeout_seconds": 30,
  "max_thermo_rows": 1000,
  "log_tail_lines": 200,
  "output_files": ["dump.lammpstrj", "final.data"],
  "include_log": true,
  "include_stdout": false,
  "include_stderr": false
}
```

`files` are written into a fresh job working directory before LAMMPS starts.
`encoding` can be `text` or `base64`.

The response includes parsed thermo rows, the final thermo row, atom count when
detectable, log tail, warnings, and requested output files. Text output files
return `content`; binary output files return `content_base64`.

Notes:

- Use relative file paths only.
- The service rejects unsafe commands such as `shell`, `python`, `plugin`, and
  `jump` by default.
- `include <relative-file>` is allowed when the included file is supplied in
  `files`; absolute paths, parent-directory traversal, URLs, and `jump` loops
  are rejected.
- Dump/data products are returned as raw requested output files, not structured
  parsed atom-frame objects.
- The gateway is synchronous; keep interactive runs short.
- Force-field choice is caller responsibility. The service executes explicit
  LAMMPS input and does not infer potentials from formulas or structures.

最终只复制当前 native 的 `last_thermo`、final step/temperature/total energy、
warnings 和用户要求的输出文件摘要。禁止把总能量除以原子数、替换步数、换算单位或
推测收敛性、稳定性。最小示例必须先调用 `lj-melt-example`，再把其
`native["request"]` 原样交给 `run`；不得传 wrapper 外层 envelope。
