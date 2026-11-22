# Binder Design — BoltzGen (`protein_tools` / `binder_design`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

BoltzGen end-to-end binder design (submits a task; the response carries a `task_id`).
- `design_spec` (required): `{"yaml": <text> | "yaml_file": <URL/path>, "files": {name: URL/path}}`
- `protocol` / `num_designs` / `budget` / `steps` / `gpu_id` / `reuse` / `job_id` (optional override fields)
- `target_structure` (optional): target path/URL; filename derives from `design_spec` yaml's first `- file:` path

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint binder_design --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `design_spec` | Object: yaml / yaml_file (one required) + files {name: URL/path} | - |
| `protocol` | Design protocol override | - |
| `num_designs` | Number of designs | - |
| `budget` | Design budget | - |
| `steps` | Design steps override | - |
| `gpu_id` | GPU id | - |
| `reuse` | Reuse prior run | - |
| `job_id` | Existing job id to resume | - |
| `target_structure` | Target structure path/URL | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`; the service response lives under `data`.
- Server-side contract: `status`, `message`, `tool_type`, `task_id`, `step` and `resultjson`. This is a task-submission
  endpoint — read `task_id`/`step`/`resultjson` as returned; no `download_url`.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Submitted binder-design task: task_id and current step (BoltzGen task submission)
- Presentation form: Task submission summary (task_id/step)
- Downstream reuse: track the submitted task by task_id
## Output Template

- Title: **Binder design task submission (BoltzGen)**
- Lead with the conclusion: task submitted, task_id and current step
- Report only task_id/step/status as returned; do not fabricate design results

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`file_url`/`source` etc.) take
  server-accessible URL/path strings, not local upload paths; a `download_url` or
  `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields
  declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results;
  do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation
  timeouts (the outcome may be unknown because the task may already have happened).
