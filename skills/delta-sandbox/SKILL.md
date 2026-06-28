---
name: delta-sandbox
version: 1.3.0
description: "在 Delta Sandbox Linux 容器中运行任意命令或脚本。适用于训练、推理、编译、数据处理等任意需要 sandbox 的计算任务，支持 Python / Node.js / Go / Java / Rust 等语言。所有任务通用同一套输出约定：命令在 stdout 末尾输出结构化 JSON，CLI 反向扫描 stdout 末尾 JSON 自动提取为 `data.result_summary` 字段。Planner 调用本 skill 时，请在 plan step 的 required_outputs 中声明 [{kind: 'file', extensions: ['.json']}]。请求中用中性动词（运行/执行）描述命令，只有真的会落盘文件时，才使用创建/写入/保存等动词并带上扩展名。认证/配置/权限错误转 delta-shared。"
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
6. **禁止重复创建**：同一次任务中只允许存在一个活跃 sandbox。若命令失败需要重试，优先复用已创建的 `sandbox_id`；若确实需要重新创建，必须先 `sandbox kill <旧_sandbox_id>`，确认旧实例销毁后再执行新的 `sandbox create`。可用 `delta-cli sandbox list` 查询当前用户的活跃 sandbox 来**清理残留**（上轮任务异常中断遗留的 sandbox），但 **禁止** 用 list 来绕过“同一次任务只保留一个 sandbox”的规则。

7. **长任务必须后台执行**：预计执行时间超过 60 秒的任务（例如下载模型、训练、微调、长推理、大规模数据处理），**必须**使用 `delta-cli sandbox run-bg <id> --command "..." --timeout <秒>` 提交为后台任务，禁止使用同步的 `sandbox run`。

   **推荐方式（1 次 tool call 等完成）**：
   ```bash
   delta-cli sandbox run-bg <id> --command "<命令>" --timeout <秒> --wait
   ```
   CLI 在内部每 5 秒轮询一次 `logs`，直到 `finished=true` 或超时，然后一次性返回 `{execution_id, running, finished, exit_code, content}`。返回的 `execution_id` 可在后续用于 `sandbox logs` / `cancel`。适合只关心最终结果、不需要查看中间进度的场景。

   **手动轮询（需要查看中间进度时）**：
   如果不加 `--wait` 或需要查看实时输出，用 `sandbox logs <id> --execution-id <exec_id>` 手动轮询：
   - `finished=true` + `exit_code=0` → 完成
   - `finished=true` + `exit_code!=0` → 失败  
   - `running=true` → 仍运行

   **故障诊断**：连续 3 次 `running=true` 且 `content`/`cursor` 无变化且距离提交超过 60 秒 → 用 `sandbox status <id>` 检查 sandbox 是否存活。

   - 后台任务成功后仍需按规则 2/3 销毁 sandbox。

8. **写入文件禁止使用路径或 Shell 变量，仅允许文件名**：
   - ❌ **禁止**：`--source "$WORKSPACE_ROOT/train.py"`、`--source "$(pwd)/train.py"`（Shell 展开路径 → 空文件或失败）
   - ❌ **禁止**：`--data "大量代码..."`（Shell 转义问题）
   - ✅ **正确**：`delta-cli sandbox write <id> --path /workspace/train.py --source train.py`（仅文件名）
   - 少量配置（< 20 行）可用 `--data "..."`。`--mode 755` 可设置文件权限。

9. **每个 `run-bg` 生成独立 `execution_id`**：每次调用 `sandbox run-bg` 都会返回一个唯一的 `execution_id`，多个后台任务之间通过它区分。务必保存每次返回的 `execution_id` 并与任务对应，后续通过 `sandbox logs <id> --execution-id <exec_id>` 分别查询各任务的结果。同步 `sandbox run` 无需 `execution_id`，结果直接返回。

