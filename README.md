# delta-cli

Delta Infra 的命令行工具，用于管理 Delta Sandbox GPU/CPU 计算任务和调用 Science 工具。

## 安装

### 方式一：npx 一键安装（推荐）

```bash
npx @delta-infra/cli@latest install
```

该命令会依次完成：
1. **全局安装** `@delta-infra/cli`（含 Go 二进制）
2. **选择 AI 工具平台**（可多选）：通用 Agent 目录 `~/.agents/skills/`（Codex/Cursor/OpenCode）、Claude Code `~/.claude/skills/`、OpenCode 原生 `~/.config/opencode/skills/`、Cursor `~/.cursor/skills/`、Memento-S 开发模式 `~/memento_s/skills/`
3. **安装 AI Skills** 到所选平台的 skills 目录
4. **初始化配置** `delta-cli config init`（交互式，非 TTY 跳过）
5. **身份认证** `delta-cli auth login`（交互式，非 TTY 跳过）

AI Agent 也可以直接使用以下指令完成安装：

> 帮我安装 delta-cli：https://github.com/yzailab/delta-infra-cli

### 卸载

```bash
npx @delta-infra/cli@latest uninstall
```

清理全局包、所有已知平台的 AI Skills 和配置文件。

### 升级

```bash
# 升级 CLI + AI Skills
delta-cli upgrade

# 只检查是否有更新（不执行升级）
delta-cli upgrade --check

# 只升级 CLI 二进制
delta-cli upgrade --cli-only

# 只升级 AI Skills
delta-cli upgrade --skills-only
```

升级 CLI 时会通过 `npm install -g @delta-infra/cli@latest` 拉取最新版本；升级 Skills 时会通过 `npx skills add` 重新安装 AI Skills。

### 方式二：直接下载 Binary

