# SynBO API Endpoint Reference

All paths are relative to `http://111.2.199.31:52317/api/v1`.

This reference is for the exposed HTTP gateway. It is not a local SynBO project
runner.

## Health

`GET /chem/synbo/health`

Reports SynBO import status, Torch/CUDA runtime availability, service limits,
default device, and visible CUDA devices.

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

`POST /chem/synbo/initialize`

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

`POST /chem/synbo/optimize`

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
  "device": "cpu",
  "random_seed": 42
}
```

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
    "service_url": "http://synbo-service:8897",
    "synbo_response": {
      "detail": "previous_results is missing metric columns: ['yield']"
    }
  }
}
```

Common causes are oversized reaction spaces, duplicate condition values,
non-numeric descriptors, missing previous-result columns, missing numeric metric
values, and requesting CUDA when no GPU is available.

The service also enforces its own per-request time limit that is independent of
the client HTTP `timeout`. A slow call returns a timeout error such as
`"SynBO service timed out"`. This is expected for heavy optimizer settings
(GP + EHVI, higher accuracy) or when a concurrent request is occupying the
shared GPU. Retry once the service is idle, or lower `accuracy`, narrow the
reaction space, or use a GPU device.
