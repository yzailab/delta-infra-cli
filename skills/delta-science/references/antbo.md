# AntBO reference

Use `delta-cli science invoke` with `endpoint`, `data` and `params`. Read business results
from the CLI response fields defined in this document. Run operations marked as mutating only
with the user's explicit authorisation, and never retry them.

For antibody/CDRH3 tasks, do not switch to small-molecule LDM-BO or STRBO even if the user
mentions “LDM”. The current catalogue exposes both CDRH3 generation, suggestion and evaluation
operations and the traditional AntBO job-management operations.

## health (read-only)

- Use case: Check whether the remote AntBO environment is available.
- Request: `endpoint="health"; data=None; params=None`
- Read from the response: `status`, `antbo_available`, `metadata`, `limits` and `warnings`.

## run-default-job (mutating)

- Use case: The user explicitly asks to start the standard background continuation job.
- Request: `endpoint="run-default-job"; data=None; params={"log_name":"antbo_<unique-timestamp>.log","append":False,"timeout_seconds":86400}`
- Read from the response: `started`, `pid`, `log_name` or `log_path`, and `timeout_seconds`. Do not retry if the outcome is unknown.

Report the job as started only when the same business response contains `started=true`, a
non-empty `pid`, and either `log_name` or `log_path`. If any field is missing, mark the start
as unverified and do not submit again.

## run (heavy, mutating)

- Use case: The user explicitly supplies an approved AntBO script, configuration and antigen file, and asks for synchronous execution.
- Request: `endpoint="run"; data={"script_path":"./bo/main.py","config_path":"./bo/config.yaml","n_trials":1,"seed":42,"antigens_file":"<path within project root>","extra_args":[],"timeout_seconds":86400,"cuda_visible_devices":"0","conda_env":"DGM","log_name":"antbo_custom.log","append":False}; params=None`
- Read from the response: `ok`, `returncode`, `timed_out`, `log_path` and whether the log was truncated. Do not include the full log in the final reply.

## log (read-only)

- Use case: The user provides a known `log_name` and asks to inspect the end of the log.
- Request: `endpoint="log"; data=None; params={"log_name":"antbo_run.log"}`
- Read from the response: `log_name`, `log` and `log_truncated`. For long logs, provide only a bounded summary of the tail.

## jobs (read-only)

- Use case: List the active jobs registered by the current service container.
- Request: `endpoint="jobs"; data=None; params=None`
- Read `pid`, `running`, `returncode`, `log_name` and `log_path` from each item in `jobs`.

## stop (mutating)

- Use case: The user explicitly asks to stop a job with a confirmed PID.
- Request: `endpoint="stop"; data=None; params={"pid":12345}`
- Read from the response: `stopped`, `pid` and `message`. Do not retry blindly or call without parameters when multiple jobs exist.

## CDRH3 generation and optimisation

The server's supported antigens are defined by `supported_antigens` in the health response.
Do not guess or treat an arbitrary protein-file path as an antigen. Deployments commonly support
`1ADQ_A`, `1FBI_X`, `1H0D_C`, `1NSN_S` and `1OB1_C`, but use the current service response
and the user's choice before execution.

### ldm-health (read-only)

- Request: `endpoint="ldm-health"; data=None; params=None`
- Read from the response: `supported_antigens`, `cdrh3_length`, `objective`, and fields describing Absolut/model provenance.

### ldm-init / ldm-init-validate

```json
{
  "task": "Generate initial CDRH3 candidates for the specified antigen",
  "num_initial": 3,
  "antigen": "1ADQ_A",
  "seed": 42
}
```

Use `ldm-init-validate` only to validate parameters; use `ldm-init` for generation. Successful
candidates must be CDRH3 sequences returned by the service. Do not invent candidates.

### ldm-suggest / ldm-suggest-validate

```json
{
  "task": "Continue reducing antigen binding energy",
  "history_xs": ["ARVGYSLYAMD", "AKYGGYDYAMD"],
  "history_ys": [-18.2, -17.4],
  "num_suggestions": 2,
  "antigen": "1ADQ_A",
  "seed": 42
}
```

AntBO is single-objective. `history_ys` must be a one-dimensional array of finite numbers and
have the same length as `history_xs`. Each CDRH3 must contain 11 standard amino-acid characters;
use the current `cdrh3_length` returned by `ldm-health` as the final constraint.

### evaluate / evaluate-validate

```json
{
  "designs": ["ARVGYSLYAMD", "AKYGGYDYAMD"],
  "antigen": "1ADQ_A"
}
```

The number of returned scores must match the number of designs; lower binding energy is better.
Generation, suggestion and evaluation are all heavy remote calls. Do not retry if the outcome is
unknown or times out, and do not fill in results with locally generated random scores.
