---
name: delta-bo
description: 当用户需要列出当前 Delta-BO 命令，或针对数值、整数、分类实验变量生成随机搜索/贝叶斯优化建议时使用。当前 Delta CLI catalog 只暴露 commands 与 generate；不得通过 Skill 猜测或直连旧的 stateful command API。
---

# Delta-BO 服务

## 强制规则

- 只用 `python_repl` 执行 `$SKILLS_ROOT/delta-science/scripts/invoke.py`，
  tool=`delta-bo`；禁止 Bash、路径探测、字面 CLI、直接 HTTP 和本地 BO。
- `python_repl` 工具参数只能包含 `code`，禁止 `deps/dependencies/packages`。
- 业务结果直接在 `r["native"]`，禁止 `native.data`。
- 当前 catalog 只有 `commands`（无 body）与 `generate`（JSON body）。旧文档中的
  session/space/objective/policy/suggest/observe/loop 等不是当前 CLI operation，
  不得执行或猜 endpoint。

## generate 最小规则

- 没有真实历史，或历史少于 5 条且用户未明确要求 BO：用
  `algorithm:"random-search"`，给有界 `params`、`num_suggestions` 和 seed。
- 有真实历史且明确要求 BO：使用 `objectives`、object-form
  `histories.decisions/observations`，必要时才加入 model/acquisition/solver。
- 参数类型仅 `numeric`、`integer`、`categorical`；不得编造观测或最优结果。
- 只报告 native 的 suggestions、metadata、warnings、diversity；空建议或失败不得用
  本地 GP/UCB/随机数替代。

最小 payload 见 `references/endpoints.md` 的 Stateless Generate。通过 wrapper 一次
调用、校验并显式打印有界 JSON，然后立即
`step_finish(status="done", summary=<同一 JSON>)`；失败则 `status="failed"`。
调用后不得输出自由文本或使用其他工具。
