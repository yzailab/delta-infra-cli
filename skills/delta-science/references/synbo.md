# SynBO operation reference

Make all online calls with `delta-cli science invoke`; the service address comes from the CLI's
standard `base_url` configuration (`{base_url}/science_tool`). The paths here describe business
operations only and do not authorise direct HTTP access.

Use this section when the user asks to optimise reaction conditions, recommend the next batch of
experiments, continue a coupling reaction, or provides solvents, temperatures, catalysts, bases,
ligands and historical yields—even if they do not mention SynBO, BO, the CLI or field names. Make
at most one SynBO business call per user task. Stop immediately after success; for validation
errors, 502, 504, timeouts, disconnections or empty recommendations, do not change parameters or
models, or retry.

## Health

Operation: `health`; no request body.

Reports SynBO import status, Torch/CUDA runtime availability, service limits,
default device and visible CUDA devices.

Important fields inside gateway `data`:

```json
{
  "status": "ok",
  "synbo_available": true,
  "metadata": {
    "service": "synbo-service",
    "engine": "synbo",
    "version": "0.1.0",
    "synbo_version": "0.1.0",
    "default_device": "cpu",
    "cuda_visible_devices": ""
  },
  "limits": {
    "max_batch_size": 128,
    "max_reaction_space_size": 200000,
    "max_previous_rows": 10000
  },
  "runtime": {
    "torch_available": true,
    "cuda_available": false,
    "cuda_device_count": 0,
    "cuda_device_names": []
  },
  "warnings": []
}
```

## Initialize

Operation: `initialize`.

Use for initial condition sampling when no measured previous results exist.

Request body:

```json
{
  "condition_dict": {
    "catalyst": ["Pd(OAc)2", "Pd(PPh3)4", "Pd2(dba)3"],
    "solvent": ["THF", "Dioxane", "Toluene"],
    "base": ["K2CO3", "NaOEt", "DBU"]
  },
  "opt_metrics": ["yield"],
  "opt_metric_settings": [
    {"opt_direct": "max", "opt_range": [0, 100], "metric_weight": 1.0}
  ],
  "batch_size": 3,
  "sampling_method": "random",
  "desc_normalize": "minmax",
  "random_seed": 42
}
```

Supported `sampling_method` values: `sobol`, `random`, `lhs`, `kmeans`.

## Optimize

Operation: `optimize`.

Use after measured experiment rows are available. Each previous row must contain
all condition columns and all objective metric columns.

Request body:

```json
{
  "condition_dict": {
    "catalyst": ["Pd(OAc)2", "Pd(PPh3)4", "Pd2(dba)3"],
    "solvent": ["THF", "Dioxane", "Toluene"],
    "base": ["K2CO3", "NaOEt", "DBU"]
  },
  "opt_metrics": ["yield"],
  "previous_results": [
    {"batch": 0, "catalyst": "Pd(OAc)2", "solvent": "THF", "base": "K2CO3", "yield": 42.0},
    {"batch": 0, "catalyst": "Pd(PPh3)4", "solvent": "Dioxane", "base": "NaOEt", "yield": 55.0},
    {"batch": 0, "catalyst": "Pd2(dba)3", "solvent": "Toluene", "base": "DBU", "yield": 63.0}
  ],
  "batch_size": 2,
  "accuracy": "tiny",
  "surrogate_model": "RF",
  "acq_func": "UCB",
  "device": "cpu",
  "random_seed": 42
}
```

### Discretise numeric conditions first

SynBO's `condition_dict` accepts explicit lists only; it does not accept continuous range
objects. For a task with a temperature range of 40–100°C and catalyst loading of 0.5–2.0%, with
historical values at 60/70/80/90°C and 0.5/1.0/1.5/2.0%, use:

```json
{
  "condition_dict": {
    "solvent": ["ethanol", "acetonitrile", "DMSO"],
    "temperature_C": ["40", "60", "70", "80", "90", "100"],
    "catalyst_loading_pct": ["0.5", "1.0", "1.5", "2.0"]
  },
  "opt_metrics": ["yield"],
  "previous_results": [
    {
      "batch": 0,
      "solvent": "ethanol",
      "temperature_C": "60",
      "catalyst_loading_pct": "1.0",
      "yield": 55.0
    }
  ],
  "batch_size": 3,
  "accuracy": "tiny",
  "surrogate_model": "RF",
  "acq_func": "UCB",
  "device": "cpu",
  "random_seed": 42
}
```

Constraints:

- Represent every condition value as a string and keep objective metrics numeric.
- Every condition value in each `previous_results` row must appear in the corresponding `condition_dict` list.
- The discretised grid for a continuous range must include the user's lower and upper bounds and all historical observations. State the actual grid in the final answer.
- Serialise condition values explicitly as strings, and ensure each historical row uses only values listed in `condition_dict`. For a small-data CPU configuration, pass `accuracy:"tiny"`, `surrogate_model:"RF"`, `acq_func:"UCB"` and `device:"cpu"` explicitly; do not assume the client supplies defaults.

Useful optional fields:

- `accuracy`: `tiny`, `low`, `medium`, `high`, or `ultra`.
- `acq_func`: `EHVI`, `UCB`, `ParEGO`, or `NEI`.
- `surrogate_model`: `GP`, `RF`, `BNN`, or `BayesianLinear`.
- `device`: `cpu`, `auto`, `cuda`, or `cuda:0`.
- `cuda_visible_devices`: request-level CUDA visibility hint. Use only when the
  user explicitly asks for it and `/health` indicates a CUDA-capable runtime.
- `constraints`: map condition type to prohibited values.

## Descriptors

If omitted, SynBO uses generated OneHot descriptors. To provide descriptors:

```json
{
  "descriptors": {
    "solvent": [
      {"name": "THF", "polarity": 0.207, "boiling_point_C": 66.0},
      {"name": "Toluene", "polarity": 0.099, "boiling_point_C": 110.6}
    ]
  },
  "descriptor_index_col": "name"
}
```

`descriptors` must contain exactly the same keys as `condition_dict`. Descriptor
rows must include the configured index column and numeric descriptor columns.

## Error Handling

Gateway errors have the standard envelope:

```json
{
  "code": 1,
  "message": "SynBO service returned HTTP 400",
  "data": {
    "endpoint": "/synbo/optimize",
    "synbo_response": {
      "detail": "previous_results is missing metric columns: ['yield']"
    }
  }
}
```

Common causes include an oversized condition space, duplicate condition values, historical
condition values absent from `condition_dict`, non-numeric descriptors, missing columns in
historical rows, non-numeric metrics, and a CUDA request when no GPU is available.

The server has a per-request timeout independent of the client. GP, EHVI, high accuracy or busy
shared resources may cause a timeout. Do not automatically change parameters and retry during an
ordinary user task. Report “no recommendations were produced”, preserve the error, and let the
user decide whether to start a separate, explicitly requested regression test.