10. **执行 delta-cli 命令必须使用 `bash` 工具，禁止用 `python_repl` 包装 `subprocess`**
    - `delta-cli` 返回的是结构化 JSON，用 `bash` 直接执行最清晰，也便于 `result_file` 提取。
    - ❌ **禁止**：在 `python_repl` 里写 `subprocess.run(['delta-cli', ...])`。这会把输出混在 Python 代码块中，既难读又多走一步解析。
    - ✅ **正确**：`bash` 工具直接执行 `delta-cli sandbox ...`。
    - 只有在**解析 JSON**（例如从 `sandbox read` 的信封中提取 `summary` 并写入 `result.json`）时，才使用 `python3`/`python_repl`。

11. **代码/数据必须经由 `delta-cli sandbox write` 进入 sandbox**
    - 所有要送进 sandbox 执行的脚本、配置、数据文件，**必须**通过 `delta-cli sandbox write <id> --path /workspace/<文件名> --source <本地文件名>` 写入。
    - 不要把脚本先写到宿主 workspace 再依赖同步；宿主 workspace 的文件对 sandbox 内部不可见。
    - 本规则关注的是“入口统一为 `sandbox write`”，不针对任何特定宿主工具。无论宿主提供何种文件操作接口，最终都要把内容送到 sandbox 内部。

12. **任务完成标准是执行结果，而不是脚本文件存在**
    - 本 skill 的交付物是**命令在 sandbox 中执行后的结果摘要**（本地 `result.json` 及其 `result_summary`），而不是 `.py`、`.sh` 等脚本文件本身。
    - 仅把脚本写入 disk 不代表任务完成；必须完成 `write → run → read result_file → create result.json → kill sandbox` 整个生命周期，才能调用 `step_finish`。
    - 因此，`skill_request` 中不要用“写出/保存/创建某某文件并执行”这类把文件落盘当成里程碑的措辞，而是直接要求“运行某某命令并返回结果摘要”。

13. **`result.json` 是完成前的必要条件**
    - 在调用 `step_finish` 之前，必须确认：
      1. `delta-cli sandbox run` / `run-bg --wait` 已返回且 `finished=true`；
      2. （默认）直接复用 `sandbox run` / `run-bg --wait` 返回的 `summary` 字段写入 `result.json`；或（fallback）从 `result_file` 用 `sandbox read` + Python 解析
      3. 已执行 `sandbox kill <id>` 销毁 sandbox；
      4. `final_response` 只有一行 `RESULT: <result_summary>`。

14. **避免冗余检查与验证**
    - 如果 `skill_request` 或用户请求已经明确指定了镜像与资源，**不要**在 `sandbox create` 前先调用 `sandbox providers` 或 `sandbox images`。
    - 文件写入 sandbox 后，只需要 `sandbox stat`（可选）确认 size 正常即可。**禁止**用 `sandbox ls` + `sandbox read` 把刚写入的文件读回宿主再验证内容；这会产生一次无意义的往返。
    - 不要在 `sandbox create` 成功后反复调用 `sandbox status` 轮询；create 返回时 sandbox 已就绪。

## 请求措辞约定

为降低被 host 的 Phase-10B 文件扩展名校验误判的概率，构造 `skill_request` 时遵守：

1. **运行/执行命令时，用中性动词**  
   优先使用 `运行`、`执行`、`调用`。  
   - 正确：`在 GPU sandbox 中运行 PyTorch CUDA 自检脚本`  
   - 不推荐在请求里直接写代码并带“输出”动词，例如  
     `脚本需输出：1) torch.cuda.is_available()；...`  
     其中的 `torch.cuda` 会被正则误判为承诺输出 `.cuda` 文件。

2. **只有真正会创建文件时，才用承诺动词 + 扩展名**  
   `创建`、`写入`、`保存`、`输出`、`生成` 这类词只在你确实会让 skill 落盘文件时使用，并显式写出扩展名。  
   - 正确：`创建 check_cuda.py 并运行`  
   - 正确：`训练完成后将指标写入 result.json`

3. **不要把完整代码块写进 `skill_request`**  
   用自然语言描述任务目标，具体代码由 skill 内部写入 sandbox。  
   - 正确：`运行标准 PyTorch CUDA 可用性检查`  
   - 不推荐：在 `skill_request` 里粘贴 `import torch; print(torch.cuda.is_available())`。