从 [GitHub Releases](https://github.com/yzailab/delta-infra-cli/releases) 下载对应平台的压缩包（以下使用 `latest` 指向最新版）：

```bash
# macOS (Apple Silicon)
curl -L -o delta-cli.tar.gz https://github.com/yzailab/delta-infra-cli/releases/latest/download/delta-cli-darwin-arm64.tar.gz
tar -xzf delta-cli.tar.gz
sudo mv delta-cli-darwin-arm64 /usr/local/bin/delta-cli
rm delta-cli.tar.gz

# Linux (AMD64)
curl -L -o delta-cli.tar.gz https://github.com/yzailab/delta-infra-cli/releases/latest/download/delta-cli-linux-amd64.tar.gz
tar -xzf delta-cli.tar.gz
chmod +x delta-cli-linux-amd64
sudo mv delta-cli-linux-amd64 /usr/local/bin/delta-cli
rm delta-cli.tar.gz

# Windows (AMD64，PowerShell)
Invoke-WebRequest -Uri https://github.com/yzailab/delta-infra-cli/releases/latest/download/delta-cli-windows-amd64.zip -OutFile delta-cli.zip
Expand-Archive -Path delta-cli.zip -DestinationPath . -Force
Move-Item -Path delta-cli-windows-amd64.exe -Destination delta-cli.exe
Remove-Item -Path delta-cli.zip
# 将 delta-cli.exe 放到 PATH 中的目录
```

### 方式三：一键安装脚本（国内用户推荐）

安装脚本会自动尝试国内 npm 镜像（npmmirror），失败后再回退到 npm 官方源：

```bash
# Linux / macOS
curl -L https://raw.githubusercontent.com/yzailab/delta-infra-cli/main/install.sh | bash

# Windows (PowerShell)
Invoke-RestMethod -Uri https://raw.githubusercontent.com/yzailab/delta-infra-cli/main/install.ps1 | Invoke-Expression
```

### 方式四：npm

```bash
npm install -g @delta-infra/cli
```

`postinstall` 会按以下顺序尝试下载当前平台的二进制：

1. `DELTA_CLI_MIRROR` 环境变量（如果设置）
2. 国内加速镜像 `https://gh-proxy.com/https://github.com/...`
3. GitHub 源站 `https://github.com/yzailab/delta-infra-cli/releases/download/...`

如果安装时下载失败，可以：

- 直接运行一次 `delta-cli`，它会自动重新尝试下载。
- 或者在安装前设置本地压缩包路径：

```bash
DELTA_CLI_ARCHIVE=/path/to/delta-cli-linux-amd64.tar.gz npm install -g @delta-infra/cli
```

常用环境变量：

| 变量 | 说明 |
|------|------|
| `DELTA_CLI_MIRROR` | 下载镜像，例如 `https://gh-proxy.com/https://github.com`。只接受 HTTPS 且需在白名单内。 |
| `DELTA_CLI_MIRROR_ALLOWLIST` | 额外允许的主机列表，逗号分隔。 |
| `DELTA_CLI_ARCHIVE` | 指向预先下载好的 `.tar.gz` / `.zip` 本地路径，跳过网络下载。 |
| `DELTA_CLI_SKIP_POSTINSTALL` | 设置为 `1` 跳过安装时的二进制下载，之后由 `delta-cli` 运行时兜底。 |
| `DELTA_CLI_FATAL_ON_ERROR` | 安装失败时退出码非 0（默认警告，用于调试）。 |
| `DELTA_CLI_DOWNLOAD_TIMEOUT` | 单个下载源最大等待时间（毫秒，默认 120000）。 |

### 方式五：Go Install

```bash
go install github.com/delta-infra/delta-infra-cli/cmd/delta-cli@latest
```

## 快速开始

### 1. 初始化配置

```bash
delta-cli config init
```

执行时会交互式提示输入服务端地址（默认：`https://delta-infra-nacos-test.yangtzeailab.com/sandbox/api/v1`）以及 Bearer Token（可选，也可后续用 `auth login` 配置）。

非交互式环境（如 CI）会直接使用默认值，也可以通过 flag 或环境变量一次性指定：

```bash
# 通过 flag
delta-cli config init \
  --base-url http://your-server/api/v1 \
  --token your-token

# 通过环境变量
export DELTA_INFRA_BASE_URL=http://your-server/api/v1
export DELTA_INFRA_TOKEN=your-token
delta-cli config init
```

配置文件保存在 `~/.delta-infra/config.json`（权限 0600）。

### 2. 认证

使用 Bearer Token：

```bash
# Token
delta-cli auth login --token <your-token>

# 查看认证状态
delta-cli auth status
```

### 3. Sandbox 生命周期

```bash
# 创建带 GPU 的 sandbox（--max-life 默认 30 分钟，长任务请调高）
delta-cli sandbox create \
  --image image.yangtzeailab.com/opensandbox/pytorch-cuda13:latest \
  --cpu 4 --memory 16Gi --gpu 1 \
  --max-life 120

# 运行命令（短任务同步执行，长任务用 run-bg 替代 run）
delta-cli sandbox run <sandbox_id> \
  --command "<命令>" \
  --timeout 3600

# v1.0.55+ 默认带 --summary，返回 JSON 中 data.result_summary 字段已含 stdout 末尾 JSON 提取结果
# 无需再手动读取 log_file 做二次解析（除非使用了 --no-summary）
delta-cli sandbox run <sandbox_id> --command "echo '{\"status\":\"ok\",\"result\":\"done\"}'" --timeout 60

# 读取结果文件
delta-cli sandbox read <sandbox_id> --path /workspace/result.json

# 销毁 sandbox
delta-cli sandbox kill <sandbox_id>
```

## 命令列表

### 全局命令

| 命令 | 说明 |
|------|------|
| `delta-cli config init` | 初始化配置文件 |
| `delta-cli config show` | 查看当前配置（敏感字段已脱敏） |
| `delta-cli config set <key> <value>` | 修改配置项 |
| `delta-cli auth login` | 交互式登录 |
| `delta-cli auth login --token <token>` | Token 认证 |
| `delta-cli auth status` | 查看认证状态 |
| `delta-cli upgrade` | 升级 CLI 和 AI Skills 到最新版本 |
| `delta-cli upgrade --check` | 检查是否有可用更新 |
| `delta-cli upgrade --cli-only` | 只升级 CLI 二进制 |
| `delta-cli upgrade --skills-only` | 只升级 AI Skills |
| `delta-cli --version` | 显示版本 |

### Sandbox 命令

> **提示**：`sandbox list`（列沙箱实例）与 `sandbox ls <id>`（列目录）不同，注意区分。

| 命令 | 说明 |
|------|------|
| `delta-cli sandbox list` | 列出当前用户的 sandbox 实例 |
| `delta-cli sandbox providers` | 查看可用计算后端 |
| `delta-cli sandbox images` | 查看可用镜像列表 |
| `delta-cli sandbox recommend --cpu N --memory XGi` | 获取资源配置推荐 |
| `delta-cli sandbox create --image <img>` | 创建 sandbox 容器 |
| `delta-cli sandbox connect <id>` | 连接 sandbox |
| `delta-cli sandbox status <id>` | 查看 sandbox 状态 |
| `delta-cli sandbox finish <id>` | 保存结果并销毁 |
| `delta-cli sandbox kill <id>` | 销毁 sandbox |
| `delta-cli sandbox run <id> --command "..." [--timeout <秒>] [--summary/--no-summary] [--artifacts]` | 同步运行命令；默认带 `--summary`，返回 JSON 中 `summary` 字段已含 stdout 末尾 JSON 提取结果；`--artifacts` 附带 workspace 产物清单 |
| `delta-cli sandbox run-bg <id> --command "..." [--timeout <秒>] [--wait] [--summary/--no-summary] [--artifacts]` | 后台运行命令；不加 `--wait` 立即返回 `{execution_id, sandbox_id}`；加 `--wait` 等待完成返回含 `summary` 的完整结果 |
| `delta-cli sandbox logs <id> --execution-id <eid> [--tail N --grep <pattern> --context N --max-bytes N]` | 查看后台日志；默认返回 `stderr_size + stderr_tail`（避免上下文爆炸）；可用 `--tail/--grep` 过滤 |
| `delta-cli sandbox cancel <id> --execution-id <eid>` | 中断后台命令 |
| `delta-cli sandbox read <id> --path <path> [--output <本地路径>] [--tail N] [--grep <pattern>] [--offset N] [--limit N] [--context N] [--max-bytes N] [--parse-json]` | 读取容器内文件；`--output <path>` 保存到本地；`--tail/--grep` 过滤；非 UTF-8 文件 CLI 自动走 base64 fallback |
| `delta-cli sandbox pull <id> --source <沙箱路径> --target <本地路径> [--recursive] [--pattern <glob>]` | 从沙箱拉取文件/目录到本地（mirror of `upload`，flag 方向相反：source=远程，target=本地）；单文件或递归目录；CLI 端 + 服务端双向 sha1 完整性校验 |
| `delta-cli sandbox write <id> --path <path> --source <本地路径>` | 写入文件 |
| `delta-cli sandbox write-multiple <id> --entry <远程路径>=<本地路径>` | 批量写入 |
| `delta-cli sandbox ls <id> --path <path>` | 列出目录 |
| `delta-cli sandbox stat <id> --path <path>` | 文件元数据 |
| `delta-cli sandbox mv <id> --entry <src=dest>` | 移动/重命名 |
| `delta-cli sandbox replace <id> --path <path> --old <文本> --new <文本>` | 替换内容 |
| `delta-cli sandbox chmod <id> --path <path> --mode <八进制>` | 修改权限 |
| `delta-cli sandbox rm <id> --path <path>` | 删除文件 |
| `delta-cli sandbox rmdir <id> --path <路径>` | 递归删除目录 |
| `delta-cli sandbox mkdir <id> --path <路径>` | 创建目录 |
| `delta-cli sandbox search <id> --path <根目录> --pattern <glob>` | 搜索文件 |
| `delta-cli sandbox upload <id> --source <本地目录> --target <沙箱路径>` | 上传目录（tar.gz + 自动解压） |

### Science 工具

> 默认 Science Server 为 `http://8.141.101.94:8080/science_tool`。可通过
> `delta-cli config set science_base_url <url>` 或环境变量
> `DELTA_INFRA_SCIENCE_BASE_URL` 覆盖。

| 命令 | 说明 |
|------|------|
| `delta-cli science list` | 列出所有已启用的 science 工具 |
| `delta-cli science get <tool_name>` | 查看指定工具的详情 |
| `delta-cli science invoke --tool <tool_name> --endpoint <endpoint_name> [--data '{"key":"value"}'] [--params '{"key":"value"}']` | 调用工具端点 |
| `delta-cli science endpoints list <tool_name>` | 列出指定工具的所有端点 |

CLI 和内置 Science Skills 统一使用简洁 operation，例如 `health`、`composition-parse`、
`similarity-matrix` 和 `optimize`。连接默认 `/science_tool` 旧服务时，CLI 会自动映射成
`chem_pymatgen_health` 等旧 catalog 名称；连接新版 Science Server 时则自动适配其规范
operation。`science endpoints list` 优先展示简洁名称，并在 `catalog_name` 中保留服务端原名。

## 输出格式

所有命令返回统一的 JSON envelope：

```json
// 成功
{"ok":true,"data":{"id":"sb-xxx","status":"running"}}

// 错误
{"ok":false,"error":{"type":"auth","message":"not authenticated","hint":"run 'delta-cli auth login'"}}
```

错误类型及退出码：

| Type | Exit Code | 场景 |
|------|-----------|------|
| validation | 2 | 参数错误 |
| auth | 3 | 未认证 |
| permission | 4 | 权限不足 |
| not_found | 5 | 资源不存在 |
| network | 6 | 网络错误 |
| api | 7 | 服务端错误 |
| internal | 10 | 客户端内部错误 |

## AI Agent Skills

delta-cli 内置 AI Agent 操作手册（Skills），帮助 Claude Code 等 AI 助手正确使用 CLI：

```bash
# 安装仓库中的全部 Skills
npx skills add delta-infra/delta-infra-cli -y -g

# 也可以只安装某个 Skill，例如 Science 总控
npx skills add delta-infra/delta-infra-cli -s delta-science
```

Skill 文件位于 `skills/` 目录：
- `delta-shared/` — 全局通用规则（认证、配置、错误处理）
- `delta-sandbox/` — Sandbox 操作指南（生命周期、命令路由）
- `delta-science/` — Science 总控、跨服务编排、统一 Delta CLI wrapper
- `pubchem/`、`rdkit/`、`pymatgen/` — 化合物与材料基础计算
- `gsasii/`、`lammps/` — 衍射和分子动力学
- `delta-bo/`、`ldm-bo/`、`synbo-service/` — 科学优化流程
- `antbo-service/`、`antbo-ldm-guard/` — AntBO 作业与未暴露 LDM 请求保护

一键安装、升级和卸载会同步上述完整集合；具名服务 Skill 负责参数契约，
`delta-science` 负责从简短的人类科研请求中选择服务并组织数据交接。

## 开发

```bash
# 本地构建
make build

# 运行测试
make test

# 代码检查
make lint

# 跨平台编译（生成各平台二进制文件到 bin/）
make release

# 源码安装到系统 PATH（默认 /usr/local/bin；macOS / Linux）
make install

# 自定义安装前缀
make PREFIX=$HOME/.local install

# Windows 源码安装（二选一）
# 方式 A：直接用 go install 安装到 GOPATH/bin
go install github.com/delta-infra/delta-infra-cli/cmd/delta-cli@latest

# 方式 B：在仓库根目录运行 PowerShell 脚本，构建并添加到用户 PATH
# .\install-from-source.ps1
# .\install-from-source.ps1 -InstallDir "$env:USERPROFILE\bin"
```

### 日常开发流程

修改 `skills/` 或编译 `delta-cli` 后，需要同步到 Memento-S 项目才能生效：

```bash
# 1. 通过安装向导同步完整 Skill 集合
node scripts/install-wizard.js

# 2. 用 Docker 编译 Windows 版本（本地无 Go toolchain 时）
docker run --rm -v "$(pwd):/src" -w /src \
  -e GOPROXY=https://goproxy.cn,direct \
  golang:1.23 \
  sh -c 'go build -buildvcs=false \
    -ldflags "-X github.com/delta-infra/delta-infra-cli/internal/build.Version=$(git describe --tags --always --dirty 2>/dev/null || echo dev)" \
    -o bin/delta-cli-windows-amd64.exe ./cmd/delta-cli'

# 3. 将 delta-cli 放到 Memento-S 的 node_modules/.bin（替换旧版本）
cp bin/delta-cli-windows-amd64.exe \
   <memento-s>/electron_rebuild/node_modules/.bin/delta-cli

# 4. 重启 Memento-S sidecar 使新 binary 生效
#   在 Electron 界面中重新加载，或手动重启 sidecar 进程
```

> **注意**：`delta-cli` 替换后，如果 `~/.delta-infra/config.json` 中已配置 token，则
> Sandbox 和 Science Skills 可直接使用；否则需要先用 `auth login` 配置。

## 构建与发布

### 本地构建

```bash
# 本地构建
make build

# 运行测试
make test

# 代码检查
make lint

# 跨平台编译（生成各平台二进制文件到 bin/）
make release
```

> `make release` 仅生成各平台二进制文件（如 `bin/delta-cli-linux-amd64`），不会自动打包。打包与发布请使用下文的 `release.sh`。

### 一键发布（维护者）

项目根目录下的 `release.sh` 脚本负责完整发布流程：

```bash
export GH_TOKEN=<your-github-pat>
export NPM_TOKEN=<your-npm-token>
./release.sh v1.0.75
```

脚本执行步骤：
1. 更新 `package.json` 版本号。
2. 使用 Docker + `make release` 交叉编译 5 个平台二进制文件。
3. 在 `bin/` 目录生成 `.tar.gz` / `.zip` 归档。
4. 通过 `.ci/publish-github-release.js` 创建 GitHub Release 并上传资产。
5. 同步 `package.json` 与 `scripts/install.js` 到公开仓库 `yzailab/delta-infra-cli`。
6. 执行 `npm publish --access public` 发布 `@delta-infra/cli`。

需要提前安装 `gh` CLI、Node.js/npm，并配置 `GH_TOKEN` 与 `NPM_TOKEN`。CI 流程可参考 `.gitlab-ci.yml`。

### npm 镜像

如果 GitHub 下载较慢，安装 npm 包时可设置镜像：

```bash
DELTA_CLI_MIRROR="https://gh-proxy.com/https://github.com" npm install -g @delta-infra/cli
```

## 技术栈

- **语言**: Go 1.23+
- **CLI 框架**: [Cobra](https://github.com/spf13/cobra)
- **配置**: JSON 文件（`~/.delta-infra/config.json`，权限 0600）
- **输出**: JSON envelope（AI-agent 友好，可脚本化）
- **发布**: GitHub Release（tar.gz/zip） + npm wrapper
- **架构**: 扁平静态命令树，Factory 依赖注入，惰性初始化

## License

MIT
