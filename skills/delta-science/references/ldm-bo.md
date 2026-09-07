# LDM-BO 详细规则

所有调用直接使用 `delta-cli science invoke`，不是本地 PDF2Dock runner。仅用于小分子 SMILES；
抗体、CDRH3 或 AntBO 场景必须使用 AntBO 能力边界。
provider、模型路径、Vina/ReaSyn/GPU/LLM 配置由服务端注入，不放入请求 JSON。

## Health

operation：`health`，无 body。

The response reports whether the adapter can see the mounted PDF2Dock
interpreter, `bo_api.py`, Vina binary, ReaSyn repo/interpreter/checkpoints, NN
model files, cache directory, GPU settings, and LLM configuration. Missing LLM
settings degrade health because LDM methods need them.

## One-Step Recommend

operation：`recommend`。

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

`acquisition_values` 只能按业务响应原值报告。除非当前业务响应明确给出字段定义，否则
不得把它描述为预测 Vina、预测 objective、不确定性、置信度、expected improvement，
也不得自行判断“越大/越小越好”。服务未返回推荐理由时，明确写“服务未返回推荐
理由”，不得根据分子骨架、杂原子或模型机制补写解释。

## Full Trajectory

operation：`trajectory`。

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
