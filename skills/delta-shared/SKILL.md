---
name: delta-shared
version: 1.0.0
description: "delta-cli 全局共享规则。使用于首次配置、认证登录、权限不足恢复、配置查看、遇到 JSON 输出中的 _notice 或通用错误处理时。"
---

# delta-cli 共享规则

本技能指导你如何通过 delta-cli 操作 Delta Sandbox 及相关资源，以及所有命令域通用的注意事项。

## 获取服务端地址（必须优先执行）

所有操作的前提是知道 delta-sandbox-server 的地址。按以下步骤获取：

1. 执行 `echo $DELTA_INFRA_BASE_URL` 检查环境变量是否已设置
2. 如果输出非空，说明已配置，直接使用，无需额外操作
3. 如果为空，**向用户询问真实地址**，然后运行 `delta-cli config set base_url <url>` 保存

**不要猜测或虚构地址。不确认地址就执行任何操作会导致 network 错误。**

## 配置初始化

首次使用需运行 `delta-cli config init` 完成配置：

```bash
delta-cli config init
```

这会创建 `~/.delta-infra/config.json`，需按实际部署设置 base_url（`delta-cli config set base_url <url>`），也可通过环境变量 `DELTA_INFRA_BASE_URL` 覆盖。

## 配置管理

```bash
delta-cli config show
delta-cli config set base_url <url>
delta-cli config set api_key <key>
delta-cli config set token <token>
delta-cli config remove api_key
delta-cli config remove token
```

## 环境变量覆盖

以下环境变量优先级高于配置文件：

| 变量 | 说明 |
|------|------|
| `DELTA_INFRA_BASE_URL` | 覆盖 base_url |
| `DELTA_SANDBOX_API_KEY` | 覆盖 api_key |
| `DELTA_SANDBOX_TOKEN` | 覆盖 token |

## 认证

delta-cli **不再内嵌默认凭证**，使用前必须配置认证。

支持两种认证方式，优先级从高到低：

| 方式 | 命令 / 来源 | 适用场景 |
|------|------------|----------|
| API Key | `delta-cli auth login --api-key <key>` 或环境变量 `DELTA_SANDBOX_API_KEY` | 推荐 |
| Bearer Token | `delta-cli auth login --token <token>` 或环境变量 `DELTA_SANDBOX_TOKEN` | 使用已有 token |

### 默认认证说明

- binary 中没有默认 token，第一次使用**必须**执行 `delta-cli auth login` 或设置环境变量。
- 如需更换账号，重新执行 `delta-cli auth login --token <token>` 或 `delta-cli auth login --api-key <key>`。
- 未配置时 `auth status` 会显示 `method: none`。

### 查看认证状态

```bash
delta-cli auth status
```

### 权限不足处理

遇到认证/权限错误时（`error.type: auth` 或 `permission`）：

1. 先执行 `delta-cli auth status` 确认当前认证状态
2. 如需更换认证，执行 `delta-cli auth login --token <token>` 或 `delta-cli auth login --api-key <key>`
3. 如已认证但仍报错，检查 base_url 是否正确

**禁止**：将 API Key 或 Token 输出到终端明文展示给用户。

## 安全规则

- **禁止输出密钥**：`api_key`、`token` 不得在日志、消息或终端中明文展示。
- **写入/删除操作前必须确认用户意图**：`sandbox kill`、`sandbox finish`、`sandbox write` 等操作前需明确告知用户影响。
- **配置文件权限**：`~/.delta-infra/config.json` 权限为 `0600`，严禁手动放宽。
- **sandbox 必须销毁**：调用 `sandbox create` 后，当前任务结束前必须调用 `sandbox kill`。server 端无自动清理，不销毁 = 永久占用 GPU。即使遇到错误也不得跳过销毁。

## JSON 输出约定

所有命令输出遵循统一 JSON envelope：

```json
{"ok":true,"data":{...}}
{"ok":false,"error":{"type":"auth","message":"...","hint":"..."}}
```

AI Agent 解析规则：
- 始终检查 `ok` 字段，不要仅依赖 exit code
- `error.type` 是稳定分支字段：`auth`, `permission`, `not_found`, `validation`, `network`, `api`, `internal`
- `error.hint` 是可读修复建议，可展示给用户

## 退出码约定

| Type | Exit Code | 场景 |
|------|-----------|------|
| validation | 2 | flag 错误、参数缺失 |
| auth | 3 | 未认证或认证失败 |
| permission | 4 | 权限不足 |
| not_found | 5 | sandbox/file 不存在 |
| network | 6 | DNS、超时、连接失败 |
| api | 7 | 服务端非 2xx 错误 |
| internal | 10 | 客户端内部错误 |

## 更新检查

`delta-cli update check` 检查最新版本。

**当你在 JSON 中看到 `_notice.update` 时**，完成用户当前请求后，主动提议更新：

```bash
delta-cli update
```

## 常见恢复

| 错误 / 现象 | 恢复动作 |
|-------------|----------|
| `error.type: auth` | 先执行 `auth status` 确认；如无认证或需更换，执行 `auth login --token <token>` |
| `error.type: not_found` | 检查 sandbox_id 或 path 是否正确 |
| `error.type: network` | 检查 base_url 和网络连通性 |
| `error.type: validation` | 检查必填 flag 和参数格式 |
| 配置文件解析失败 | 检查 `~/.delta-infra/config.json` 是否为有效 JSON |
