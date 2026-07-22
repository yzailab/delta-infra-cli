---
name: delta-shared
description: "delta-cli 全局共享规则：配置/认证检查、安全红线、错误处理、sandbox 销毁。"
---

# delta-cli 共享规则

指导 AI 使用 `delta-cli` 的通用规则。核心原则：**只检查、不猜测、不泄露密钥**。

## 执行任何操作之前

1. 确认服务端地址：
   ```bash
   delta-cli config show
   ```
2. 确认认证状态：
   ```bash
   delta-cli auth status
   ```

- 若 `auth status` 显示 `method: token`，**直接执行目标命令**，不要重复登录或初始化配置。
- 若显示 `method: none`，或操作返回 `error.type: auth` / `permission`，才进入下面的“补全配置”流程。

## 补全配置

缺少服务端地址或凭证时，**向用户询问一次**，然后用 flag 初始化：

```bash
delta-cli config init --base-url <server-url> --token <token>
```

不要用交互式 `config init`（无 flag），避免在 stdin 不可用时卡住。

### 信息来源优先级

1. 环境变量：`DELTA_INFRA_BASE_URL`、`DELTA_INFRA_TOKEN`
2. `~/.delta-infra/config.json` 中的 `base_url` / `token`
3. 默认值：仅 `base_url` 有内部默认值
4. 以上都缺失时，**必须询问用户**，禁止虚构

### 运行时凭证

CLI 使用 `token` 发送请求头 `Authorization: Bearer <token>`，并自动从 JWT 中提取 `uid` 作为 `X-User-Uid`。

## 安全红线

- **禁止输出密钥**：`token` 不得出现在日志、消息、终端。
- **禁止自己拼 URL / 构造 HTTP 请求**：所有请求都走 `delta-cli`。
- **不要主动安装 CLI**：如果用户说没装，建议他去 README 或 install.sh，不要自己选安装方式。
- **写入/删除操作前确认意图**：`sandbox kill`、`sandbox finish`、`sandbox write` 等必须告诉用户影响。
- `~/.delta-infra/config.json` 权限为 `0600`，不要手动放宽。
- **sandbox 必须销毁**：调用 `sandbox create` 后，当前任务结束前必须调用 `sandbox kill`。server 端无自动清理，不销毁 = 永久占用 GPU；即使出错也不得跳过。

## JSON 输出约定

```json
{"ok":true,"data":{...}}
{"ok":false,"error":{"type":"auth","message":"...","hint":"..."}}
```

AI Agent 解析规则：
- 始终检查 `ok`，不要只看 exit code。
- `error.type` 是稳定分支字段：`auth`, `permission`, `not_found`, `validation`, `network`, `api`, `internal`。
- `error.hint` 可展示给用户。

## 退出码约定

| Type | Exit Code | 场景 |
|------|-----------|------|
| validation | 2 | flag / 参数错误 |
| auth | 3 | 未认证或认证失败 |
| permission | 4 | 权限不足 |
| not_found | 5 | sandbox/file 不存在 |
| network | 6 | DNS、超时、连接失败 |
| api | 7 | 服务端非 2xx |
| internal | 10 | 客户端内部错误 |

## 升级检查

完成用户请求后，如果 JSON 中有 `_notice.update`，可建议：

```bash
delta-cli upgrade
```

## 常见恢复

| 错误 / 现象 | 恢复动作 |
|-------------|----------|
| `error.type: auth` / `method: none` | 询问用户后执行 `config init --base-url <url> --token <token>` |
| `error.type: permission` | 确认当前认证是否有权限；必要时换 token |
| `error.type: not_found` | 检查 `sandbox_id` / path |
| `error.type: network` | 检查 `base_url` 和网络连通性 |
| `error.type: validation` | 检查必填 flag 和参数格式 |
| 配置文件解析失败 | 检查 `~/.delta-infra/config.json` 是否为有效 JSON |
