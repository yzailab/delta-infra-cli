---
name: antbo-ldm-guard
description: 任何同时涉及 AntBO/抗体/CDRH3 与 LDM/suggest/下一条候选序列的请求都必须优先于所有其他 AntBO Skill 立即使用本 Skill，即使历史序列或评分尚未提供。当前 Delta CLI catalog 未暴露 AntBO LDM initialize/evaluate/suggest；唯一正确结果是说明未发送远端请求，禁止询问数据、建文件、调用 health/Science/filesystem 或改用小分子 LDM-BO。
---

# AntBO LDM 能力边界

本 Skill 没有可执行的 Science operation，也没有 wrapper、endpoint 或 payload 示例。
为了兼容 Kimi 对“无 artifact 的 step_finish”误判为 loop，先生成一个只记录能力边界的
本地证据文件；这不是 Science 调用，也不发送远端请求。

第一次工具调用必须是 `python_repl`，工具参数只能包含 `code`，执行以下等价逻辑：

```python
import json, os
from pathlib import Path

result = {
    "supported": False,
    "tool": "antbo",
    "operation": "ldm-suggest",
    "remote_request_sent": False,
    "reason": "当前 Delta CLI catalog 未暴露 antbo LDM suggest operation",
}
output_path = Path(os.environ["WORKSPACE_ROOT"]) / "antbo_ldm_unsupported.json"
output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(str(output_path))
```

随后调用且只调用一次：

```text
step_finish(
  status="done",
  summary="当前 Delta CLI catalog 未暴露 antbo LDM suggest operation；未发送远端请求。",
  output_ref=<刚生成的 antbo_ldm_unsupported.json 绝对路径>
)
```

必须逐字使用上述 summary 和真实 output_ref。调用后立即结束，不输出其他文字，不调用
任何工具。外层若核验，只能原子 `read_file(output_ref)` 一次，禁止其他操作。

禁止行为：

- 除上述一次本地文件写入外，禁止其他 `python_repl`；禁止 Bash、health、catalog、
  filesystem、目录 read/list、ask_user；
- 禁止创建 history JSON，禁止先要求用户提供序列或评分；
- 禁止调用 `antbo-service`、`ldm-bo` 或通用子代理；
- 禁止生成、转换、评价或声称返回候选 CDRH3；
- 禁止把 AntBO health 公布的公司内部 endpoint 当成 Delta CLI operation。

公司服务能力与 Delta CLI catalog 是两层能力。当前 Memento 只能通过 CLI catalog
调用 `antbo` 的 `health/run-default-job/run/log/jobs/stop`；因此 AntBO LDM 请求必须在
本 Skill 内以固定能力边界答复结束。
