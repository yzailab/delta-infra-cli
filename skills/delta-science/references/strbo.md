# STRBO 详细规则

STRBO 用于服务端固定 **KRAS G12D** 靶点的小分子生成式多目标优化。目标顺序固定为
`[vina, activity]`：vina 越低越好，activity 越高越好。`task` 只引导候选生成，
不会更换靶点；不得声称支持用户自定义受体。

所有调用均使用 `tool="strbo"`。生成、建议、评估和提交 job 都会消耗远端资源，只在
用户确实要求执行相应科研任务时调用；请求结果未知或超时时不得重试。

## 初始化

- 同步 operation：`molecules-init`
- 异步 operation：`molecules-init-job`
- 仅校验 operation：`molecules-init-validate`

```json
{
  "task": "为 KRAS G12D 生成兼顾结合与活性的候选小分子",
  "num_initial": 3,
  "seed": 42
}
```

只需检查参数时使用 validate；正式执行不要先 validate 再提交，避免无必要调用。
成功结果应包含与 `num_initial` 数量一致的候选 SMILES。

## 建议下一批候选

- 同步 operation：`molecules-suggest`
- 异步 operation：`molecules-suggest-job`（重型任务优先）
- 仅校验 operation：`molecules-suggest-validate`

```json
{
  "task": "继续改善 KRAS G12D 的结合与活性",
  "history_xs": ["CCO", "CCN", "CCC"],
  "history_ys": [
    [-6.8, 0.31],
    [-7.1, 0.42],
    [-6.5, 0.28]
  ],
  "num_suggestions": 2,
  "seed": 42
}
```

`history_xs` 与 `history_ys` 必须等长；每个 `history_ys` 元素必须是两个有限数值，
顺序严格为 `[vina, activity]`。不得把预测值伪装成湿实验结果。

## 评估候选

- 同步 operation：`molecules-evaluate`
- 异步 operation：`molecules-evaluate-job`
- 仅校验 operation：`molecules-evaluate-validate`

```json
{
  "designs": ["CCO", "CCN"]
}
```

成功结果中的 score 数量必须与 designs 一致，每行必须恰好有两个有限数值。任一 item
明确失败时，本轮整体按失败处理，不得只报告成功子集。

## 异步作业

提交异步 operation 后，从当前 native 读取非空 `job_id`，再轮询：

```python
invoke("strbo", "job-status", params={"job_id": job_id})
```

只有状态变为 `succeeded` 后才读取：

```python
invoke("strbo", "job-result", params={"job_id": job_id})
```

`queued` 或 `running` 不是完成；`failed` 立即结束。状态查询可按 5 秒左右间隔重复，
但提交 operation 绝不重复。单次用户任务的总等待上限为 15 分钟；超限后报告作业仍
未完成并保留 job_id，不得声称远端已取消。

## 完整科研流程

用户明确要求完整迭代时按 `初始化 → 评估 → 建议 → 评估` 串行执行。每一步只使用本次
调用已验证的 native 作为下一步输入。用户只要求生成初始候选或评估给定 SMILES 时，
不得擅自扩展为完整循环。
