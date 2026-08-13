> **前置条件：** 先阅读 [`../delta-shared/SKILL.md`](../delta-shared/SKILL.md) 了解认证、配置和通用错误处理。

# Delta Sandbox 生命周期

## 完整流程

1. **查看可用镜像** `delta-cli sandbox images` — 查询服务端支持的镜像列表。镜像决定了容器内的语言运行时（Python / Node.js / Go / Java / Rust 等），根据用户的技术栈和 GPU/CPU 需求匹配。
2. **列出现有 sandbox（可选）** `delta-cli sandbox list` — 查看当前用户已创建的活跃 sandbox，避免重复创建
3. **创建** `delta-cli sandbox create --image <image> --cpu 4 --memory 16Gi --gpu 1 --gpu-mem 8000 --max-life 120`（创建后立即可用，无需连接；--max-life 指定 sandbox 最大存活时间（分钟），默认 30。`--no-auto-cleanup` 可让 sandbox 不被自动清理，仅显式 kill/finish 可销毁。`--provider autodl` 可指定使用 AutoDL 后端。）
4. **写入代码/数据** `delta-cli sandbox write <id> --source <文件名>` — 将本地文件直接写入 sandbox，**不传 `--path` 默认写到该 sandbox 的 working-directory**（`/workspace/{user_id}/{sandbox_id}/<文件名>`，在 OSS 同步范围内，kill 后文件不会丢）。写前可用 `delta-cli sandbox working-directory <id>` 确认路径。**必须**使用相对源路径（如 `--source infer.py`），禁止使用 `"$WORKSPACE_ROOT/<filename>"` 或 `$(pwd)/...`。相对 `--path` 也会拼到 working-directory 下；仅绝对 `--path` 原样使用（`/workspace/<filename>` 根路径不在 OSS 同步范围，不推荐）。也可用 `--data "..."` 写入少量内联内容（需显式 `--path`），`--mode 755` 可设置文件权限。写入后返回的 `size` 字段是 stat 验证后的实际磁盘字节数，可确认写入完整。批量写入用 `write-multiple`。文件路径和扩展名由镜像中的运行时决定。
5. **运行命令** — 先 `delta-cli sandbox working-directory <id>` 查询 `<wd>`，再根据镜像中的运行时构造命令，常见示例：`python <wd>/train.py`（Python）、`node <wd>/app.js`（Node.js）、`go run <wd>/main.go`（Go）、`bash <wd>/run.sh`（Shell）
   - **短任务 ≤60s**：`delta-cli sandbox run <id> --command "<命令>" --timeout <秒>` 同步执行，SSE 原始 `data:` 帧透传到 stdout（无末尾信封），`exit_code`/`log_file` 从 `complete` 帧读取，完整 stdout 写入 log_file
   - **长任务 >60s**：`delta-cli sandbox run-bg <id> --command "<命令>" --timeout <秒> --wait` 后台执行（推荐），或 `run-bg` + `logs` 手动轮询 (run-bg --wait 默认带 --summary；不加 --wait 立即返回 {execution_id, sandbox_id})
6. **读取结果** `delta-cli sandbox read <id> --path <wd>/result.json`（`<wd>` 为 working-directory，可用 `delta-cli sandbox working-directory <id>` 查询） — 返回 `content`（内容）、`size`（磁盘字节，来自 stat）、`content_length`（字符数）。读不存在的文件返回 error 而非空内容。
7. **销毁** `delta-cli sandbox kill <id>`（如需保存结果用 finish，finish 会自动销毁）

> **注意**：server 端没有 sandbox 的自动过期或 TTL 机制，不 kill 会永久占用 GPU 资源。请务必在任务结束后销毁。

## 后台任务

对于长时间运行的任务（>60 秒，如训练、编译、数据处理），使用 `run-bg` 在后台异步执行：

### 方式一（推荐）：`--wait` 一次性等待完成

