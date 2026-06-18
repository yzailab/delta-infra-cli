> **前置条件：** 先阅读 [`../delta-shared/SKILL.md`](../delta-shared/SKILL.md) 了解认证、配置和通用错误处理。

# Delta Sandbox 生命周期

## 完整流程

1. **查看可用镜像** `delta-cli sandbox images` — 查询服务端支持的镜像列表。镜像决定了容器内的语言运行时（Python / Node.js / Go / Java / Rust 等），根据用户的技术栈和 GPU/CPU 需求匹配。
2. **列出现有 sandbox（可选）** `delta-cli sandbox list` — 查看当前用户已创建的活跃 sandbox，避免重复创建
3. **创建** `delta-cli sandbox create --image <image> --cpu 4 --memory 16Gi --gpu 1 --gpu-mem 8000 --max-life 120`（创建后立即可用，无需连接；--max-life 指定 sandbox 最大存活时间（分钟），默认 30；这些是 `create` 全部资源参数，不要发明其它 flag。`--provider autodl` 可指定使用 AutoDL 后端。）
4. **写入代码/数据** `delta-cli sandbox write <id> --path /workspace/<filename> --source <文件名>` — 将本地文件直接写入 sandbox。**必须**使用相对路径（如 `--source infer.py`），禁止使用 `"$WORKSPACE_ROOT/<filename>"`。也可用 `--data "..."` 写入少量内联内容，`--mode 755` 可设置文件权限。文件路径和扩展名由镜像中的运行时决定。
5. **运行命令** `delta-cli sandbox run <id> --command "<命令>" --timeout <秒>` — 根据镜像中的运行时构造命令，常见示例：`python /workspace/train.py`（Python）、`node /workspace/app.js`（Node.js）、`go run /workspace/main.go`（Go）、`bash /workspace/run.sh`（Shell）
   - `sandbox run` 是同步执行，返回结果里直接包含 `stdout`、`stderr`、`exit_code`，**不要**再调 `sandbox logs`
6. **读取结果** `delta-cli sandbox read <id> --path /workspace/result.json`
7. **销毁** `delta-cli sandbox kill <id>`（如需保存结果用 finish，finish 会自动销毁）

> **注意**：server 端没有 sandbox 的自动过期或 TTL 机制，不 kill 会永久占用 GPU 资源。请务必在任务结束后销毁。

## 后台任务

对于长时间运行的任务（>60 秒，如训练、编译、数据处理），使用 `run-bg` 在后台异步执行：

```bash
# 1. 启动后台命令（立即返回，不阻塞）
# 命令末尾加 echo SANDBOX_BACKGROUND_DONE 标记完成
delta-cli sandbox run-bg <id> --command "<命令> && echo SANDBOX_BACKGROUND_DONE" --timeout 7200

# ↑ 返回数据中包含 execution_id，请保存以便后续查询

# 2. 轮询日志判断任务状态（可在后续 tool call 轮次执行）
delta-cli sandbox logs <id> --execution-id <exec_id>

# 3. 全部完成后销毁 sandbox
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
4. **辅助判断**：`content` 中出现 `SANDBOX_BACKGROUND_DONE` → 完成；`cursor` 在增长 → 仍在运行
5. **连续 3 次 `running=true` 且 `content`/`cursor` 无变化且距离提交超过 60 秒** → 任务可能挂起或无输出，用 `sandbox status <id>` 检查 sandbox 是否存活；也可用 `sandbox status bg <id> --execution-id <exec_id>` 查后台命令状态
6. **`sandbox status` 返回正常但 logs 仍然无变化** → 用 `sandbox run <id> --command "ps aux | grep <进程名>" --timeout 15` 在容器内检查命令是否还在运行

**注意**：
- `sandbox logs` 只应配合 `sandbox run-bg` 使用；同步 `sandbox run` 的结果直接返回，不能也不应该调用 `logs`。
- `sandbox run-bg` 的 `--timeout` 传给服务端作为命令超时，HTTP 请求本身会快速返回；命令若超时会以非零退出码结束。
- 后台命令可跨 tool call 轮次查询：保存 `sandbox_id` 和 `execution_id`，后续轮次通过 `sandbox status` / `sandbox logs` 获取结果。
