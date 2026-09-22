# XRD Cloud Compute 详细规则

`xrd` 是通过 Science 工具代理访问 XRD cloud compute 的真实工具。所有调用必须经由
`delta-cli`，禁止使用 broker URL、`curl`、`requests`、`httpx`、浏览器或本地 XRD
科学库绕过 CLI。本文是 `delta-science` 的工具 reference，不是第二套 HTTP 客户端。

## 工具与 endpoint

执行前使用实时目录确认当前环境中的 canonical 名称和启用状态：

```text
delta-cli science list
delta-cli science endpoints list xrd
```

`xrd` endpoint 名称必须逐字取自第二条命令的结果。当前 reference 覆盖以下稳定契约：

| endpoint | 方法/用途 | 请求类型 |
| --- | --- | --- |
| `healthz`、`readyz`、`capabilities`、`xmatcher-status` | 就绪、能力和数据库状态 | 只读 JSON |
| `xmatcher-artifacts` | 上传观测曲线、模型输入、CIF 或仪器参数 | `invoke --file` |
| `xmatcher-artifact`、`xmatcher-artifact-content` | 查询/读取 artifact | `invoke --path-params` |
| `xqueryer-predictions` | XQueryer 单相候选预测 | JSON |
| `xmatcher-detect-peaks`、`xmatcher-match` | 峰检测和单相匹配 | JSON |
| `xmatcher-multiphase-match`、`xdecomposer-predictions` | 多相匹配和相分解 | JSON |
| `xmatcher-cif-xrd`、`xmatcher-pdf-peaks-xlsx` | CIF 模拟及 PDF 峰表导出 | JSON/二进制 |
| `xmatcher-refinement-patterns` | 生成精修输入和 provenance manifest | JSON |
| `refinement-fullprof`、`refinement-gsasii`、`refinement-wpem` | 提交对应后端精修作业 | JSON + header |
| `refinement-job`、`refinement-job-events`、`refinement-job-artifacts` | 查询精修作业 | `invoke --path-params` |
| `refinement-job-cancel` | 请求取消精修作业 | `invoke --path-params` |
| `mp500-cif-exports` | MP500 结构导出为 CIF | JSON |

目录是最终权威。若 endpoint 不在实时目录中，停止并报告配置问题，不改名重试。

## CLI 参数映射

```text
--data          上游 JSON body
--params        上游 URL query 参数
--path-params   替换 endpoint path 中的 {artifact_id}/{job_id}
--headers       额外上游请求头，例如 Idempotency-Key
--file          将本地文件通过 file_base64 传给工具代理
--content-type  file 的原始 MIME 类型
```

`--params` 不能替代 `--path-params`。不要把本地路径、base64、路径参数或幂等键塞进
普通业务 `--data`。`science file` 是 QE/Materials Design 等独立文件接口；XRD 的
`xmatcher-artifacts` 属于工具代理 endpoint，应使用 `science invoke --file`。

## 调用顺序

1. 用户明确要求诊断或执行时，先读取 `healthz`；需要选择后端时再读取
   `capabilities`。
2. 通过 `xmatcher-artifacts` 上传真实文件，保存返回的 `artifact_id` 和 `sha256`。
3. 观测数据使用 `xmatcher-match`、`xmatcher-multiphase-match` 或
   `xdecomposer-predictions`；XQueryer 使用 `model_input_pattern`。
4. CIF 模拟使用 `xmatcher-cif-xrd`；精修先调用 `xmatcher-refinement-patterns`，再选择
   与 `data.backends` 一致的 refinement endpoint。
5. 精修提交后用 `refinement-job`、`refinement-job-events` 和
   `refinement-job-artifacts` 读取状态和产物。

不要把服务返回的 queued、scheduler completed 或 backend success 直接描述成科学结论。
精修至少分开报告传输/作业终态、后端执行状态和科学接受状态。

## 就绪检查

```text
delta-cli science invoke --tool xrd --endpoint healthz
delta-cli science invoke --tool xrd --endpoint capabilities
```

只有需要诊断或用户明确要求时才额外调用 readiness/status。能力结果中的每个所需组件
都必须满足 `available`；生产任务还应检查 `asset_release_approved`、checksum 字段和
warnings。`auto` 不代表实际使用 GPU，只有结果明确返回 GPU backend 才能这样报告。

## Artifact 上传与身份

上传观测曲线：

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-artifacts `
  --file observed.csv `
  --params '{"filename":"observed.csv","kind":"observed_pattern","media_type":"text/csv"}' `
  --content-type application/octet-stream
```

允许的 `kind` 为：`observed_pattern`、`model_input_pattern`、`cif`、
`instrument_parameters`。成功响应中的 `artifact_id` 和 `sha256` 必须成对保存并原样
传给下游。模式文件会在服务端标准化，返回的 digest 是标准化 artifact 的 digest，
不是一定等于本地上传字节的 digest。

