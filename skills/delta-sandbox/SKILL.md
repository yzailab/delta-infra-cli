---
name: delta-sandbox
version: 1.0.10
description: "通过 Delta Sandbox HTTP API 运行 GPU/CPU 计算任务。适用于训练、微调、CUDA/PyTorch 推理等场景。认证/配置/权限错误转 delta-shared。"
metadata:
  requires:
    bins: ["delta-cli"]
  cliHelp: "delta-cli sandbox --help"
---

**CRITICAL — 开始前 MUST 先用 Read 工具读取 [`../delta-shared/SKILL.md`](../delta-shared/SKILL.md)，其中包含认证、配置和通用错误处理**

# delta-sandbox

## 何时使用

- 用户提到 sandbox、容器、GPU、CUDA、训练、推理、计算任务。
- 用户需要创建/管理 sandbox 实例、在 sandbox 中运行命令、读写文件。
- **不要**用于：认证、配置初始化、权限恢复、更新检查 → 转 `delta-shared`。

## 使用边界

- 所有 sandbox 操作使用 `delta-cli sandbox <subcommand>`。
- delta-cli 不内嵌默认凭证，运行前必须按 `delta-shared` 完成认证配置。
- sandbox_id 必须来自真实返回，不要凭用户口述猜测。

## 强制规则（违规则任务视为失败）

1. **必须使用 delta-cli**：所有 sandbox 操作必须通过 `delta-cli sandbox <subcommand>` 执行。**禁止**用 Python（urllib/httpx/requests）或任何 SDK 直接调用 HTTP API。delta-cli 提供类型化错误输出（`error.type`），是 AI agent 正确解析错误的唯一途径。
2. **必须销毁**：每次 `sandbox create` 成功后，在当前任务的最终 `step_finish` 之前 **必须** 执行 `sandbox kill <id>` 或 `sandbox finish <id>` 销毁 sandbox。未销毁等价于任务失败。
3. **异常时也必须销毁**：即使 sandbox 内命令失败、超时或报错，仍然 **必须** 执行 `sandbox kill <id>`。异常不是跳过销毁的理由。
4. **不得依赖外部清理**：server 端 **没有** sandbox 的自动过期或 TTL 机制。不 kill → sandbox 永久占用 GPU 资源。
5. **一条命令内完成**：从 `create` 到 `kill` 的完整生命周期必须在同一次执行中完成。不允许跨任务保留 sandbox。
6. **禁止重复创建**：同一次任务中只允许存在一个活跃 sandbox。若命令失败需要重试，优先复用已创建的 `sandbox_id`；若确实需要重新创建，必须先 `sandbox kill <旧_sandbox_id>`，确认旧实例销毁后再执行新的 `sandbox create`。可用 `delta-cli sandbox list` 查询当前用户的活跃 sandbox，但 **禁止** 用 list 来绕过“同一次任务只保留一个 sandbox”的规则。

## 快速路由

| 用户目标 | 命令 |
|---------|------|
| 查看可用镜像 | `sandbox images` |
| 列出当前用户的 sandbox | `sandbox list` |
| 创建 sandbox | `sandbox create --image <image>` |
| 连接 sandbox | `sandbox connect <id>` |
| 查看状态 | `sandbox status <id>` |
| 同步运行命令 | `sandbox run <id> --command "..."` |
| 后台运行命令 | `sandbox run-bg <id> --command "..."` |
| 查看后台日志 | `sandbox logs <id> --execution-id <exec_id>`（仅用于 `run-bg`） |
| 读取文件 | `sandbox read <id> --path <path>` |
| 写入文件 | `sandbox write <id> --path <path> --data "..."` |
| 完成 sandbox | `sandbox finish <id> --results '{...}'` |
| 销毁 sandbox | `sandbox kill <id>` |

## 完整生命周期

1. **查看可用镜像**：`delta-cli sandbox images` — 查询服务端支持的镜像列表（含标签、最低资源要求、支持 provider），根据用户需求匹配镜像
2. **创建**：`delta-cli sandbox create --image <img> --cpu 4 --memory 16Gi --gpu 1 --gpu-mem 8000`（创建后 sandbox 立即可用，无需额外连接）。**同一次任务若已有 `sandbox_id`，禁止再次 create，必须优先复用。**
   - 这是 `sandbox create` 支持的完整资源参数集合，不存在其它“更正确”的资源 flag，不要 invented 不存在的参数。
3. **写入代码**：`delta-cli sandbox write <id> --path /workspace/train.py --data "..."`
4. **运行**：`delta-cli sandbox run <id> --command "python /workspace/train.py" --timeout 3600`
   - `sandbox run` 是同步执行，结果（`stdout` / `stderr` / `exit_code`）会直接返回，**不要**再调用 `sandbox logs`
5. **读取结果**：`delta-cli sandbox read <id> --path /workspace/result.json`
6. **销毁**：`delta-cli sandbox kill <id>`（如需保存结果，用 `sandbox finish --results '{...}'` 替代 kill，finish 会自动销毁 sandbox）

详细步骤见 [lifecycle.md](references/lifecycle.md)。

## 常见恢复

| 错误 / 现象 | 恢复动作 |
|-------------|----------|
| `error.type: not_found` | 检查 sandbox_id 是否正确，是否已被 kill |
| `error.type: network` | 检查 base_url 和网络连通性 |
| `error.type: validation` | 检查参数格式和必填 flag |
| `error.type: auth / permission` | 参考 delta-shared 的权限不足处理 |
| `error.type: api`（5xx） | 服务端错误，检查 API 服务状态 |
| 命令执行失败（exit_code ≠ 0） | 查看 `run` 返回的 stdout/stderr |
| 命令超时 | 增加 `--timeout` 或使用 `run-bg` |
