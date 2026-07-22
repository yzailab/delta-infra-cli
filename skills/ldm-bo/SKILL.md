---
name: ldm-bo
description: 当用户要求对小分子 SMILES 使用 LDM-BO/PDF2Dock、Vina+NN、ReaSyn，生成下一条小分子候选或运行分子 BO trajectory 时使用。不得用于抗体、CDRH3、AntBO 或 /biology/antbo 场景；这些场景必须路由 antbo-service。
---

# 小分子 LDM-BO 服务

## 强制规则

- 只用 `python_repl` 执行 `$SKILLS_ROOT/delta-science/scripts/invoke.py`，
  tool=`ldm-bo`；禁止 Bash、路径探测、字面 CLI、直接 HTTP 和本地 PDF2Dock。
- `python_repl` 工具参数只能包含 `code`，禁止 `deps/dependencies/packages`。
- 业务结果直接位于 `r["native"]`，禁止 `native.data`。
- provider、模型路径、Vina/ReaSyn/GPU/LLM 配置由服务端注入，不放入请求 JSON。
- 抗体/CDRH3 即使出现 “LDM” 也禁止调用本 Skill。

## operation 选择

- `health`：检查 PDF2Dock/Vina/ReaSyn/NN/LLM 等部署依赖，无 body。
- `recommend`：`method`、小分子 `pool`、真实
  `history:[{smiles,scores}]`、`batch_size`。
- `trajectory`：保留连字符键 `seed-smiles`、`num-evaluations`、`batch-size`，以及
  method、seed、objective；有界 smoke 使用 `bo-tanimoto` 和很小 evaluation 数。

详细最小 payload 和 native 响应见 `references/endpoints.md`。缺 Vina、ReaSyn、模型或
LLM 配置时原样报告后端错误，不切换方法或本地生成候选。

通过 wrapper 调用一次并显式打印有界 native 投影；成功后立即
`step_finish(status="done", summary=<同一 JSON>)`，失败则
`step_finish(status="failed", summary=<原始错误短摘要>)`。禁止重试和后续工具。
