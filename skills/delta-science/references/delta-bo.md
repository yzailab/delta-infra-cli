# Delta-BO 详细规则

所有在线调用直接使用 `delta-cli science invoke`，tool 固定为 `delta-bo`。当前 CLI catalog 只暴露
`commands` 和 `generate`；禁止根据旧 HTTP 文档猜测或直连 stateful command API。

## commands

情景：用户要求查看当前部署支持的 Delta-BO 命令。

```text
delta-cli science invoke --tool delta-bo --endpoint commands
```

无 body。只报告当前业务响应中的命令列表，不从历史文档补全。

## generate

情景：针对数值、整数或分类实验变量生成随机搜索或贝叶斯优化建议。

无真实历史，或历史少于 5 条且用户没有明确要求 BO 时，使用有界随机搜索：

```json
{
  "params": [
    {"name": "x", "type": "numeric", "low": 0.0, "high": 1.0}
  ],
  "num_suggestions": 3,
  "algorithm": "random-search",
  "seed": 42
}
```

有真实历史且用户明确要求 BO 时，可以使用：

```json
{
  "params": [
    {"name": "temperature", "type": "numeric", "low": 20.0, "high": 120.0},
    {"name": "catalyst", "type": "categorical", "choices": ["A", "B", "C"]}
  ],
  "objectives": [{"name": "yield", "minimize": false}],
  "num_suggestions": 2,
  "algorithm": "bo",
  "model": {"name": "gp", "min_samples": 2, "train_steps": 50},
  "acq_target": {"name": "ucb", "beta": 2.0},
  "solver": {"name": "ga", "pop_size": 40, "n_gen": 10},
  "histories": {
    "decisions": [
      {"temperature": 40.0, "catalyst": "A"},
      {"temperature": 80.0, "catalyst": "B"}
    ],
    "observations": [
      {"yield": 0.42},
      {"yield": 0.61}
    ]
  },
  "seed": 7
}
```

参数类型仅支持 `numeric`、`integer`、`categorical`。优先使用 object-form history，
避免数组列顺序歧义。不得编造 observation、目标值或所谓最优点。

可选去重与约束：

```json
{
  "diversity": {
    "deduplicate": true,
    "min_numeric_distance": {"temperature": 5.0},
    "prefer_unique_categories": true
  },
  "constraints": [
    {"type": "unique_batch"},
    {"type": "avoid_seen_decisions"}
  ]
}
```

只报告业务响应的 `suggestions`、`suggestion_metadata`、`warnings`、
`generated_candidate_count` 和 `diversity` 中实际存在的字段。空 suggestions 或失败
不得用本地 GP、UCB 或随机数替代。

## 已知但未暴露的旧能力

旧服务曾包含 session、space、objective、policy、suggest、observe、loop、status、
best 等有状态命令，但它们不是当前 Delta CLI operation。本 Skill 只保留这条能力
边界，不保留 URL 或 curl 示例，也不执行这些操作。需要扩展时，先由 Science Server
暴露 operation 和请求 schema，再更新本 reference。