```bash
delta-cli sandbox run-bg <id> --command "<命令>" --timeout 7200 --wait
```
CLI 通过 SSE 实时流（`/logs/stream`）跟随输出，把原始 SSE 帧（`data: {...}`）**逐帧透传到 stdout**，收到 `complete` 帧即命令结束。**CLI 会在 complete 帧里补全字段**：除服务端给的 `exit_code`/`execution_id`/`error` 外，还注入流内累计的 `stdout`/`stderr`、兜底恢复的 `log_file`，以及检测到的末尾 JSON `result_summary`（stdout 末尾 50 行内若有合法 JSON 对象）。命令非零退出或报错时，CLI **追加一个 `error.type: command_failed` 信封并以非零码退出**（进程退出码 8），便于 `&&` 链和 agent 分支；成功则不追加信封。只消耗 **1 次 tool call**，适合不关心中间进度的场景。

> `--wait` 的 SSE 路径 **complete 帧直接带 `result_summary`**（末尾 JSON 检测到即附上），无需再 `sandbox read <id> --path <log_file>` 反向扫描。仅当末尾没有合法 JSON 时才需手动读 log_file。`--summary`/`--artifacts` 富化（含 hints）仍仅旧服务器回退路径生效。

> **输出契约（SSE 路径）**：`run-bg --wait` 命令成功时 stdout 只有原始 SSE 帧，**没有末尾信封**；命令失败时在 complete 帧后追加 `{"ok":false,"error":{"type":"command_failed",...}}` 信封；`--timeout` 内未结束则追加一个 `finished=false` 的 `CommandLogsResult` 快照信封；旧服务器（无 `/logs/stream` 端点）回退到 5s 轮询并输出 `CommandResult` 信封（`finished` 键始终存在，`finished=true` 时带 `result_summary`/`hints` 富化）。

### 方式二：手动轮询（需要看实时输出时）

```bash
# 1. 启动后台命令
delta-cli sandbox run-bg <id> --command "<命令>" --timeout 7200
# ↑ 返回 execution_id

# 2a. 实时跟随（SSE，推荐）：
delta-cli sandbox logs <id> --execution-id <exec_id> --stream
# ↑ 原始 data: 帧逐帧透传到 stdout，直到 complete 事件，无末尾信封

# 2b. 手动轮询快照（可用 --tail N / --grep <pattern> 过滤大输出）
delta-cli sandbox logs <id> --execution-id <exec_id>
# ↑ 返回 {sandbox_id, execution_id, stderr_tail, stderr_size, cursor, running, finished, exit_code, log_file?}

# 3. 完成后销毁
delta-cli sandbox kill <id>
```

### 轮询判断逻辑

`sandbox logs` 返回的数据结构为：

```json
{"ok":true,"data":{"sandbox_id":"...","execution_id":"...","stdout_tail":"...","stderr_tail":"...","stdout_size":1234,"stderr_size":1234,"cursor":5,"running":false,"finished":true,"exit_code":0,"log_file":"/workspace/{user_id}/{sandbox_id}/{execution_id}/delta-result-{execution_id}.json"}}
```

字段说明：
- `sandbox_id` / `execution_id` — 与请求一致
- `stdout_tail` — CLI 默认保留的 **最后 800 字节** stdout 片段，避免上下文爆炸
- `stderr_tail` — CLI 默认保留的 **最后 200 字节** stderr 片段（CLI 硬编码 `tailString(s, n)` 按字节截取；ASCII 等同 n 字符，多字节 UTF-8 可能被截断），避免上下文爆炸。不传任何 range flag 时，CLI 会把原始 `stdout`/`stderr` 字段清空，只暴露 `stdout_tail`/`stderr_tail` 和 `stdout_size`/`stderr_size`
- `stdout_size` — 原始 stdout 字节数（CLI 端计算）
- `stderr_size` — 原始 stderr 字节数（CLI 端计算）
- `cursor` — 服务端 stderr 行计数器；**该字段无 `omitempty`，永远出现在响应中**（即使为 0）。`cursor=0` 通常意味着服务端从 provider 还没读到任何 stderr 行；**仅凭 cursor 判断停滞不可靠**（纯 stdout 或静默任务 cursor 恒为 0），停滞检测应以 `last_updated` 为主
- `last_updated` — 最近活动时间（RFC3339）。SSE 流式路径由 CLI 填最后 data 帧到达时间；快照轮询路径由服务端填（当前服务端可能缺省），缺失时判断停滞退化用 `cursor`/`stdout_tail` 变化
- `running` — 命令是否仍在运行
- `finished` — 命令是否已完成（`finished = not running`）
- `exit_code` — 退出码（完成后才有值，运行中字段省略）
- `log_file` — 仅 `finished=true` 时出现，是 run envelope 日志文件路径（含完整 stdout + stderr + exit_code + finished + command + error），需读它用 `delta-cli sandbox read <id> --path <log_file>`；SSE 路径下 CLI 已在 complete 帧里兜底补全该字段

