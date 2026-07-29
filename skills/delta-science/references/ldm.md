# LDM 科研工作流

这里的 **LDM / 大发现模型** 是用户可见的科研工作流名称，不是可以直接访问网关的
tool。在线计算必须先按任务语义选择 `ldm-bo`、`strbo` 或 `antbo`，再通过
`delta-cli science invoke`
调用 Delta CLI；禁止运行旧 `large-discovery-model` Skill、`run_ldm_loop.py`、gateway
backend、`stream_widget` 中的联网命令或任何 HTTP 客户端。

## 路由

| 用户目标 | 实际 tool | 需要同时读取 |
| --- | --- | --- |
| 在给定 SMILES 候选池中推荐下一批，或运行 PDF2Dock/Vina+NN 轨迹 | `ldm-bo` | `references/ldm-bo.md` |
| 围绕服务端固定 KRAS G12D 生成、评估并迭代小分子 | `strbo` | `references/strbo.md` |
| 为指定抗原生成、评估并迭代 11-aa CDRH3 | `antbo` | `references/antbo.md` |

不得因为用户只说“LDM”“药物发现”就自动选择后端。根据实体、已有数据和目标判断；
仍无法区分时，结束并说明需要用户确认“小分子候选池、KRAS G12D 生成优化或抗体
CDRH3”中的哪一种。

## 最小执行范围

- 用户只要求检查参数时，只调用相应 `*-validate` operation。
- 用户只要求评估已有候选时，只调用 evaluate，不生成新候选。
- 用户只要求推荐下一批且已经给出历史记录时，只调用 suggest/recommend。
- 用户明确要求“完整迭代优化”时，才运行初始化、评估、建议、再评估的闭环。
- 用户未给轮数时，STRBO/AntBO 最多执行一个建议轮次；不得沿用旧 Skill 的 6/8 轮
  隐式默认值。LDM-BO `trajectory` 的评估次数必须来自用户，缺失时先要求确认。

生成、评估、建议和 trajectory 都会消耗远端资源。一次自然语言中的“帮我优化”视为
执行授权，但不得擅自扩大候选数、轮数或切换后端。

## STRBO 完整闭环

1. 调用 `molecules-init` 或 `molecules-init-job`，取得初始 SMILES。
2. 调用 `molecules-evaluate` 或对应异步 operation，取得 `[vina, activity]`。
3. 使用当前成功业务响应中的 SMILES 和 scores 构造 `history_xs/history_ys`。
4. 调用一次 `molecules-suggest-job`，按 STRBO reference 轮询至成功。
5. 只评估新建议，并把结果与当前任务内历史合并后返回。

提交 operation 不得重试。任一步失败、超时或返回数量不一致，立即结束；不得用旧
gateway、离线 mock、本地 RDKit/Vina 或模型猜测补全。

## AntBO 完整闭环

1. 用户必须提供抗原；未提供时不得替用户选择。
2. 必要时调用一次 `ldm-health`，确认抗原与 CDRH3 长度约束。
3. 调用 `ldm-init` 取得初始 CDRH3，再调用 `evaluate` 取得结合能。
4. 使用当前成功业务响应构造一维 `history_ys`，调用一次 `ldm-suggest`。
5. 只评估新建议，并返回当前任务内的候选与结合能。

不得把 AntBO 的一维 score 改成 STRBO 的二维 score，也不得把 CDRH3 交给小分子
LDM-BO。

## 固定候选池与轨迹

- 已有候选池和历史分数，要求下一批：使用 `ldm-bo/recommend`。
- 用户明确要求完整 PDF2Dock/Vina+NN 搜索并给出评估次数：使用
  `ldm-bo/trajectory`。
- 不得把 `ldm-bo` 的 provider、模型路径、密钥、GPU 或 Vina 配置放进请求；这些由
  Science Server 管理。

## 结果与展示

只报告当前 Delta CLI 业务响应中真实存在的候选、目标值、warnings、job_id、状态和
服务端 provenance。不得自行添加相似度阈值、机制解释、湿实验结论或“最优”断言；
只有在方向明确且比较集合完整时，才能按实际目标值指出当前集合中的最好候选。
推荐结果中的 acquisition value 不是预测目标值、置信度或推荐理由；除非业务响应
明确给出语义和方向，否则只作为原始采集函数值报告。

LDM 的仪表盘是展示层，不是计算入口。用户明确要求图表时，先完成一次 CLI 计算，
再让外层使用同一份已验证结果绘图；禁止为了仪表盘再次提交远端任务。普通请求直接
返回简洁文本。