### required_outputs 声明

构造调用本 skill 的 plan step 时，**必须**在 `required_outputs` 中声明会落盘一个 `.json` 文件：

```yaml
required_outputs:
  - kind: file
    extensions: [".json"]
```

原因：本 skill 运行命令后会从 sandbox 读取 `result_file` 并写入本地 `result.json`。host 的 Phase-10B deliverable 校验是“或”语义（任意一个 required 扩展名被真实文件满足即可）；显式声明 `.json` 可以避免 `torch.cuda` 等代码 token 被误判为 `.cuda` 文件承诺，从而防止 `VERIFICATION_FAILED` 导致的重复执行。

## 快速路由

> ⚠️ **`list` 与 `ls` 区分**：`sandbox list` 列出用户的 **沙箱实例**（与 `docker ps` 类似），`sandbox ls <id>` 列出 **沙箱内目录**（与 `ls` 命令类似）。Tab 补全时注意区分。

| 用户目标 | 命令 |
|---------|------|
| **发现** | |
| 查看可用镜像 | `sandbox images` |
| 查看可用 provider | `sandbox providers` |
| 获取资源推荐 | `sandbox recommend --cpu N --memory XGi [--gpu N] [--gpu-mem N]` |
| 列出当前用户的 sandbox | `sandbox list` |
| **生命周期** | |
| 创建 sandbox | `sandbox create --image <image> [--cpu N --memory XGi --gpu N --gpu-mem N --max-life M]` |
| 连接 sandbox | `sandbox connect <id>` |
| 查看状态 | `sandbox status <id>` |
| 完成 sandbox | `sandbox finish <id> [--results '{...}']` |
| 销毁 sandbox | `sandbox kill <id>` |
| **命令执行** | |
| 同步运行命令（≤60s） | `sandbox run <id> --command "..." [--timeout <秒>] [--summary/--no-summary] [--artifacts]` |
| 后台运行命令（>60s） | `sandbox run-bg <id> --command "..." [--timeout <秒>] [--wait] [--summary/--no-summary] [--artifacts]` |
| 查看后台日志 | `sandbox logs <id> --execution-id <exec_id> [--tail N --grep <pattern> --context N --max-bytes N]` |
| 中断后台命令 | `sandbox cancel <id> --execution-id <exec_id>` |
| **文件操作** | |
| 读取文件 | `sandbox read <id> --path <path> [--output <本地路径> --tail N --grep <pattern> --offset N --limit N --context N --max-bytes N --parse-json]` |
| 拉取文件/目录 | `sandbox pull <id> --source <沙箱路径> --target <本地路径> [--recursive] [--pattern <glob>]` — 单文件或目录递归，含 sha1 校验（mirror of upload，flag 方向与 upload 相反：source=远程，target=本地） |
| 写入文件 | `sandbox write <id> --path <path> --source <文件名>`（推荐）|
| 批量写入 | `sandbox write-multiple <id> --entry <远程路径>=<本地路径> [--entry ...]` |
| 上传目录 | `sandbox upload <id> --source <本地目录> --target <沙箱路径>` |
| 列出目录 | `sandbox ls <id> --path <路径>`（默认 `.`）|
| 文件元数据 | `sandbox stat <id> --path <path>` |
| 移动/重命名 | `sandbox mv <id> --entry <src=dest> [--entry ...]` |
| 替换内容 | `sandbox replace <id> --path <path> --old <文本> --new <文本>` |
| 修改权限 | `sandbox chmod <id> --path <path> --mode <八进制>` |
| 删除文件 | `sandbox rm <id> --path <path> [--path ...]` |
| 删除目录 | `sandbox rmdir <id> --path <路径> [--path ...]` |
| 创建目录 | `sandbox mkdir <id> --path <路径> [--path ...]` |
| 搜索文件 | `sandbox search <id> --path <根目录> --pattern <glob>` |
| 上传目录 | `sandbox upload <id> --source <本地目录> --target <沙箱路径>` |

