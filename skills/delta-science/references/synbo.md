# SynBO operation 参考

所有在线调用都通过 `delta-cli science invoke`，服务地址来自 CLI 的标准
`science_base_url` 配置。这里的路径只说明业务 operation，不得据此直连 HTTP。

用户说“优化反应条件”“推荐下一批实验”“偶联反应怎么继续做”，或给出溶剂、温度、
催化剂、碱、配体和历史得率时，即使没有提到 SynBO、BO、CLI 或字段名也使用本节。
每个用户任务最多一次 SynBO 业务调用；成功后立即结束，validation、502、504、
timeout、断连或空 recommendations 均不得换参数、换模型或重试。

## Health

operation：`health`，无 body。

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

operation：`initialize`。

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

operation：`optimize`。

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

### 数值条件必须先离散化

SynBO 的 `condition_dict` 只接受显式列表，不接受连续范围对象。对于“温度
40–100°C、催化剂用量 0.5–2.0%”并已有 60/70/80/90°C 与
0.5/1.0/1.5/2.0% 历史值的任务，使用：

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

约束：

- 每个条件值统一为字符串，objective metric 保持数值。
- 每条 `previous_results` 中的条件值必须出现在对应 `condition_dict` 列表中。
- 连续范围的离散网格必须包含用户上下界和全部历史观测值；最终答案必须说明实际网格。
- 将条件值显式序列化为字符串，并确保每条历史记录只使用 `condition_dict` 中列出的值。
  如需小数据 CPU 设置，显式传递 `accuracy:"tiny"`、`surrogate_model:"RF"`、
  `acq_func:"UCB"` 和 `device:"cpu"`；不得假定客户端会补充默认值。

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

常见原因包括条件空间过大、条件值重复、历史条件值不在 condition_dict 中、
descriptor 非数值、历史行缺列、metric 非数值，以及无 GPU 时请求 CUDA。

服务端有独立于客户端的单次请求时限。GP、EHVI、高 accuracy 或共享资源繁忙可能导致
timeout。普通用户任务中不得自动换参数重试；应报告“未产生推荐”，保留本次错误，
由用户决定是否另起一次明确的回归测试。