查询 artifact 时使用路径参数：

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-artifact `
  --path-params '{"artifact_id":"art_<returned-id>"}'
```

二进制内容响应可能返回 `data._binary=true`、`content_base64`、`media_type` 和
`content_length`。只有用户要求保存或工作流需要时才解码，并按服务返回的 SHA-256
校验；不要凭文件名猜测格式。

## 相识别与匹配

XQueryer 的 `model_input_pattern` 必须正好包含 3500 个样本，覆盖 10 到 90 度 2theta，
强度不超过服务能力限制：

```text
delta-cli science invoke --tool xrd --endpoint xqueryer-predictions `
  --data '{"schema_version":1,"pattern":{"artifact_id":"art_<model>","sha256":"<sha>"},"top_k":10,"radiation_profile":"CuKa"}'
```

XMatcher 观测曲线：

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-match `
  --data '{"schema_version":1,"pattern":{"artifact_id":"art_<observed>","sha256":"<sha>"},"top_n":10,"element_filter_mode":"contains"}'
```

多相匹配：

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-multiphase-match `
  --data '{"schema_version":1,"pattern":{"artifact_id":"art_<observed>","sha256":"<sha>"},"max_phases":3,"candidate_pool":8}'
```

`xqueryer-predictions` 的 `score` 是 softmax probability；XMatcher 的 `score` 是
`raw_score / 100`。两者不可直接平均或当作同一校准概率。

## CIF 模拟与峰表

`cifs` 中的每个 artifact 都必须同时提供 `artifact_id` 和 `sha256`：

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-cif-xrd `
  --data '{"schema_version":1,"cifs":[{"artifact":{"artifact_id":"art_<cif>","sha256":"<sha>"},"name":"phase"}],"two_theta_range":[5.0,90.0],"wavelength":"CuKa"}'
```

`xmatcher-pdf-peaks-xlsx` 返回二进制 XLSX；只有用户要求导出时才读取和保存它。

## 精修作业

先生成校正曲线和 provenance manifest：

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-refinement-patterns `
  --data '{"schema_version":1,"source_pattern":{"artifact_id":"art_<observed>","sha256":"<sha>"}}'
```

然后使用与 `data.backends` 匹配的 endpoint。示例结构如下，所有 artifact 身份必须来自
当前调用链：

```text
delta-cli science invoke --tool xrd --endpoint refinement-gsasii `
  --data '{"schema_version":1,"radiation_profile":"CuKa","refinement_pattern":{"observed_pattern":{"artifact_id":"art_<obs>","sha256":"<sha>"},"corrected_pattern":{"artifact_id":"art_<corrected>","sha256":"<sha>"},"provenance_manifest":{"artifact_id":"art_<manifest>","sha256":"<sha>"}},"phases":[{"phase_index":0,"name":"phase","cif":{"artifact_id":"art_<cif>","sha256":"<sha>"}}],"wavelengths_angstrom":[1.540593,1.544414],"backends":["gsasii"]}' `
  --headers '{"Idempotency-Key":"<stable-unique-key>"}'
```

`refinement-fullprof`、`refinement-gsasii`、`refinement-wpem` 选择计费/后端入口；不要
因为它们映射到同一路径就互换 endpoint 名或 `backends`。提交、取消、重试和审核是
远端变更，必须得到用户明确授权；超时或连接中断时不要盲目重试，先查询是否已经创建
作业。

查询作业时：

```text
delta-cli science invoke --tool xrd --endpoint refinement-job `
  --path-params '{"job_id":"refjob_<returned-id>"}'

delta-cli science invoke --tool xrd --endpoint refinement-job-events `
  --path-params '{"job_id":"refjob_<returned-id>"}'
```

## 结果与错误

- 只有 CLI 退出码为 0 且顶层 JSON `ok` 为 `true` 才算调用成功。
- 原样保留服务返回的 `data`、warnings、错误 detail 和稳定错误码。
- `202`、`queued` 或 `running` 只代表作业接收/执行状态，不代表 solver 收敛或科学接受。
- `TIER_CONCURRENCY_EXCEEDED`、`Endpoint is disabled`、`ARTIFACT_MISSING`、
  `MP500_IDENTITY_MISMATCH` 等错误应停止当前调用链并报告原始 detail；不要换 endpoint、
  改名、猜参数或用本地算法替代。
- 付费 endpoint 的价格和可用状态以实时目录为准；执行前确认用户确实要求该业务调用。

证据边界：仅限当前 Delta CLI `data` 中的业务结果。
调用链：`delta-cli`。
禁止补充未返回内容：是。