## 完整生命周期

1. **选择 Provider 和镜像（按需）**：
   - 如果请求里已经明确指定了镜像（例如 `--image image.yangtzeailab.com/opensandbox/pytorch-cuda13`）和资源（cpu/memory/gpu），**直接跳到步骤 2 创建 sandbox**，不要再调 `sandbox providers` / `sandbox images` / `sandbox recommend`。
   - 只有在用户要求“推荐一个配置”或需要查询可用镜像/Provider 时，才调用：
     - `delta-cli sandbox providers` — 可用的计算后端
     - `delta-cli sandbox images` — 服务端支持的镜像列表
     - `delta-cli sandbox recommend --cpu N --memory XGi [--gpu N]` — 资源配置推荐
2. **创建**：`delta-cli sandbox create --image <img> --cpu 4 --memory 16Gi --gpu 1 --gpu-mem 8000 --max-life 120`。**返回的 JSON 信封中是 `data.sandbox_id`，不是 `data.id`；后续所有命令必须使用这个真实的 `sandbox_id`。**（创建后 sandbox 立即可用，无需额外连接）。**同一次任务若已有 `sandbox_id`，禁止再次 create，必须优先复用。**
    - --max-life 指定 sandbox 最大存活时间（分钟），默认 30。长任务请调高，确保 sandbox 在命令执行期间不被回收。
    - 这是 `sandbox create` 支持的完整资源参数集合，不存在其它“更正确”的资源 flag，不要发明不存在的参数。
    - **禁止在 create 成功后反复调用 `sandbox status` 轮询**。`sandbox create` 返回时 sandbox 已经就绪，直接用它返回的 `data.sandbox_id` 执行 `write`/`run` 即可。多余的轮询会增加工具调用次数且没有任何收益。
3. **写入代码/数据**：
   - **单个文件**：`delta-cli sandbox write <id> --path /workspace/<filename> --source <文件名>` — **必须**使用相对路径（如 `--source train.py`），**禁止**使用 `"$WORKSPACE_ROOT/train.py"` 或 `$(pwd)/train.py` 等 Shell 变量路径。`--source` 让 CLI 自行读取本地文件，不会经过 Shell 展开，是最安全的方式。写入后返回的 `size` 字段是实际磁盘字节数（来自 stat 验证），可对比确认写入完整性。少量配置（<20 行）可用 `--data "..."`。文件路径和扩展名由镜像中的运行时决定。
   - **批量写入**：`sandbox write-multiple <id> --entry <远程路径>=<本地路径> [--entry ...]`（远程路径在 `=` 左边，本地路径在右边，`--data` 批量写入不可用）
   - **上传目录**：`sandbox upload <id> --source <本地目录> --target <沙箱路径>` — CLI 将本地目录打包为 tar.gz，通过 multipart/form-data 上传，服务端自动解压到 target 目录。返回每个文件的路径、大小、模式。上传后 CLI 自动对比本地和远程文件清单做完整性校验（大小不匹配、多余文件等会告警）。
     - **注意**：`--source` 是**本地目录路径**，`--target` 是**沙箱内的目标目录**，target 目录不存在会自动创建。
     - 支持嵌套目录，空目录也会被创建。
     - **写后验证（可选）**：`sandbox stat <id> --path <path>` 确认文件存在且 size 符合预期即可。**不要**用 `sandbox ls` + `sandbox read` 把刚写入的文件读回宿主再逐字对比；无异常时不需要读回。
