> **前置条件：** 先阅读 [`../delta-shared/SKILL.md`](../delta-shared/SKILL.md) 了解认证、配置和通用错误处理。

# 命令速查表

## 发现

| 命令 | 说明 |
|------|------|
| `sandbox list` | 列出当前用户创建的活跃 sandbox（与 `ls` 不同：这是列 **沙箱实例**） |
| `sandbox providers` | 查看可用的计算后端（opensandbox / autodl） |
| `sandbox images` | 查看可用镜像列表 |
| `sandbox recommend --cpu N --memory XGi [--gpu N] [--gpu-mem N]` | 获取资源配置推荐 |

## 生命周期

| 命令 | 说明 |
|------|------|
| `sandbox create --image <img> [--cpu N --memory XGi --gpu N --gpu-mem N --max-life M --provider P]` | 创建 sandbox 容器 |
| `sandbox connect <id>` | 连接已有 sandbox |
| `sandbox status <id>` | 查看 sandbox 状态（running / done） |
| `sandbox finish <id> [--results '{...}']` | 保存结果后自动销毁 |
| `sandbox kill <id>` | 直接销毁 sandbox（不保存结果） |

## 命令执行

| 命令 | 说明 |
|------|------|
| `sandbox run <id> --command "..." [--timeout N]` | 同步运行命令；返回 stderr/exit_code/result_file（完整 stdout 在结果文件中） |
| `sandbox run-bg <id> --command "..." [--timeout N] [--wait]` | 后台运行命令；--wait 完成后返回状态与 result_file |
| `sandbox logs <id> --execution-id <eid>` | 获取后台命令日志；返回 cursor/exit_code/result_file |
| `sandbox status bg <id> --execution-id <eid>` | 查询后台命令状态（不含日志内容） |
| `sandbox cancel <id> --execution-id <eid>` | 中断正在运行的后台命令 |

## 文件操作

| 命令 | 说明 |
|------|------|
| `sandbox read <id> --path <path>` | 读取文件；返回 `content` + `size`（磁盘字节）+ `content_length`（字符长度） |
| `sandbox write <id> --path <path> --source <文件名>` | 写入文件（推荐，相对路径） |
| `sandbox write <id> --path <path> --data "..."` | 写入少量内联内容 |
| `sandbox write-multiple <id> --entry <src=path> [--entry ...]` | 批量写入多个文件 |
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
