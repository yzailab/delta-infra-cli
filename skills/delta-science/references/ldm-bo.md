# LDM-BO reference

Make all calls with `delta-cli science invoke`; do not use the local PDF2Dock runner. This tool is
for small-molecule SMILES only. Use the AntBO capability boundary for antibody, CDRH3 or AntBO
tasks. The server injects the provider, model paths and Vina/ReaSyn/GPU/LLM settings; do not put
them in the request JSON.

## Health

Operation: `health`; no request body.

The response reports whether the adapter can see the mounted PDF2Dock
interpreter, `bo_api.py`, Vina binary, ReaSyn repo/interpreter/checkpoints, NN
model files, cache directory, GPU settings, and LLM configuration. Missing LLM
settings degrade health because LDM methods need them.

## One-Step Recommend

Operation: `recommend`.

Wraps `bo_api.recommend_next_smiles`.

Typical payload:

```json
{
  "method": "bo-tanimoto",
  "pool": ["CCO", "CCN", "CCC"],
  "history": [
    {"smiles": "CCO", "scores": [-7.1]},
    {"smiles": "CCN", "scores": [-6.8]}
  ],
  "batch_size": 1
}
```

Typical business response inside the documented gateway `data`:

```json
{
  "recommendations": ["CCC"],
  "acquisition_values": [0.12],
  "n_objectives": 1
}
```

LDM methods may include an `llm` diagnostics object.

Report `acquisition_values` exactly as returned in the business response. Unless the current
business response explicitly defines the field, do not describe it as predicted Vina, a predicted
objective, uncertainty, confidence or expected improvement, and do not infer whether higher or
lower is better. If the service provides no recommendation rationale, state “The service returned
no recommendation rationale”; do not add an explanation based on molecular scaffolds, heteroatoms
or model mechanisms.

## Full Trajectory

Operation: `trajectory`.

Wraps `bo_api.run_search_trajectory`.

Small smoke payload:

```json
{
  "method": "bo-tanimoto",
  "seed": 42,
  "seed-smiles": "CCO,CCN,CCC",
  "num-evaluations": 4,
  "batch-size": 1,
  "objective": "vina+nn"
}
```

Typical business response inside the documented gateway `data`:

```json
{
  "config": {},
  "history": [],
  "summary": {}
}
```

LDM methods may include `llm_trajectory`.

## Error Handling

The service maps `bo_api` error JSON to an upstream failure. The gateway
returns a standard error envelope:

```json
{
  "code": 1,
  "message": "AutoDock Vina executable not found...",
  "data": {
    "endpoint": "/v1/trajectory",
    "ldm_bo_response": {
      "error": "...",
      "error_type": "ValueError",
      "traceback": "Traceback ..."
    }
  }
}
```

Common causes are missing Vina, missing ReaSyn, wrong Python interpreter, CUDA
device mismatch, missing LLM credentials for LDM methods, or an unwritable Vina
cache directory.

## Provider Settings

Do not send provider settings in request JSON. The adapter reads these from
deployment config and passes them as Python kwargs to `bo_api`:

```text
vina_bin
vina_cache_dir
vina_max_workers
gp_device
reasyn_repo
reasyn_python_bin
reasyn_model_path
reasyn_devices
nn_model_path
nn_metadata_path
llm_model
llm_base_url
llm_api_key
```

The CLI forwards the user payload; `bo_api` owns business defaults and schema behavior.