**stdout 路径说明**：`sandbox logs` 默认返回 stdout 末尾 800 字节（`stdout_tail`）提供实时中间进度预览，完整 stdout 仍在命令结束时被写入沙箱内的 `log_file`，需全文时用 `sandbox read` 读。SSE 路径下 CLI 已在 complete 帧里带 `stdout`（全文）与 `result_summary`（末尾 JSON 检测到即附上），`--summary` 富化（含 hints）仅旧服务器回退路径生效。

要用 `--tail/--grep/--context` 自定义切片：传任意一个 flag 时，CLI 会把过滤后的 stdout 和 stderr 分别写回 `stdout`/`stderr` 字段并更新 `stdout_size`/`stderr_size`；不传则保持 `stdout=""` + `stdout_tail` 末尾 800 字节预览 + `stderr=""` + `stderr_tail` 末尾 200 字节预览（总计约 1KB）。

```bash
# 看最后 50 行 stdout 和 stderr
delta-cli sandbox logs <id> --execution-id <eid> --tail 50
# 过滤 ERROR/warning 行（同时作用于 stdout 和 stderr）
delta-cli sandbox logs <id> --execution-id <eid> --grep "ERROR|warning" --context 2
```

判断任务状态的规则（按优先顺序）：

1. **`finished=true` + `exit_code=0`** → 正常完成，可以读取结果并销毁 sandbox
2. **`finished=true` + `exit_code≠0`** → 命令执行失败，查看 stderr/error 信息
3. **`running=true`** → 任务仍在运行，继续等待（建议每 15-30 秒查询一次）
4. **连续 3 次 `running=true` 且输出无变化且距离提交超过 60 秒** → 任务可能挂起或无输出，用 `sandbox status <id>` 检查 sandbox 是否存活。判断「输出无变化」：快照里有 `last_updated` 时，直接比较它与当前时间是否持续滞后；缺 `last_updated` 时才退化为 `stderr_tail`/`cursor` 无变化（注意 `cursor` 只反映 stderr 行数，纯 stdout 任务会恒为 0，勿据此误判挂起）
5. **`sandbox status` 返回正常但 logs 仍然无变化** → 用 `sandbox run <id> --command "ps aux | grep <进程名>" --timeout 15` 在容器内检查命令是否还在运行

**注意**：
- `sandbox logs` 只应配合 `sandbox run-bg` 使用；同步 `sandbox run` 的结果直接返回，不能也不应该调用 `logs`。
- `sandbox run-bg` 不加 `--wait` 时，HTTP 请求本身会快速返回 `{execution_id, sandbox_id}`；命令若超时会以非零退出码结束，需后续通过 `logs` 拿 `exit_code`。
- `sandbox run-bg --wait` 模式下，`--timeout` **同时**充当服务端命令执行超时和客户端等待 deadline（默认 300s）；CLI 通过 SSE 实时流（`/logs/stream`）跟随，原始 `data:` 帧透传到 stdout，收到 `complete` 即结束（无末尾信封），超时则追加 `finished=false` 快照信封；初始 `/run-background` POST 有独立的 60s HTTP timeout。
- 后台命令可跨 tool call 轮次查询：保存 `sandbox_id` 和 `execution_id`，后续轮次通过 `sandbox status` / `sandbox logs` 获取结果。
