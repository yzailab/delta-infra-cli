# Quantum ESPRESSO DFT 详细规则

QE 用于通过 Chemistry Gateway 执行可追踪的异步 Quantum ESPRESSO 工作流。agent 只接触
Gateway/Science Server contract，不运行本地 `pw.x`，不调用内部 QE 容器，也不提交 shell
命令、scheduler 脚本、`pseudo_dir`、`outdir` 或主机路径。

本 reference 的服务路由标签为 `qe`，preflight 中对应的领域 skill 名为 `qe-dft`。
实际 `tools.name` 与 `tool_endpoints.name` 必须逐字取自当前 CLI catalog。下列路径是 QE
服务契约，不是可直接访问的 URL，也不是可以自动改写的 endpoint 别名。

## 能力分组

| 服务路径 | 作用 | 类型 |
| --- | --- | --- |
| `/chem/qe/health`、`/healthz`、`/readyz` | 运行时、scheduler、存储和 PP 就绪 | 只读 |
| `/chem/qe/v1/qe/workflow-types` | workflow catalog 和支持状态 | 只读 |
| `/chem/qe/v1/pp-sets`、`/pp-locks/{digest}` | 已发布 PP profile/lock | 只读 |
| `/chem/qe/v1/pp-sets:resolve` | 按 campaign 元素全集解析 PP 候选 | 只读/校验 |
| `/chem/qe/v1/artifacts` | 上传、查询和下载结构/fixed-coordinate artifact | 文件/二进制 |
| `/chem/qe/v1/qe/jobs` | 提交异步计算并查询 job | 远端变更 |
| `/chem/qe/v1/qe/jobs/{job_id}/events`、`steps`、`logs`、`artifacts` | 读取作业过程和结果 | 只读 |
| `/chem/qe/v1/qe/jobs/{job_id}:cancel`、`:retry`、`:review` | 取消、重试和科学审核 | 远端变更 |

选择新工具或新 operation 时，依次使用：

```text
delta-cli science list
delta-cli science endpoints list <exact tool name>
```

再用目录返回的精确名称调用；如果 catalog 没有 schema，不猜测 operation、路径参数、
请求头或 body。

## 当前 CLI 的文件和请求头边界

结构 artifact 上传需要 `application/octet-stream` 和 query metadata，QE job 提交要求
稳定的 `Idempotency-Key`。当前通用 `delta-cli science invoke` 只有 JSON body/query 参数，
没有原始二进制上传、multipart 或自定义请求头 flag。因此：

- 只有在 Science Server 已提供明确等价 adapter 时，才可以通过 CLI 解析 PP、提交 job
  或上传 artifact；
- 不要把结构文本、文件路径、base64、`Idempotency-Key` 或 QE service credential 当成
  普通业务字段发送；
- 若目录没有 adapter，报告“当前 CLI 未暴露该 operation；未发送远端请求”，不要调用
  公开/私有 Gateway URL 或 `qe-cloud-compute:18020`。

## 新作业的正确顺序

1. 读取 health；需要部署诊断时再读取 readiness，并从 workflow catalog 选择当前
   `supported` 的 task。
2. 计算完整 `campaign_elements` 集合，使用 `pp-sets:resolve` 得到 profile；生产作业
   必须使用服务返回的 `pp_set_id` 与不可变 `lock_id`，不能只凭 profile 名称推断 lock。
3. 让服务校验结构 artifact，job 只引用返回的 `sha256:<digest>` artifact ID。
4. 用稳定幂等语义提交 `qe/jobs`；接收 `202` 只代表 accepted/queued，不代表 QE 已收敛。
5. 轮询 job、events、steps、logs 和 artifacts；独立读取 `execution`、`solver`、
   `scientific` 三个状态。
6. 下载结果时校验每个 artifact 的 SHA-256，并分别报告 selected backend、资源 telemetry、
   solver 状态、scientific review 状态和 warnings。

PP 解析的最小业务数据形状如下；其中值必须来自当前服务/目录，不能填入虚构的生产 lock：

```json
{
  "campaign_id": "si-bulk-scf-v1",
  "campaign_elements": ["Si", "O"],
  "workflows": ["qe.pw.scf"],
  "explicit_mode": null
}
```

作业的核心结构如下，`workflow_inputs` 必须遵循当前 task schema：

```json
{
  "task": "qe.pw.scf",
  "schema_version": "1.1",
  "campaign_id": "si-bulk-scf-v1",
  "campaign_elements": ["Si"],
  "structure": {"format": "artifact", "artifact_id": "sha256:<64-hex>"},
  "physics": {
    "parameter_set": "<approved-parameter-set>",
    "pp_policy": {
      "mode": "sssp_single",
      "pp_set_id": "<approved-pp-set>",
      "lock_id": "sha256:<64-hex>"
    },
    "kpoints": [4, 4, 4]
  },
  "resources": {
    "profile": "standard",
    "nodes": 1,
    "mpi_ranks_per_node": 1,
    "omp_threads_per_rank": 1,
    "walltime_seconds": 3600,
    "gpu_policy": "cpu"
  },
  "client_request_id": "si-scf-v1",
  "workflow_inputs": {}
}
```

## CPU/GPU 与状态解释

CPU 是默认策略，尤其适用于小/中型交互任务、PP/结构/审计/归档任务和成本敏感场景。
只有用户明确要求或项目已有 GPU 预算，并且 live catalog 返回
`gpu_support_status: "verified"` 时，才使用 `gpu`；强制 GPU 不得静默回退 CPU。只有
结果明确返回 `selected_backend: "gpu"` 才能声称实际使用 GPU；`auto` 不是 GPU 使用证明。

三个状态通道不可合并：

- `execution`：prepared/submitted/queued/running/scheduler completion/cancelled/failed；
- `solver`：not started/running/converged/not converged/failed/unknown；
- `scientific`：unreviewed、scientifically accepted、accepted with limitations、needs
  recalculation、not assessable、failed 或 archived。

scheduler 完成不等于 solver 收敛，solver 收敛也不等于 scientific acceptance。按稳定
错误码而不是 message 分支，重点包括 `PP_SET_INCOMPLETE`、`PP_POLICY_INCOMPATIBLE`、
`PP_CAPABILITY_UNKNOWN`、`ARTIFACT_MISSING`、`SOLVER_NOT_CONVERGED`、
`SCIENTIFIC_GATE_FAILED`、`RESTART_INCOMPATIBLE`、`IDEMPOTENCY_CONFLICT`、
`EXECUTION_BACKEND_NOT_READY`、`GPU_UNSUPPORTED` 和 `GPU_UNAVAILABLE`。

提交、取消、重试或审核属于远端变更，必须有用户明确授权；结果未知时禁止重试。不要把
GPU smoke test、scheduler 日志或可解析的 QE 输出描述成科学结论或客户级性能保证。
