# Delta CLI 执行约定

## 只能通过内置 wrapper 调用

实时 Science 调用只能由宿主可用的 shell 或 Python 执行内置 wrapper。先定位当前
`SKILL.md` 所在目录，再执行该目录下 `scripts/invoke.py` 的绝对路径；不得直接执行
`delta-cli`，也不得改用直接 HTTP。Claude Code 可使用 `CLAUDE_SKILL_DIR` 定位当前
Skill；Codex 应以当前已加载 Skill 的目录为工作目录，或在已安装的 Skills 目录中查找
精确的 `delta-science/scripts/invoke.py`。不得依赖宿主私有环境变量。

使用 Python 执行 wrapper。下面的 `wrapper` 必须是上述方法定位到的绝对路径：

```python
import json, subprocess, sys

wrapper = "/absolute/path/to/delta-science/scripts/invoke.py"
payload = {"input": "CCO", "format": "smiles"}
completed = subprocess.run(
    [sys.executable, wrapper, "--tool", "rdkit", "--endpoint", "parse",
     "--data-json", json.dumps(payload, ensure_ascii=False)],
    capture_output=True, text=True, encoding="utf-8", errors="replace",
    timeout=150,
)
result = json.loads(completed.stdout)
```

不要把调用拼成 shell 命令字符串。禁止使用 `curl`、`httpx`、`requests`、`Invoke-RestMethod` 或业务服务 URL。

wrapper 内部构造以下 argv：

```text
delta-cli science invoke --tool TOOL --endpoint ENDPOINT --data JSON
```

只有明确记录为查询参数的 operation 才使用 `--params-json`。同一次调用不得同时发送 `--data-json` 和 `--params-json`。

## 可执行文件与配置解析顺序

wrapper 按以下顺序解析 `delta-cli`：

1. `--cli`
2. `DELTA_CLI_PATH`
3. `SKILL.md` 同级、未纳入版本控制的 `runtime.local.json`
4. `PATH` 中的 `delta-cli` 或 `delta-cli.exe`
5. npm 包相邻的 `bin/delta-cli[.exe]`

CLI 从 `~/.delta-infra/config.json` 读取 `science_base_url`。显式 `--science-base-url` 只用于测试覆盖，并通过 `DELTA_INFRA_SCIENCE_BASE_URL` 传给子进程。

## wrapper 返回结果

成功输出格式：

```json
{
  "ok": true,
  "transport": "delta-cli",
  "tool": "rdkit",
  "endpoint": "parse",
  "elapsed_seconds": 1.23,
  "envelope_depth": 2,
  "native": {}
}
```

`tools.name` 和 `tool_endpoints.name` 是唯一权威名称。Skill 代码始终把 reference 中的
tool/operation 原样传给 CLI，CLI 再原样提交给 Science Server；任何一层都不执行旧
名称映射、前缀裁剪、profile 判断或失败后的改名重试。若 reference 与数据库名称不一致，
本次调用按 `not_found` 失败结束，应修正数据库配置或 reference，而不是在客户端添加映射。

wrapper 校验 CLI 的 `{ok,data}` 信封，只解包已知的 Infra 转发结果
`{status_code,headers,data}` 和业务服务信封 `{code,message,data}`。它不会在任意嵌套
字段中搜索看似合理的结果。`ok=false` 会包含稳定的 `stage`、`error_type`、
`cli_exit_code` 和错误文本。宿主 shell/Python 的进程成功状态不能覆盖这些字段。

解包成功后，业务结果直接位于 `result["native"]` 顶层。禁止读取
`result["native"]["data"]`，也禁止递归搜索字段。

即使存在部分数据，`ok=false` 仍必须视为失败。禁止静默切换到其他调用链，也不得在
最终统计中写“无错误”。业务成功后立即结束，不得为比较模型而追加请求。

## 二进制产物

operation 返回 base64 数据时，只解码文档指定的 native 字段。PNG 文件必须以 `89 50 4e 47 0d 0a 1a 0a` 开头。以 `7b`（`{`）开头的是 JSON，不能描述成图片。