4. **运行命令**：
    - **短任务（预计 ≤ 60 秒）**：`delta-cli sandbox run <id> --command "<命令>" --timeout <秒>` 同步执行，返回 `stderr` / `exit_code` / `result_file`，完整 `stdout` 在结果文件中，**不要**再调用 `sandbox logs`。可通过 `--result-file <路径>` 自定义结果文件路径；默认值为 `/tmp/delta-result-{execution_id}.json`。根据镜像中的运行时构造命令，常见示例：
     - Python：`python /workspace/train.py`
     - Node.js：`node /workspace/app.js`
     - Go：`go run /workspace/main.go`
     - Shell：`bash /workspace/run.sh`
   - **长任务（预计 > 60 秒，如下载模型、训练、编译、大规模数据处理）**：`delta-cli sandbox run-bg <id> --command "<命令>" --timeout <秒> [--result-file <路径>]` 提交后台任务，获得 `execution_id` 后通过以下命令轮询：
      - `delta-cli sandbox logs <id> --execution-id <execution_id>` — 返回 `cursor`、`running`、`finished`、`exit_code`、`result_file`（完成后）。当 `finished=true` 时认为完成，完整输出需读取 `result_file`。
           禁止对长任务使用同步 `sandbox run`

   **推荐实践**：让 sandbox 脚本在 `stdout` 末尾打印一个独立的结构化 JSON 对象（例如 `{"status":"ok", ...}`），CLI 的 `--summary` 默认会自动反向扫描 stdout 末尾 JSON 提取为 `data.result_summary` 字段。这样即使 `stdout` 前面是大量训练/下载日志，skill 也无需让大模型去“读整段日志再摘要”。
5. **生成 result.json**（默认路径使用 CLI 返回的 `summary` 字段；fallback 路径用 `sandbox read` + Python 解析）：
    - **5a（默认路径，推荐）**：`run` / `run-bg --wait` 已返回 `result_summary` 字段（CLI 自动 reverse-scan stdout 末尾 JSON）。直接构造 `result.json`：
      ```bash
      delta-cli sandbox run <id> --command "..." --timeout 60 > /tmp/_run.json
      ```
      ```python
      import json, os
      r = json.load(open("/tmp/_run.json"))
      data = r.get("data", {})
      # CLI 字段名是 result_summary（不是 summary），是一个对象
      cli_summary = data.get("result_summary") or {}
      result = {
          "exit_code": data.get("exit_code"),
          "finished": data.get("finished", True),
          "summary": cli_summary,
          "result_summary": ", ".join(f"{k}={v}" for k,v in cli_summary.items()
                                       if isinstance(v, (str,int,float,bool)) and len(str(v))<200),
          "error": data.get("error"),
      }
      if not result["result_summary"]:
          result["result_summary"] = f"exit_code={result['exit_code']}, finished={result['finished']}"
      ws = os.environ.get("WORKSPACE_ROOT", ".")
      json.dump(result, open(os.path.join(ws, "result.json"), "w", encoding="utf-8"),
                indent=2, ensure_ascii=False)
      print(result["result_summary"])
      ```
    - **5b（fallback，仅当 `--no-summary` 或 `result_summary` 为 null）**：从 `sandbox run` / `sandbox run-bg --wait` / `sandbox logs` 返回数据中获得 `result_file` 路径，用 `sandbox read` + Python 解析。
      - `sandbox read` 返回的是 CLI 信封 `{"ok":true,"data":{"content":"..."}}`，真实结果 JSON 在 `data.content` 字段里。
      - **不要把 CLI 信封或完整长 `stdout` 原样写入本地 `result.json`**；应该解析后生成一份精简的结构化摘要。
      - **推荐做法（避免 heredoc 引号失败）**：先用 `bash` 把信封写入临时文件，再用 `python3`（或 `python_repl`）读取该文件并生成 `result.json`。**不要**把 `delta-cli sandbox read` 的输出通过管道直接喂给内联 heredoc，管道+heredoc 的组合极易因 Shell 转义/引号问题失败。
        1. `bash` 保存信封：
           ```bash
           delta-cli sandbox read <sandbox_id> --path <result_file> > /tmp/_delta_result_envelope.json
           ```
        2. `python3` / `python_repl` 生成 `result.json`：
           ```python
           import json, os

           env = json.load(open("/tmp/_delta_result_envelope.json", encoding="utf-8"))
           raw = json.loads(env["data"]["content"])

            # 精简到用户关心的极简字段，避免 host read_file 预览截断
            concise = {
                "exit_code": raw.get("exit_code"),
                "finished": raw.get("finished"),
                "summary": {},
                "error": raw.get("error"),
            }

           # 优先提取 stdout 末尾的独立 JSON 对象作为 summary
           stdout = raw.get("stdout", "")
           for line in reversed(stdout.strip().splitlines()):
               s = line.strip()
               if s.startswith("{") and s.endswith("}"):
                   try:
                       concise["summary"] = json.loads(s)
                       break
                   except Exception:
                       pass

           # 构造 result_summary：一行字符串，最终回答的 RESULT: 行直接用它
           parts = [f"exit_code={concise['exit_code']}", f"finished={concise['finished']}"]
           for key, value in concise["summary"].items():
               # 避免把长文本塞进 result_summary
               if isinstance(value, (str, int, float, bool)) and len(str(value)) < 200:
                   parts.append(f"{key}={value}")
           concise["result_summary"] = ", ".join(parts)

           ws = os.environ.get("WORKSPACE_ROOT", ".")
           with open(os.path.join(ws, "result.json"), "w", encoding="utf-8") as f:
               json.dump(concise, f, indent=2, ensure_ascii=False)
           print(concise["result_summary"])
           ```
        3. 如果当前环境没有 `python3`，用 `jq`、`node` 或任何可解析 JSON 的工具实现**相同逻辑**：1）读取 `/tmp/_delta_result_envelope.json`；2）解开 CLI 信封取 `data.content`；3）解析内部 JSON；4）从 `stdout` 末尾提取 summary JSON；5）生成 `result_summary` 并写入 `result.json`。
      - 如果 `stdout` 非常大（训练日志、下载日志等），不要把整段 `stdout` 写进 `result.json`；只保留关键指标和 preview。
      - 完整原始输出仍保留在 sandbox 的 `result_file` 中，必要时可再次 `sandbox read` 获取。
    - 写入本地副本的目的是让 host 的 deliverable 校验识别到真实的 `.json` 文件；由于校验是“或”语义，`.json` 文件会盖过 `torch.cuda` 等 token 被误判出的 `.cuda` 文件承诺。
