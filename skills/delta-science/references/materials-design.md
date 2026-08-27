# Materials Design 详细规则

Materials Design 用于从实验或计算材料表格中建立 surrogate、验证模型、定义可行候选空间，
并生成带不确定性的候选排序。推荐是待验证假设，不是已确认材料、合成方案或实验结果。

本 reference 的路由标签是 `materials-design`。`tools.name` 和
`tool_endpoints.name` 仍以当前 `delta-cli science list` 和
`delta-cli science endpoints list <tool>` 的返回为准；下列 Gateway 路径只是服务契约，
不是可以直接拼接或访问的 URL。

## 服务边界

服务提供以下能力：

| 服务路径 | 作用 | 结果边界 |
| --- | --- | --- |
| `/chem/materials-design/health` | Gateway 到服务的就绪检查 | `status`、依赖可用性、limits |
| `/chem/materials-design/v1/capabilities` | 输入格式、模型、验证模式和限制 | 能力目录 |
| `/chem/materials-design/v1/jobs` | 上传训练/候选表并创建异步作业 | `202`、`job_id`、状态和 links |
| `/chem/materials-design/v1/jobs/{job_id}` | 查询作业 | `status`、`result_status`、result、warnings |
| `/chem/materials-design/v1/jobs/{job_id}/cancel` | 请求取消 | 取消请求/终态 |
| `/chem/materials-design/v1/jobs/{job_id}/artifacts` | 列出产物 | name、size、media_type、SHA-256 |
| `/chem/materials-design/v1/jobs/{job_id}/artifacts/{path}` | 下载单个产物 | 原始 report/JSON/CSV/figure bytes |

所有实时调用都必须走：

```text
delta-cli science invoke --tool TOOL --endpoint ENDPOINT --data JSON
```

只读 query operation 才使用 `--params JSON`。如果新工具尚未出现在目录中，或目录没有
返回足够的请求 schema，停止并报告未暴露；不要猜测 endpoint 名、body 或兼容别名。

## CLI 能力边界

`POST /v1/jobs` 的原始服务请求是 `multipart/form-data`，至少包含：

```text
file=<training table>
candidate_file=<optional candidate table>
config=<serialized JSON object>
```

当前通用 `delta-cli science invoke` 只接受 JSON object body 和 JSON query 参数，不能表达
multipart 文件上传，也不能把本地路径或 base64 伪装成文件字段。artifact 下载同样是原始
bytes，不应当当作普通 JSON 结果。只有 Science Server 目录明确提供等价的文件/adapter
operation 时，才通过 CLI 调用；否则 Materials Design 的作业提交或文件下载属于当前 CLI
未暴露能力，未发送远端请求。不得调用 `materials-design-service:8900` 或直连 preflight
Gateway。

## 输入与配置

开始建模前必须确认：

- `feature_columns`、`controllable_columns`、`target_column` 或 `objectives`；
- identifier、metadata、leakage、post-measurement、group/time 列及单位；
- 目标方向、可行性约束、候选表或候选生成规则；
- 缺失值、重复样本、测量条件、数据来源和验证切分策略。

单目标配置的核心字段：

```json
{
  "feature_columns": ["Bi", "In", "Ti"],
  "controllable_columns": ["Bi", "In", "Ti"],
  "identifier_columns": ["sample_id"],
  "target_column": "T",
  "target_direction": "maximize",
  "validation": {"strategy": "kfold", "n_splits": 5},
  "model_names": ["ExtraTrees", "GPR", "Ridge"],
  "random_state": 42,
  "recommendation_count": 10
}
```

多目标使用 `objectives: [{"target_column": "...", "direction": "maximize|minimize"}]`
和显式的 Pareto/EHVI 配置。优先传入用户的 `candidate_file`；若服务按观测范围生成
候选，必须显式保留 steps、hard constraints、composition closure、`max_candidates` 和
`allow_extrapolation`。禁止优化 identifier、测量后变量、泄漏列或未获授权的域外点，禁止
为填充候选数而任意外推。

## 结果处理

作业 `status` 与 `result_status` 必须分开判断：

- `status`：`pending`、`running`、`completed`、`failed`、`cancelled`；
- `result_status`：`complete`、`exploratory`、`readiness_only` 或 `failed`。

`202` 只表示服务已接收/排队，不表示模型训练完成；`completed` 也不表示排序可靠。
只有在 `result_status` 为 `complete` 时才能说数据和验证支持候选排序；`exploratory` 只能
作为学习假设；`readiness_only` 要读取 readiness 信息并请求缺失输入；`failed` 原样报告。
始终保留服务返回的 validation、ranking、warnings 和 error。

预测结果必须和观测值、交叉验证预测区分。报告至少说明数据覆盖、切分、模型比较、
不确定性校准、候选可行性、域内/域外状态、EI/PI/UCB 或 Pareto 设置，以及后续实验验证
计划；不要用模型方差冒充实验误差或把候选预测写成实测值。

## Artifact 与错误

只有用户要求或工作流需要时才读取 artifacts。按 listing 返回的 `size`、`media_type` 和
SHA-256 校验下载内容；不能凭文件名猜格式。服务可能产生 `report.html`、`result.json`、
`data_dictionary.json`、`model_comparison.csv`、OOF/残差/校准文件、`search_space.json`、
`candidate_predictions.csv`、`shortlist.csv`、`recommendation_views.csv`、
`pareto_front.csv` 和 `figures/*`。

常见终止条件包括配置/文件格式错误、缺目标或候选空间、超出上传/行数/候选数限制、
后端未就绪、作业不存在和 artifact 不存在。提交超时或连接中断时不要盲目重试：multipart
上传可能已经创建作业，先检查是否已经得到 `job_id`。失败或空推荐不得用本地回归、GP、
随机数或人工排序替代。
