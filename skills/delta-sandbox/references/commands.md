> **前置条件：** 先阅读 [`../delta-shared/SKILL.md`](../delta-shared/SKILL.md) 了解认证、配置和通用错误处理。

# 命令速查表

## 发现

| 命令 | 说明 |
|------|------|
| `sandbox list [--status <running/finished/killed/error>] [--start-time <ISO8601>] [--end-time <ISO8601>] [--provider <opensandbox/autodl>] [--sandbox-id <id>] [--days N]` | 列出当前用户的 sandbox（与 `ls` 不同：这是列 **沙箱实例**）；支持按状态/时间/Provider/sandbox_id 过滤；时间范围优先级 start_time/end_time > days > 默认 7 天 |
| `sandbox providers` | 查看可用的计算后端（opensandbox / autodl） |
| `sandbox resources [--provider <opensandbox/autodl>]` | 查看各后端当前**剩余可申请**资源（GPU/显存/核心）；`gpu_types` 按后端原样透传，结构随 provider 不同——opensandbox 含 `vgpu`/`core`/`memory_mib` 的 `total/used/available`，autodl 含 `total_gpu_num`/`idle_gpu_num` |
| `sandbox images` | 查看可用镜像列表 |
| `sandbox recommend --cpu N --memory XGi [--gpu N] [--gpu-mem N]` | 获取资源配置推荐 |

## 生命周期

| 命令 | 说明 |
|------|------|
| `sandbox create --image <img> [--cpu N --memory XGi --gpu N --gpu-mem N --max-life M --no-auto-cleanup --provider P]` | 创建 sandbox 容器（`--no-auto-cleanup` 不被自动清理，仅显式 kill/finish 可销毁）；**响应回显请求的 `image`/`provider`/`resource`**（服务端未返回字段用请求值补齐，服务端值优先；`provider=auto` 不回显） |
| `sandbox connect <id>` | 连接已有 sandbox |
| `sandbox status <id>` | 查看 sandbox 状态（running / done） |
| `sandbox finish <id> [--results '{...}']` | 保存结果后自动销毁 |
| `sandbox kill <id>` | 直接销毁 sandbox（不保存结果） |

## 命令执行

| 命令 | 说明 |
|------|------|
| `sandbox run <id> --command "..." [--timeout N] [--summary/--no-summary] [--artifacts]` | 同步运行命令（SSE 实时流，原始 `data:` 帧逐帧透传到 stdout；**成功无末尾信封**；`complete` 帧由 CLI 补全 `exit_code`/`execution_id`/`log_file`/`stdout`/`stderr`/`result_summary`；**命令非零退出或报错时追加 `error.type: command_failed` 信封并以非零码退出**，信封 `message` 附 stderr 尾部，`type:"error"` 帧 message 亦附 best-effort stderr 尾部）；`--summary`/`--artifacts` 仅在旧服务器回退路径（无 SSE 端点时输出 `CommandResult` 信封）生效 |
| `sandbox run-bg <id> --command "..." [--timeout N] [--wait] [--summary/--no-summary] [--artifacts]` | 后台运行命令；不加 `--wait` 立即返回 `{execution_id, sandbox_id}`；加 `--wait` 通过 SSE 实时流跟随到 `complete`（原始 `data:` 帧透传到 stdout；`complete` 帧由 CLI 补全 `log_file`/`stdout`/`stderr`/`result_summary`；**命令失败时追加 `command_failed` 信封并非零退出**，信封 `message` 附 stderr 尾部；超时则追加 `finished=false` 快照信封）；`--summary`/`--artifacts` 仅在旧服务器回退路径生效 |
| `sandbox logs <id> --execution-id <eid> [--tail N --grep <pattern> --context N] [--stream]` | 获取后台命令日志；**默认返回 `stdout_tail`（末尾 800 字节）+ `stderr_tail`（末尾 200 字节）+ `stderr_size` + `cursor`**，总计约 1KB，避免上下文爆炸；`--stream` 走 `/logs/stream` SSE 实时跟随，原始 `data:` 帧透传到 stdout 直到 `complete`（complete 帧由 CLI 补全 `stdout`/`stderr`/`log_file`/`result_summary`，无末尾信封）；`--tail N` 同时作用于 stdout 和 stderr（各取尾 N 行）；`--grep <pattern>` 同时过滤 stdout 和 stderr（正则）；`--context N` 提供 grep 匹配行前后 N 行上下文（同时用于 stdout 和 stderr）；**`cursor` 字段无 `omitempty`，0 也常驻响应**；快照含 `last_updated`（SSE 路径由 CLI 填，服务端快照路径待服务端补齐）。 |
| `sandbox cancel <id> --execution-id <eid>` | 中断正在运行的后台命令 |

## 文件操作

| 命令 | 说明 |
|------|------|
| `sandbox read <id> --path <path> [--output <本地路径>] [--tail N] [--grep <pattern>] [--offset N] [--limit N] [--context N] [--max-bytes N] [--parse-json]` | 读取文件；返回 `content` + `size` + `content_length`；`--output <path>` 保存到本地；`--tail/--grep` 用于过滤；非 UTF-8 文件 CLI 自动走 base64 fallback |
| `sandbox working-directory <id>` | 查询 sandbox 当前工作目录（绝对路径 `/workspace/{user_id}/{sandbox_id}`） |
| `sandbox write <id> [--path <路径>] --source <文件名>` | 写入文件（推荐）。不传 `--path` 默认写到 working-directory（`<working-directory>/<文件名>`）；相对 `--path` 也会拼到 working-directory 下；仅绝对 `--path` 原样使用（但 `/workspace/<文件名>` 根路径不在 OSS 同步范围内，不推荐） |
| `sandbox write <id> --path <绝对路径> --data "..."` | 写入少量内联内容（`--data` 无源文件名，必须显式传 `--path`） |
| `sandbox write-multiple <id> --entry <src=path> [--entry ...]` | 批量写入多个文件（目标 `path` 相对则同样拼到 working-directory） |
| `sandbox pull <id> --source <沙箱路径> --target <本地路径> [--recursive] [--pattern <glob>]` | 拉取文件/目录到本地（mirror of `upload`，flag 方向相反：`--source`=远程沙箱路径，`--target`=本地路径）；单文件自动识别；目录默认递归；CLI 端 + 服务端双向 sha1 完整性校验 |
| `sandbox ls <id> --path <path>` | 列出目录内容（默认 `.`） |
| `sandbox stat <id> --path <path>` | 获取文件元数据（size / mode / owner / group） |
| `sandbox mv <id> --entry <source=dest> [--entry ...]` | 移动或重命名文件 |
| `sandbox replace <id> --path <path> --old <文本> --new <文本> [--regex] [--ignore-case]` | 替换文件内容 |
| `sandbox chmod <id> --path <path> --mode <八进制>` | 修改文件权限 |
| `sandbox rm <id> --path <path> [--path ...]` | 删除文件 |
| `sandbox mkdir <id> --path <路径> [--path ...]` | 创建目录（mkdir -p） |
| `sandbox search <id> --path <根目录> --pattern <glob>` | 搜索文件 |

## 注意事项

- `list` ≠ `ls`：`sandbox list` 列沙箱实例，`sandbox ls <id>` 列沙箱内目录
- 写文件后返回的 `size` 是 stat 验证后的实际磁盘字节数
- 读文件返回 `size`（磁盘字节，来自 stat）和 `content_length`（内存字符数），对比可判断编码偏差
- 读不存在的文件会返回 error，不会静默返回空内容
