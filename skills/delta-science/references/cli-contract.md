# Delta CLI 执行约定

## 只能通过内置 wrapper 调用

使用 Python 执行 wrapper。在 Memento 中从 `SKILLS_ROOT` 获取路径：

```python
import json, os, subprocess, sys

wrapper = os.path.join(os.environ["SKILLS_ROOT"], "delta-science", "scripts", "invoke.py")
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

wrapper 校验 CLI 的 `{ok,data}` 信封，只解包已知的 Infra 转发结果 `{status_code,headers,data}` 和业务服务信封 `{code,message,data}`。它不会在任意嵌套字段中搜索看似合理的结果。`ok=false` 会包含稳定的 `stage` 和错误文本。

即使存在部分数据，`ok=false` 仍必须视为失败。禁止静默切换到其他调用链。

## 二进制产物

operation 返回 base64 数据时，只解码文档指定的 native 字段。PNG 文件必须以 `89 50 4e 47 0d 0a 1a 0a` 开头。以 `7b`（`{`）开头的是 JSON，不能描述成图片。
