---
name: antbo-service
description: 当用户明确要求检查 AntBO 服务健康状态、启动默认或自定义 AntBO 作业、读取 AntBO 日志、列出活动作业或停止指定作业时使用。当前 Delta CLI operation 为 health、run-default-job、run、log、jobs、stop。
metadata:
  allowed-tools:
    - read_file
    - python_repl
    - step_finish
---

# AntBO 服务

## 路由排除

AntBO/CDRH3 LDM、suggest、下一条候选序列请求不进入本 Skill，必须由
`antbo-ldm-guard` 处理。不得先调用本 Skill 的 health。

## 路由与能力边界

当前 Delta CLI catalog 暴露：

- `health`：健康检查，只读。
- `run-default-job`：启动默认后台任务，有副作用。
- `run`：自定义同步任务，有副作用且可能长时间运行。
- `log`：读取日志，只读。
- `jobs`：列出当前容器登记的活动任务，只读。
- `stop`：停止任务，有副作用。

当前没有 `ldm/suggest`、`ldm/initialize` 或 `ldm/evaluate`。这些请求严格执行最上方
终止分支；health 返回的公司内部 endpoint 不能覆盖 CLI catalog。

## 强制执行规则

1. 实时 Science 调用的第一个执行工具只能是 `python_repl`。
   `python_repl` 工具参数只能包含 `code`，禁止 `deps/dependencies/packages`。
2. 只通过 `os.environ["SKILLS_ROOT"]` 定位
   `delta-science/scripts/invoke.py`，使用 `subprocess.run(..., shell=False)`。
3. 禁止 Bash、`list_dir`、`read_file`、`which`、`where`、`ls`、wrapper/环境检查，
   禁止执行字面命令 `CLI`、`cli` 或 `delta-cli`。
4. 禁止 `curl`、`requests`、`httpx`、浏览器、网关直连和本地 AntBO。
5. 业务结果直接位于 `result["native"]`；禁止读取 `native.data`。
6. 每个 operation 的场景、最小参数和投影必须按
   `references/operations.md`，不得猜相近 endpoint。

## 唯一 wrapper 模板

```python
import json, os, subprocess, sys
wrapper = os.path.join(os.environ["SKILLS_ROOT"], "delta-science", "scripts", "invoke.py")
argv = [sys.executable, wrapper, "--tool", "antbo", "--endpoint", endpoint]
if data is not None:
    argv += ["--data-json", json.dumps(data)]
if params is not None:
    argv += ["--params-json", json.dumps(params)]
p = subprocess.run(argv, capture_output=True, text=True, shell=False)
if p.returncode != 0:
    raise RuntimeError(p.stderr or p.stdout)
r = json.loads(p.stdout)
if r.get("ok") is not True or r.get("transport") != "delta-cli":
    raise RuntimeError(r)
n = r["native"]
print(json.dumps({"transport": r["transport"], "endpoint": r["endpoint"], "native": n}, ensure_ascii=False))
```

执行前只按 `references/operations.md` 设置 `endpoint`、`data`、`params`。成功后将
结果投影为用户要求的最小字段，不打印完整日志或 envelope。

## 副作用与完成回执

- `run-default-job`、`run`、`stop` 只有用户明确授权时才能执行。
- 变更操作结果未知、超时或断连时禁止重试；客户端失败不表示远程操作未发生。
- 只有同一次 `run-default-job` native 同时含 `started=true`、非空 `pid` 以及
  `log_name` 或 `log_path` 时，才能说任务已启动。
- `run` 仅用于用户明确提供并授权的受限脚本/config/antigen 路径，不生成任意路径。
- `stop` 优先使用用户确认的 PID；不得在多任务不明确时无参数停止。

成功后立即调用 `step_finish(status="done", summary=<有界结果 JSON>)` 恰好一次；
失败时调用 `step_finish(status="failed", summary=<原始错误短摘要>)`。调用后不得输出
自由文本或使用其他工具。
