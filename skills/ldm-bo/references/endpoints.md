# LDM-BO API Endpoint Reference

All paths are relative to `http://111.2.199.31:52317/api/v1`.

This reference is for using the exposed HTTP API. It is not a local PDF2Dock
runner.

## Health

`GET /chem/ldm-bo/health`

The response reports whether the adapter can see the mounted PDF2Dock
interpreter, `bo_api.py`, Vina binary, ReaSyn repo/interpreter/checkpoints, NN
model files, cache directory, GPU settings, and LLM configuration. Missing LLM
settings degrade health because LDM methods need them.

## One-Step Recommend

`POST /chem/ldm-bo/recommend`

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

Typical native response inside gateway `data`:

```json
{
  "recommendations": ["CCC"],
  "acquisition_values": [0.12],
  "n_objectives": 1
}
```

LDM methods may include an `llm` diagnostics object.

## Full Trajectory

`POST /chem/ldm-bo/trajectory`

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

Typical native response inside gateway `data`:

```json
{
  "config": {},
  "history": [],
  "summary": {}
}
```

LDM methods may include `llm_trajectory`.

## Error Handling

The service maps native `bo_api` error JSON to an upstream failure. The gateway
returns a standard error envelope:

```json
{
  "code": 1,
  "message": "AutoDock Vina executable not found...",
  "data": {
    "endpoint": "/v1/trajectory",
    "service_url": "http://ldm-bo-service:8895",
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

The wrapper intentionally preserves user payloads and lets `bo_api` own native
defaults and schema behavior.
