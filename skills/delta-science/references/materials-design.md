# Materials Design reference

Materials Design builds surrogate models from experimental or computational materials tables,
validates models, defines feasible candidate spaces, and ranks candidates with uncertainty
estimates. Recommendations are hypotheses to validate, not confirmed materials, synthesis routes
or experimental results.

The routing label for this reference is `materials-design`. Use the current output of
`delta-cli science list` and `delta-cli science endpoints list <tool>` as the authority for
`tools.name` and `tool_endpoints.name`. The Gateway paths below describe the service contract;
they are not URLs to construct or access directly.

## Service boundary

The service provides the following capabilities:

| Service path | Purpose | Result boundary |
| --- | --- | --- |
| `/chem/materials-design/health` | Gateway-to-service readiness check | `status`, dependency availability, limits |
| `/chem/materials-design/v1/capabilities` | Input formats, models, validation modes and limits | Capability catalogue |
| `/chem/materials-design/v1/jobs` | Upload training/candidate tables and create an asynchronous job | `202`, `job_id`, status and links |
| `/chem/materials-design/v1/jobs/{job_id}` | Read job status | `status`, `result_status`, result, warnings |
| `/chem/materials-design/v1/jobs/{job_id}/cancel` | Request cancellation | Cancellation request/final state |
| `/chem/materials-design/v1/jobs/{job_id}/artifacts` | List artifacts | name, size, media_type, SHA-256 |
| `/chem/materials-design/v1/jobs/{job_id}/artifacts/{path}` | Download one artifact | Raw report/JSON/CSV/figure bytes |

Route all JSON/query calls through:

```text
delta-cli science invoke --tool TOOL --endpoint ENDPOINT --data JSON
```

Submit training tables through the controlled file adapter:

```text
delta-cli science file invoke --tool materials-design --endpoint job-submit \
  --file train.xlsx --candidate-file candidates.xlsx --data CONFIG_JSON
delta-cli science task submit --tool materials-design --operation job-status \
  --input '{"job_id":"mdjob_..."}' --wait
delta-cli science file download --tool materials-design --endpoint artifact-download \
  --params '{"job_id":"mdjob_...","artifact_path":"report.html"}' --output report.html
```

Use `--params JSON` only for read-only query operations. If a new tool is absent from the
catalogue, or the catalogue does not return enough request-schema detail, stop and report that it
is not exposed. Do not guess endpoint names, bodies or compatibility aliases.

## CLI capability boundaries

The raw service request for `POST /v1/jobs` is `multipart/form-data` and contains at least:

```text
file=<training table>
candidate_file=<optional candidate table>
config=<serialized JSON object>
```

`science invoke` accepts only a JSON object body and JSON query parameters; it cannot express
multipart data. Do not disguise a local path or base64 as a file field. Artifact downloads are
also raw bytes: save and verify them with `science file download`, and do not treat them as
ordinary JSON results. Do not call `materials-design-service:8900` or connect directly to the
preflight Gateway.

## Inputs and configuration

Before modelling, confirm:

- `feature_columns`, `controllable_columns`, `target_column` or `objectives`;
- identifier, metadata, leakage, post-measurement and group/time columns, and their units;
- objective direction, feasibility constraints, candidate table or candidate-generation rules;
- missing values, duplicate samples, measurement conditions, data sources and validation split strategy.

Core fields for a single-objective configuration:

```json
{
  "feature_columns": ["Bi", "In", "Ti"],
  "controllable_columns": ["Bi", "In", "Ti"],
  "identifier_columns": ["sample_id"],
  "target_column": "T",
  "target_direction": "maximize",
  "validation": {"strategy": "kfold", "n_splits": 5},
  "model_names": ["ExtraTrees", "GPR", "Ridge"],
  "random_state": 42,
  "recommendation_count": 10
}
```

For multiple objectives, use `objectives: [{"target_column": "...", "direction": "maximize|minimize"}]`
and explicit Pareto/EHVI settings. Prefer the user's `candidate_file`. If the service generates
candidates from observed ranges, explicitly preserve steps, hard constraints, composition
closure, `max_candidates` and `allow_extrapolation`. Do not optimise identifier, post-measurement
or leakage columns, or out-of-domain points without authorisation. Do not extrapolate arbitrarily
to fill the candidate count.

## Results handling

Assess job `status` and `result_status` separately:

- `status`: `pending`, `running`, `completed`, `failed` or `cancelled`;
- `result_status`: `complete`, `exploratory`, `readiness_only` or `failed`.

`202` means only that the service accepted or queued the job; it does not mean model training is
complete. `completed` does not mean the ranking is reliable. Say that the data and validation
support candidate ranking only when `result_status` is `complete`. Treat `exploratory` only as a
learning hypothesis; for `readiness_only`, read the readiness information and request missing
inputs; report `failed` as returned. Always preserve the returned validation, ranking, warnings
and error.

Keep predictions distinct from observations and cross-validation predictions. At minimum, report
data coverage, the split, model comparisons, uncertainty calibration, candidate feasibility,
in-domain/out-of-domain status, EI/PI/UCB or Pareto settings, and the plan for experimental
validation. Do not present model variance as experimental error or candidate predictions as
measured values.

## Artifacts and errors

Read artifacts only when the user asks for them or the workflow requires them. Verify downloaded
content against the `size`, `media_type` and SHA-256 returned by the listing; do not infer formats
from filenames. The service may produce `report.html`, `result.json`,
`data_dictionary.json`, `model_comparison.csv`, OOF/residual/calibration files,
`search_space.json`, `candidate_predictions.csv`, `shortlist.csv`, `recommendation_views.csv`,
`pareto_front.csv` and `figures/*`.

Common terminal conditions include configuration/file-format errors, a missing target or
candidate space, upload/row/candidate-count limits being exceeded, an unready backend, or a
missing job or artifact. Do not retry blindly after a submission timeout or disconnection: a
multipart upload may already have created a job, so first check whether a `job_id` was returned.
Do not replace a failure or empty recommendation with local regression, GP, random numbers or a
manual ranking.
