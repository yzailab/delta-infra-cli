> **前置条件：** 先阅读 [`../delta-shared/SKILL.md`](../delta-shared/SKILL.md) 了解认证、配置和通用错误处理。

# Delta Sandbox 生命周期

## 完整流程

1. **查看可用镜像** `delta-cli sandbox images` — 查询服务端支持的镜像列表。镜像决定了容器内的语言运行时（Python / Node.js / Go / Java / Rust 等），根据用户的技术栈和 GPU/CPU 需求匹配。
2. **列出现有 sandbox（可选）** `delta-cli sandbox list` — 查看当前用户已创建的活跃 sandbox，避免重复创建
3. **创建** `delta-cli sandbox create --image <image> --cpu 4 --memory 16Gi --gpu 1 --gpu-mem 8000 --max-life 120`（创建后立即可用，无需连接；--max-life 指定 sandbox 最大存活时间（分钟），默认 30；这些是 `create` 全部资源参数，不要发明其它 flag。`--provider autodl` 可指定使用 AutoDL 后端。）
4. **写入代码/数据** `delta-cli sandbox write <id> --path /workspace/<filename> --source <文件名>` — 将本地文件直接写入 sandbox。**必须**使用相对路径（如 `--source infer.py`），禁止使用 `"$WORKSPACE_ROOT/<filename>"`。也可用 `--data "..."` 写入少量内联内容，`--mode 755` 可设置文件权限。写入后返回的 `size` 字段是 stat 验证后的实际磁盘字节数，可确认写入完整。批量写入用 `write-multiple`。文件路径和扩展名由镜像中的运行时决定。
5. **运行命令** — 根据镜像中的运行时构造命令，常见示例：`python /workspace/train.py`（Python）、`node /workspace/app.js`（Node.js）、`go run /workspace/main.go`（Go）、`bash /workspace/run.sh`（Shell）
   - **短任务 ≤60s**：`delta-cli sandbox run <id> --command "<命令>" --timeout <秒>` 同步执行，返回 `stdout`/`stderr`/`exit_code` (默认带 --summary，返回 JSON data.result_summary 已含 stdout 末尾 JSON 提取结果)
   - **长任务 >60s**：`delta-cli sandbox run-bg <id> --command "<命令>" --timeout <秒> --wait` 后台执行（推荐），或 `run-bg` + `logs` 手动轮询 (run-bg --wait 默认带 --summary；不加 --wait 立即返回 {execution_id, sandbox_id})
6. **读取结果** `delta-cli sandbox read <id> --path /workspace/result.json` — 返回 `content`（内容）、`size`（磁盘字节，来自 stat）、`content_length`（字符数）。读不存在的文件返回 error 而非空内容。
7. **销毁** `delta-cli sandbox kill <id>`（如需保存结果用 finish，finish 会自动销毁）

> **注意**：server 端没有 sandbox 的自动过期或 TTL 机制，不 kill 会永久占用 GPU 资源。请务必在任务结束后销毁。

## 后台任务

对于长时间运行的任务（>60 秒，如训练、编译、数据处理），使用 `run-bg` 在后台异步执行：

### 方式一（推荐）：`--wait` 一次性等待完成

```bash
delta-cli sandbox run-bg <id> --command "<命令>" --timeout 7200 --wait
```
CLI 内部每 5 秒轮询一次，`finished=true` 时返回，结果中包含 `execution_id`。只消耗 **1 次 tool call**，适合不关心中间进度的场景。

> `--wait` 默认带 `--summary`，返回的 JSON `data.result_summary` 字段已包含 stdout 末尾结构化 JSON 的提取结果。常用场景无需再调 `sandbox read` 二次解析 result_file。

### 方式二：手动轮询（需要看实时输出时）

```bash
# 1. 启动后台命令
delta-cli sandbox run-bg <id> --command "<命令>" --timeout 7200
# ↑ 返回 execution_id

# 2. 手动轮询进度（可用 --tail N / --grep <pattern> 过滤大输出）
delta-cli sandbox logs <id> --execution-id <exec_id>
# ↑ 返回 {content, cursor, running, finished, exit_code}

# 3. 完成后销毁
delta-cli sandbox kill <id>
```

### 轮询判断逻辑

`sandbox logs` 返回的数据结构为：

```json
{"ok":true,"data":{"content":"...","cursor":5,"running":false,"finished":true,"exit_code":0}}
```

字段说明：
- `content` — 命令的标准输出
- `cursor` — 输出行数计数器
- `running` — 命令是否仍在运行
- `finished` — 命令是否已完成（`finished = not running`）
- `exit_code` — 退出码（完成后才有值，运行中为 null）

判断任务状态的规则（按优先顺序）：

1. **`finished=true` + `exit_code=0`** → 正常完成，可以读取结果并销毁 sandbox
2. **`finished=true` + `exit_code≠0`** → 命令执行失败，查看 stderr/error 信息
3. **`running=true`** → 任务仍在运行，继续等待（建议每 15-30 秒查询一次）
4. **连续 3 次 `running=true` 且 `content`/`cursor` 无变化且距离提交超过 60 秒** → 任务可能挂起或无输出，用 `sandbox status <id>` 检查 sandbox 是否存活
5. **`sandbox status` 返回正常但 logs 仍然无变化** → 用 `sandbox run <id> --command "ps aux | grep <进程名>" --timeout 15` 在容器内检查命令是否还在运行

**注意**：
- `sandbox logs` 只应配合 `sandbox run-bg` 使用；同步 `sandbox run` 的结果直接返回，不能也不应该调用 `logs`。
- `sandbox run-bg` 的 `--timeout` 传给服务端作为命令超时，HTTP 请求本身会快速返回；命令若超时会以非零退出码结束。
- 后台命令可跨 tool call 轮次查询：保存 `sandbox_id` 和 `execution_id`，后续轮次通过 `sandbox status` / `sandbox logs` 获取结果。