6. **销毁**：`delta-cli sandbox kill <id>`（如需保存结果，用 `sandbox finish --results '{...}'` 替代 kill，finish 会自动销毁 sandbox）

详细步骤见 [lifecycle.md](references/lifecycle.md)。

## 通用结构化输出约定

本约定适用于**所有** `delta-sandbox` 任务（GPU/CPU、训练/推理/编译/数据处理等），目的是让 Runner 能直接从 `result.json` 读到结论，无需再次解析长日志。

### sandbox 脚本/命令应该输出的内容

命令执行完毕后，推荐在 `stdout` 末尾打印一行**独立的结构化 JSON**。例如：

- CUDA 检查：`{"status":"ok","torch_version":"2.5.1+cu121","cuda_available":true,"device_name":"NVIDIA H100 80GB HBM3"}`
- 训练任务：`{"status":"ok","epochs":10,"final_loss":0.12,"final_accuracy":0.94,"model_file":"/workspace/model.pt"}`
- 数据处理：`{"status":"ok","input_rows":10000,"output_rows":9876,"output_file":"/workspace/output.csv"}`

这样 SKILL 可以用同一套代码把它提取到 `result.json` 的 `summary` 字段，再生成 `RESULT:` 行。

- **禁止**在 stdout 中打印 `FINAL_ANSWER: ...` 这类冗余标记行；多余的标记会让 Runner 把普通文本误认为结果字段。
- `summary` 中**不要**使用 `final_answer` 这类与 schema 重复的关键字。统一用语义字段表示结果，例如推理任务用 `generated_text` / `output` / `result`，训练任务用 `final_loss` / `final_accuracy`，数据处理用 `output_file` / `output_rows`。

### 本地 `result.json` 通用 Schema

```json
{
  "exit_code": 0,
  "finished": true,
  "summary": {},
  "result_summary": "exit_code=0, status=ok, torch_version=..., ...",
  "error": null
}
```

