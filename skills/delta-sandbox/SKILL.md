---
name: delta-sandbox
version: 1.0.10
description: "通过 Delta Sandbox HTTP API 在 Linux 容器中运行任意计算任务。适用于训练、推理、编译、数据处理等场景。支持 Python / Node.js / Go / Java / Rust 等语言。认证/配置/权限错误转 delta-shared。"
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
5. **同步任务一条命令内完成，后台任务可跨轮次**：
   - 同步模式（`sandbox run`）：从 `create` 到 `kill` 的完整生命周期必须在同一次执行中完成。不允许跨任务保留。
   - 后台模式（`sandbox run-bg`）：允许在当前执行中将 `sandbox_id` 和 `execution_id` 报告给用户，后续轮次通过 `sandbox status` + `sandbox logs` 获取结果。任务完成后仍需 `sandbox kill`。
6. **禁止重复创建**：同一次任务中只允许存在一个活跃 sandbox。若命令失败需要重试，优先复用已创建的 `sandbox_id`；若确实需要重新创建，必须先 `sandbox kill <旧_sandbox_id>`，确认旧实例销毁后再执行新的 `sandbox create`。可用 `delta-cli sandbox list` 查询当前用户的活跃 sandbox，但 **禁止** 用 list 来绕过“同一次任务只保留一个 sandbox”的规则。

7. **长任务必须后台执行**：预计执行时间超过 60 秒的任务（例如下载模型、训练、微调、长推理、大规模数据处理），**必须**使用 `delta-cli sandbox run-bg <id> --command "..." --timeout <秒>` 提交为后台任务，禁止使用同步的 `sandbox run`。
   - 轮询用 `delta-cli sandbox logs <id> --execution-id <exec_id>`，每 15-30 秒一次。
   - 完成判断（按优先级）：
     a) `finished=true` + `exit_code=0` → 正常完成
     b) `finished=true` + `exit_code!=0` → 命令执行失败，查看 stderr
     c) `running=true` → 仍在运行，继续等待
   - 也可用 `delta-cli sandbox status bg <id> --execution-id <exec_id>` 直接查询后台命令的运行状态和退出码。
   - 故障诊断：连续 3 次 `running=true` 且 `content`/`cursor` 无变化且距离提交超过 60 秒 → 用 `sandbox status <id>` 检查 sandbox 是否存活。如果 sandbox 正常但 logs 无输出，用 `sandbox run <id> --command "ps aux" --timeout 15` 在容器内检查进程状态。
   - 后台任务成功后仍需按规则 2/3 销毁 sandbox。

8. **写入文件禁止使用路径或 Shell 变量，仅允许文件名**：
   - ❌ **禁止**：`--source "$WORKSPACE_ROOT/train.py"`、`--source "$(pwd)/train.py"`（Shell 展开路径 → 空文件或失败）
   - ❌ **禁止**：`--data "大量代码..."`（Shell 转义问题）
   - ✅ **正确**：`delta-cli sandbox write <id> --path /workspace/train.py --source train.py`（仅文件名）
   - 少量配置（< 20 行）可用 `--data "..."`。`--mode 755` 可设置文件权限。

9. **每个 `run-bg` 生成独立 `execution_id`**：每次调用 `sandbox run-bg` 都会返回一个唯一的 `execution_id`，多个后台任务之间通过它区分。务必保存每次返回的 `execution_id` 并与任务对应，后续通过 `sandbox logs <id> --execution-id <exec_id>` 分别查询各任务的结果。同步 `sandbox run` 无需 `execution_id`，结果直接返回。

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
| 查询命令状态 | `sandbox status bg <id> --execution-id <exec_id>` |
| 读取文件 | `sandbox read <id> --path <path>` |
| 写入文件 | `sandbox write <id> --path <path> --source <本地路径>`（推荐）|
| 完成 sandbox | `sandbox finish <id> --results '{...}'` |
| 销毁 sandbox | `sandbox kill <id>` |

## 完整生命周期

1. **选择镜像并查看可用镜像**：`delta-cli sandbox images` — 查询服务端支持的镜像列表，根据用户需求的编程语言和工具链匹配镜像。例如 `deltarouter/python:latest`（Python）、`node:20`（Node.js）、`golang:1.23`（Go），镜像决定了容器内可用的语言/运行时环境。
2. **创建**：`delta-cli sandbox create --image <img> --cpu 4 --memory 16Gi --gpu 1 --gpu-mem 8000 --max-life 120`（创建后 sandbox 立即可用，无需额外连接）。**同一次任务若已有 `sandbox_id`，禁止再次 create，必须优先复用。**
   - --max-life 指定 sandbox 最大存活时间（分钟），默认 30。长任务请调高，确保 sandbox 在命令执行期间不被回收。
   - 这是 `sandbox create` 支持的完整资源参数集合，不存在其它“更正确”的资源 flag，不要发明不存在的参数。
3. **写入代码/数据**：`delta-cli sandbox write <id> --path /workspace/<filename> --source <文件名>` — **必须**使用相对路径（如 `--source train.py`），**禁止**使用 `"$WORKSPACE_ROOT/train.py"` 或 `$(pwd)/train.py` 等 Shell 变量路径。`--source` 让 CLI 自行读取本地文件，不会经过 Shell 展开，是最安全的方式。少量配置（<20 行）可用 `--data "..."`。文件路径和扩展名由镜像中的运行时决定。
4. **运行命令**：
   - **短任务（预计 ≤ 60 秒）**：`delta-cli sandbox run <id> --command "<命令>" --timeout <秒>` 同步执行，结果（`stdout` / `stderr` / `exit_code`）直接返回，**不要**再调用 `sandbox logs`。根据镜像中的运行时构造命令，常见示例：
     - Python：`python /workspace/train.py`
     - Node.js：`node /workspace/app.js`
     - Go：`go run /workspace/main.go`
     - Shell：`bash /workspace/run.sh`
   - **长任务（预计 > 60 秒，如下载模型、训练、编译、大规模数据处理）**：`delta-cli sandbox run-bg <id> --command "<命令>" --timeout <秒>` 提交后台任务，获得 `execution_id` 后通过以下命令轮询：
     - `delta-cli sandbox logs <id> --execution-id <execution_id>` — 返回 `content`、`cursor`、`running`、`finished`、`exit_code`。当 `finished=true` 时认为完成。
     - `delta-cli sandbox status bg <id> --execution-id <execution_id>` — 返回 `running`、`finished`、`exit_code`。
     禁止对长任务使用同步 `sandbox run`
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
| `error.type: internal` | 客户端内部错误，检查 delta-cli 版本或联系维护者 |
