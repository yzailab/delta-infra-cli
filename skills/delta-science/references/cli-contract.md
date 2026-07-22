# Delta CLI 执行约定

## 只能通过内置 wrapper 调用

实时 Science 调用的第一个且唯一执行工具必须是 `python_repl`。禁止 Bash、
`list_dir`、`read_file`、`which`、`where`、`ls` 或任何路径探测；禁止让通用
subagent 执行 Science 步骤，也禁止运行字面命令 `CLI`、`cli`、`delta-cli`。
`SKILLS_ROOT` 只能通过 Python 的 `os.environ["SKILLS_ROOT"]` 读取，
`@SKILLS_ROOT` 不是可供文件工具访问的路径。

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
  "resolved_tool": "rdkit",
  "resolved_endpoint": "chem_rdkit_parse",
  "catalog_profile": "legacy",
  "elapsed_seconds": 1.23,
  "envelope_depth": 2,
  "native": {}
}
```

Skill 代码始终传规范 tool/operation。默认旧 `/science_tool` 服务会自动把
`pymatgen/health` 映射为 `pymatgen/chem_pymatgen_health`，并把 `synbo`、`antbo`
分别映射为旧 catalog 的 `synbo-service`、`antbo-service`；不要在 Skill 示例中硬编码
这些旧名称。新版 Science Server 保持规范名称。测试时可用
`--catalog-profile canonical|legacy` 或 `runtime.local.json` 的 `catalog_profile`
显式覆盖自动判断。

wrapper 校验 CLI 的 `{ok,data}` 信封，只解包已知的 Infra 转发结果 `{status_code,headers,data}` 和业务服务信封 `{code,message,data}`。它不会在任意嵌套字段中搜索看似合理的结果。`ok=false` 会包含稳定的 `stage` 和错误文本。

解包成功后，业务结果直接位于 `result["native"]` 顶层。禁止读取
`result["native"]["data"]`，也禁止递归搜索字段。

即使存在部分数据，`ok=false` 仍必须视为失败。禁止静默切换到其他调用链。

## 二进制产物

operation 返回 base64 数据时，只解码文档指定的 native 字段。PNG 文件必须以 `89 50 4e 47 0d 0a 1a 0a` 开头。以 `7b`（`{`）开头的是 JSON，不能描述成图片。
