# delta-cli

Delta Infra 的命令行工具。

## 安装

### 方式一：直接下载 Binary（推荐）

从 [GitHub Releases](https://github.com/yzailab/delta-infra-cli/releases) 下载对应平台的压缩包：

```bash
# macOS (Apple Silicon)
curl -L https://github.com/yzailab/delta-infra-cli/releases/download/v1.0.0/delta-cli-darwin-arm64.tar.gz | tar -xz
sudo mv delta-cli-darwin-arm64/delta-cli /usr/local/bin/

# Linux (AMD64)
curl -L https://github.com/yzailab/delta-infra-cli/releases/download/v1.0.0/delta-cli-linux-amd64.tar.gz | tar -xz
sudo mv delta-cli-linux-amd64/delta-cli /usr/local/bin/

# Windows (AMD64)
# 下载 delta-cli-windows-amd64.zip 并解压
```

### 方式二：npm

```bash
npm install -g @delta-infra/cli
```

安装时会自动从 GitHub Release 下载当前平台的二进制文件并解压到本地。

## 快速开始

### 1. 初始化配置

```bash
delta-cli config init
```

配置文件保存在 `~/.delta-infra/config.json`（权限 0600），通过 `delta-cli config set base_url <url>` 配置服务端地址。也可通过环境变量覆盖：

```bash
export DELTA_INFRA_BASE_URL=<url>
```

### 2. 认证

支持 API Key 或 Bearer Token：

```bash
# API Key
delta-cli auth login --api-key <your-api-key>

# Bearer Token
delta-cli auth login --token <your-token>

# 查看认证状态
delta-cli auth status
```

### 3. Sandbox 生命周期

```bash
# 创建带 GPU 的 sandbox
delta-cli sandbox create \
  --image deltarouter/pytorch-cuda13:latest \
  --cpu 4 --memory 16Gi --gpu 1

# 运行训练命令
delta-cli sandbox run <sandbox_id> \
  --command "python /workspace/train.py" \
  --timeout 3600

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
| `delta-cli auth login --api-key <key>` | API Key 认证 |
| `delta-cli auth login --token <token>` | Token 认证 |
| `delta-cli auth status` | 查看认证状态 |
| `delta-cli update check` | 检查更新 |
| `delta-cli update` | 安装最新版本 |
| `delta-cli --version` | 显示版本 |

### Sandbox 命令

| 命令 | 说明 |
|------|------|
| `delta-cli sandbox create --image <img>` | 创建 sandbox 容器 |
| `delta-cli sandbox connect <id>` | 连接 sandbox |
| `delta-cli sandbox status <id>` | 查看 sandbox 状态 |
| `delta-cli sandbox run <id> --command "..."` | 同步运行命令 |
| `delta-cli sandbox run-bg <id> --command "..."` | 后台运行命令 |
| `delta-cli sandbox logs <id> --execution-id <eid>` | 查看后台日志 |
| `delta-cli sandbox read <id> --path <path>` | 读取容器内文件 |
| `delta-cli sandbox write <id> --path <path> --data "..."` | 写入文件 |
| `delta-cli sandbox finish <id> --results '{...}'` | 标记完成并返回结果 |
| `delta-cli sandbox kill <id>` | 销毁 sandbox |

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
# 安装共享技能（认证、配置、通用规则）
npx skills add delta-infra/delta-infra-cli -s delta-shared

# 安装 sandbox 操作技能
npx skills add delta-infra/delta-infra-cli -s delta-sandbox
```

Skill 文件位于 `skills/` 目录：
- `delta-shared/` — 全局通用规则（认证、配置、错误处理）
- `delta-sandbox/` — Sandbox 操作指南（生命周期、命令路由）

## 开发

```bash
# 本地构建
make build

# 运行测试
make test

# 代码检查
make lint

# 跨平台发布构建（生成压缩包）
make release

# 安装到 GOPATH/bin
make install
```

### 日常开发流程

修改 `skills/` 或编译 `delta-cli` 后，需要同步到 Memento-S 项目才能生效：

```bash
# 1. 复制 skill 文档到 Memento-S（让 LLM 读到最新的约束规则）
cp skills/delta-sandbox/SKILL.md skills/delta-sandbox/references/*.md \
   <memento-s>/builtin/skills/delta-sandbox/
cp skills/delta-shared/SKILL.md \
   <memento-s>/builtin/skills/delta-shared/

# 2. 用 Docker 编译 Windows 版本（本地无 Go toolchain 时）
docker run --rm -v "$(pwd):/src" -w /src \
  -e GOPROXY=https://goproxy.cn,direct \
  golang:1.23 go build -buildvcs=false \
    -ldflags "-X $(MODULE)/internal/build.Version=$(shell git describe --tags --always --dirty 2>/dev/null || echo dev)" \
    -o bin/delta-cli-windows-amd64.exe ./cmd/delta-cli

# 3. 将 delta-cli 放到 Memento-S 的 node_modules/.bin（替换旧版本）
cp bin/delta-cli-windows-amd64.exe \
   <memento-s>/electron_rebuild/node_modules/.bin/delta-cli

# 4. 重启 Memento-S sidecar 使新 binary 生效
#   在 Electron 界面中重新加载，或手动重启 sidecar 进程
```

> **注意**：`delta-cli` 替换后，Memento-S 的 `delta-sandbox` 技能默认使用内嵌 Bearer Token，无需再手动执行 `auth login`。

## 技术栈

- **语言**: Go 1.23+
- **CLI 框架**: [Cobra](https://github.com/spf13/cobra)
- **配置**: JSON 文件（`~/.delta-infra/config.json`，权限 0600）
- **输出**: JSON envelope（AI-agent 友好，可脚本化）
- **发布**: GitHub Release（tar.gz/zip） + npm wrapper
- **架构**: 扁平静态命令树，Factory 依赖注入，惰性初始化

## License

MIT
