---
name: synbo-service
description: 当用户需要对分类反应条件空间做初始采样，或基于真实历史反应结果使用 SynBO 推荐下一批催化剂、溶剂、碱等条件时使用。支持 health、initialize、optimize；所有调用只走 Delta CLI，重型 optimize 串行执行且超时不自动重试。
---

# SynBO 服务

## 强制规则

- 只用 `python_repl` 执行 `$SKILLS_ROOT/delta-science/scripts/invoke.py`，
  tool=`synbo`；禁止 Bash、路径探测、字面 CLI、直接 HTTP 和本地 SynBO/GP。
- `python_repl` 工具参数只能包含 `code`，禁止 `deps/dependencies/packages`。
- 业务结果直接位于 `r["native"]`，禁止 `native.data`。
- `health` 无 body；`initialize` 和 `optimize` 使用 `--data-json`。
- 重型调用串行执行；timeout/断连结果未知，不自动重试。

## operation 选择

- `initialize`：没有 measured previous results 时使用。提供 `condition_dict`、
  `opt_metrics`、方向/range/weight 设置、batch_size、sampling_method 和 seed。
- `optimize`：只有存在真实历史时使用。每一行必须包含全部 condition 列和全部数值
  metric 列；有界 CPU 测试用 `accuracy:"tiny"`、`device:"cpu"`。
- descriptors 如提供，键必须与 condition_dict 完全一致，index 列存在且其余为数值。

完整成功 payload 见 `references/endpoints.md`。若 optimize 返回数组维度错误、timeout、
空 recommendations 或后端失败，报告“未产生推荐”，不得用本地 GP、UCB、响应面、
随机采样或人工排序替代。

通过 wrapper 调用一次，显式打印 recommendations/metadata/warnings 或有界错误；成功
后立即 `step_finish(status="done", summary=<同一 JSON>)`，失败则
`step_finish(status="failed", summary=<原始错误短摘要>)`。禁止后续工具。
