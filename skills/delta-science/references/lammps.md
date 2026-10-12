# LAMMPS reference

Make all calls with `delta-cli science invoke`. LAMMPS does not infer data files, atom types,
potentials or boundary conditions from a formula, CIF or POSCAR. Successful execution does not
establish physical convergence or production readiness.

## Health

Operation: `health`; no request body.

Key response fields in `data`: `status`, `service`, `lammps_available`,
`metadata`, and `limits`.

Call this only when the user explicitly asks for a health check; do not add a health call automatically before simulation.

## Built-In Lennard-Jones Example

Operation: `lj-melt-example`.

Returns a complete `request` payload for the `run` operation, plus workflow notes
showing where pymatgen and GSAS-II fit around LAMMPS.

## Run

Operation: `run`.

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

In the final reply, include only `last_thermo`, the final step/temperature/total energy,
warnings, and a summary of output files requested by the user from the current business response.
Do not divide total energy by the atom count, substitute steps, convert units, or infer
convergence or stability. For the minimal example, call `lj-melt-example` first, then pass its
`request` from the current business response to `run` unchanged; do not pass the outer CLI envelope.
