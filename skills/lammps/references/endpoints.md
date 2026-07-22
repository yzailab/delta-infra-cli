# LAMMPS Endpoint Reference

All paths are relative to `http://111.2.199.31:52317/api/v1`.

## Health

`GET /chem/lammps/health`

Key response fields in `data`: `status`, `service`, `lammps_available`,
`metadata`, and `limits`.

Use this before long simulations. A healthy service should report
`data.status == "ok"` and `data.lammps_available == true`.

## Built-In Lennard-Jones Example

`GET /chem/lammps/examples/lj-melt`

Returns a complete `request` payload for `/chem/lammps/run`, plus workflow notes
showing where pymatgen and GSAS-II fit around LAMMPS.

## Run

`POST /chem/lammps/run`

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
