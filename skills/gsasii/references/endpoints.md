# GSAS-II Endpoint Reference

All paths are relative to `http://111.2.199.31:52317/api/v1`.

## Health

`GET /chem/gsasii/health`

Key response fields in `data`: `status`, `service`, `gsasii_available`,
`metadata`, and `limits`.

Use this before long simulations/refinements. A healthy service should report
`data.status == "ok"` and `data.gsasii_available == true`.

## Powder Simulation

`POST /chem/gsasii/powder/simulate`

```json
{
  "cif": "<CIF text>",
  "phase_name": "phase",
  "instrument_parameters": "<GSAS-II instrument parameter text>",
  "histogram_name": "simulation",
  "t_min": 10.0,
  "t_max": 80.0,
  "t_step": 0.02,
  "include_profile": true,
  "max_profile_points": 1000,
  "include_reflections": true,
  "max_reflections": 1000,
  "return_refined_cif": false,
  "return_project": false
}
```

Use either `t_step` or `n_points`, not both. Optional fields include
`wavelength`, `radiation`, `scale`, `include_profile`, `max_profile_points`,
`include_reflections`, `max_reflections`, `return_refined_cif`, and
`return_project`.

The response includes `profile` points with `x`, `y_calc`, optional background,
bounded `reflections` with hkl/d-spacing/2theta where available, and metadata.
If `return_project` is true, `project_base64` contains the GSAS-II `.gpx`
project. If `return_refined_cif` is true, `refined_cif` contains exported CIF
text for pymatgen handoff when GSAS-II supports export for the phase.

Notes:

- `cif` should be valid CIF text. If the input is POSCAR/JSON/CSSR/XSF, use
  `/chem/pymatgen/structure/convert` first with `output_format: "cif"`.
- `instrument_parameters` should be GSAS-II instrument parameter text such as
  `INST_XRY.PRM` when instrument-specific simulation is needed.
- For quick simulation only, `instrument_parameters` may be omitted. The service
  then generates a simple CW X-ray instrument model from `wavelength` or
  `radiation` (`CuKa` by default; also supports aliases such as `MoKa`, `CoKa`,
  `CrKa`, and explicit numeric wavelength).
- Refinement still requires real `instrument_parameters`.
- `max_profile_points` controls response sampling. Use small values for smoke
  tests and larger values for profile comparison.
- Older deployed gateway images may require `max_profile_points >= 10`.

## Powder Refinement

`POST /chem/gsasii/powder/refine`

```json
{
  "powder_data": "<two-column or three-column powder data text>",
  "powder_format": "xy",
  "instrument_parameters": "<GSAS-II instrument parameter text>",
  "phases": [
    {"name": "phase", "cif": "<CIF text>"}
  ],
  "refinement_mode": "rietveld",
  "refinement_steps": [],
  "max_cycles": 3,
  "histogram_name": "powder",
  "include_profile": true,
  "max_profile_points": 1000,
  "include_reflections": true,
  "max_reflections": 1000,
  "return_refined_cif": false,
  "return_project": false
}
```

Supported `powder_format` values: `xy`, `xye`, `fxye`, `gsas`, and `csv`.

`refinement_mode: "rietveld"` is currently implemented. `pawley` and `lebail`
return a clear not-implemented response until the service wires the
mode-specific GSAS-II setup.

The response includes fit `residuals` when available, phase summaries, sampled
profile points, bounded `reflections`, warnings, optional `refined_cif`, and
the optional `.gpx` project.

Notes:

- Use `xy` for simple whitespace-delimited `x y` rows, `xye` for `x y esd`,
  `csv` for numeric comma-separated rows, or `gsas`/`fxye` for GSAS-like powder
  formats.
- `max_cycles: 0` is useful for project-construction smoke tests. Increase it
  only when the powder data, phase model, instrument file, and refinement steps
  are realistic.
- `refinement_steps` is passed to `G2Project.do_refinements`. Keep recipes
  incremental and inspect `warnings`, `residuals`, and `lst` output.
- Refinement may return `valid: false` with partial phase/profile information
  if GSAS-II constructed the project but a refinement step failed.

## Recommended Integration Scripts

From this skill's `scripts/` directory:

```bash
python3 scripts/smoke_gsasii.py
```

Runs health, PbSO4 powder simulation, and project-return smoke tests.

```bash
python3 scripts/workflow_pymatgen_gsasii.py
```

Runs the cross-service workflow:

```text
pymatgen summary/symmetry -> pymatgen CIF conversion -> GSAS-II simulation
-> profile comparison -> GSAS-II refinement -> pymatgen final check
```