关键字段：
- `summary`: 命令输出的结构化结果对象。
- `result_summary`: **一行字符串**，与最终回答的 `RESULT:` 行内容一致，方便 Runner 直接读取。
- `error`: 命令失败时的错误信息；成功时一般为 `null`。
- **不要把完整 `stdout` 塞进来**。完整日志仍保留在 sandbox 的 `result_file` 中。

## 输出阅读与最终回答格式

1. **`sandbox run` / `run-bg --wait` 默认带 `--summary`，返回的 JSON 中 `data.result_summary` 字段已包含 stdout 末尾 JSON 提取结果（注意：这里是 `result_summary`，不是 `summary`）。也包含 `data.result_file`**（沙箱内结构化结果文件的路径），作为 fallback 路径。
2. **默认优先用 `data.result_summary`**；仅当 `result_summary` 字段为 null（使用了 `--no-summary` 或 stdout 无 JSON）时，再用 `sandbox read <id> --path <result_file>` 读取 result_file 并解析 CLI 信封。
   - 结果文件包含完整 `stdout`、`stderr`、`exit_code`、`finished`、`command`、`error`。
3. **生成本地精简 `result.json`**（见“完整生命周期”步骤 5 和“通用结构化输出约定”）。本地副本只应包含关键字段和摘要，**不应包含完整长 `stdout`**。
4. **最终回答必须且只能是 `RESULT:` 开头的一行。**
   - 优先直接复用 `result.json` 里的 `result_summary` 字段：
     ```text
     RESULT: <result.json 中的 result_summary>
     ```
   - 如果 `result_summary` 缺失，则从 `summary` 对象构造一行，例如：
     ```text
     RESULT: exit_code=0, status=ok, torch_version=2.7.0+cu128, cuda_available=True, device_name=NVIDIA GeForce RTX 3090.
     ```
5. **绝对禁止任何前缀、后缀、说明、过渡句或内心独白**
   - 正确：`RESULT: exit_code=0, cuda_available=True, torch_version=2.5.1+cu121, device_name=NVIDIA H100 80GB HBM3`
   - 错误：`Sandbox killed successfully. Final answer with result summary. RESULT: ...`
   - 错误：`Sandbox killed. Task done. Need final answer exactly RESULT: line from result_summary. RESULT: ...`
   - 错误：`The user wants me to verify CUDA... RESULT: ...`
   - 错误：`Summary: ... RESULT: ...`
   - 错误：在 `RESULT:` 后追加 `Let me know if you need anything else.` 等多余句子。
   - **规则**：`final_response` 里出现的字符，必须是 `RESULT:` 及其后的内容，不允许其它任何自然语言。
6. **不要依赖或被截断的 `stdout`/`stderr` 字段**，关键结论必须来自 `result.json` 的 `summary` / `result_summary`。
7. **`sandbox kill` 成功后不再调用任何工具**。kill 命令返回 `{ok:true}` 即表示任务已收尾，下一回合直接输出一行 `RESULT: <result_summary>`。禁止再调 `bash`/`read_file`/`ls` 等工具，也不要以 "Need final answer exactly..."、"Sandbox killed." 等独白开头。

## 宿主 / Planner 调用提示

本 skill 设计成“结论自包含”：执行结束后，**`result.json` 的 `result_summary` 与 `final_response` 已经包含最终面向用户的结论**。因此：

- **Planner** 调用本 skill 的 plan step 时，`required_outputs` 必须声明 `.json`（见上方“请求措辞约定”）。
- **宿主（host / Runner / finalize 阶段）** 在收到 skill 返回后，应直接把 `final_response` 或 `result.json` 里的 `result_summary` 作为最终答案，**不要再让大模型去读取 result.json、验证文件内容或重新推理**。
- 如果宿主担心内容不可信，可以读取 `result.json` 核对，但**最终输出仍必须是 `RESULT:` 开头的一行**，不允许把“我需要先读取文件验证”、“Wait, I don't have...”等思考过程暴露给用户。

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
