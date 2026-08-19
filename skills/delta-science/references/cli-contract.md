# Delta CLI 执行约定

## 使用 CLI

所有实时 Science 调用最终都使用已安装的 Delta CLI；CLI 是服务调用边界。标准命令为：

```text
delta-cli science invoke --tool TOOL --endpoint ENDPOINT --data JSON
```

`TOOL` 与 `ENDPOINT` 必须逐字使用当前 reference 或实时目录中的
`tools.name`、`tool_endpoints.name`；不得增加别名映射、裁剪前缀或在 `not_found` 后改名重试。
仅当 operation 文档明确要求查询参数时使用 `--params JSON`。不要同时传递 `--data` 和
`--params`，也不要改用 `curl`、`httpx`、`requests`、`Invoke-RestMethod` 或业务服务 URL。

CLI 使用其标准认证和由 `base_url` 派生出的 Science 服务地址（`{base_url}/science_tool`）。
Skill 不得通过环境变量、命令参数或临时配置改写服务路由，也不读取、修改或伪造凭据。

## 成功与结果

CLI 成功时输出单个 JSON 信封：

```json
{
  "ok": true,
  "data": {}
}
```

只有 CLI 退出码为 0 且顶层 `ok` 为 `true` 时，才能报告调用成功。顶层 `data` 保存服务响应。
按 operation reference 规定的响应结构读取字段：若文档明确说明网关或业务信封的 `data`，
可读取该已知层级；不得递归搜索字段，也不得将业务返回的 `valid:false`、空结果或警告误报为
CLI 传输失败。

退出码非 0 或顶层 `ok:false` 时，本次调用失败；转发 CLI 的原始错误短摘要，不得切换到
其他调用链、修改参数或重试可能已执行的远程变更。

## 实时目录

当用户点名 reference 以外的新工具，或 reference 缺失、过期或与 CLI 返回不一致时，依次执行：

```text
delta-cli science list
delta-cli science endpoints list TOOL
```

两次调用都必须满足成功条件。目录只用于获取精确名称；若其未提供足以安全构造请求的 schema，
说明该限制而不要猜测请求体。

## 二进制产物

operation 返回 base64 数据时，只解码 operation 文档指定的 `data` 字段。PNG 文件必须以
`89 50 4e 47 0d 0a 1a 0a` 开头。以 `7b`（`{`）开头的是 JSON，不能描述成图片。
