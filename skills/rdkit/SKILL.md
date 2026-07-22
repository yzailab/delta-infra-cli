---
name: rdkit
description: 当用户需要通过已部署的 Delta Science 服务校验或规范化 SMILES/InChI、计算 RDKit 描述符、指纹、相似度、渲染或子结构筛选时使用。所有实时请求只能由 python_repl 直接执行 delta-science Skill 的 invoke.py；禁止 Bash、目录探测、直接 HTTP、本地 RDKit 和 native.data 路径。
---

# RDKit 服务

## 不可违反的执行规则

1. 第一个且唯一允许用于实时 Science 调用的工具是 `python_repl`。
   `python_repl` 的工具参数对象只能包含 `code`；禁止 `deps`、`dependencies`、
   `packages` 或其他参数。
2. 在 `python_repl` 中直接执行同级 Skill 的
   `$SKILLS_ROOT/delta-science/scripts/invoke.py`。`SKILLS_ROOT` 只能通过
   `os.environ["SKILLS_ROOT"]` 读取，不能把 `@SKILLS_ROOT` 当成目录。
3. 禁止使用 Bash、`list_dir`、`read_file`、`which`、`where`、`ls`，禁止检查
   wrapper 或寻找 CLI，禁止执行字面命令 `CLI`、`cli`、`delta-cli`。
4. 禁止 `curl`、`requests`、`httpx`、浏览器和本地 RDKit 回退。
5. wrapper 成功后，业务结果就在 `result["native"]` 顶层；绝不读取
   `result["native"]["data"]`。
6. 一个请求只执行完成任务所需的最少调用。失败后不得自行探测路径、改走 HTTP
   或改用本地计算。

## 唯一调用模板

```python
import json, os, subprocess, sys
wrapper = os.path.join(os.environ["SKILLS_ROOT"], "delta-science", "scripts", "invoke.py")
payload = {
    "molecules": [{"id": "aspirin", "smiles": "CC(=O)OC1=CC=CC=C1C(=O)O"}],
    "descriptor_set": "basic",
    "sanitize": True,
}
p = subprocess.run(
    [sys.executable, wrapper, "--tool", "rdkit", "--endpoint", "batch-parse-describe",
     "--data-json", json.dumps(payload)],
    capture_output=True, text=True, shell=False,
)
if p.returncode != 0:
    raise RuntimeError(p.stderr or p.stdout)
r = json.loads(p.stdout)
if r.get("ok") is not True or r.get("transport") != "delta-cli":
    raise RuntimeError(r)
n = r["native"]
item = n["results"][0]
answer = {
    "endpoint": r["endpoint"],
    "valid": item["valid"],
    "canonical_smiles": item.get("canonical_smiles"),
    "descriptors": item.get("descriptors"),
    "warnings": item.get("warnings", []),
}
print(json.dumps(answer, ensure_ascii=False))
```

只替换 payload 和逻辑 endpoint。不要先调用 health，也不要增加第二次 parse 或
descriptors 调用。只要进程退出码、`ok`、`transport` 和解析均成功，本次调用就已
完成；不得因为界面未显示 Python 表达式值而重复调用，不得通过打印 stdout、stderr
或完整 native 调试。

成功打印有界 JSON 后，立即调用 `step_finish(status="done", summary=<该 JSON>)`
恰好一次，不设置 `output_ref`，随后不得输出自由文本或调用工具。失败时调用
`step_finish(status="failed", summary=<原始错误的短摘要>)`，禁止重试、调试打印或
路径探测。

## 端点选择

- 同时要求解析和基础描述符：只调用一次 `batch-parse-describe`，payload 必须使用
  `molecules`，每项使用 `id` 和 `smiles`；`descriptor_set` 为 `basic`，
  `sanitize` 为 `true`。
- 只解析或规范化一个输入：`parse`，payload 为
  `{"input":"...","format":"smiles"}` 或相应 InChI 格式。
- 只计算描述符：`descriptors`；批量只计算描述符：`batch-descriptors`。
- 两个分子的相似度：`similarity`；多个分子的全对相似度：
  `similarity-matrix`。
- 渲染：`render`；指纹：`fingerprint`；SMARTS 筛选：`substructure`。

非默认 operation 先读 `references/operations.md` 中对应小节；完整字段和允许值再见
`references/endpoints.md`。不要根据其他服务相似端点猜 schema。

## 多分子相似度

名称必须先由 PubChem Skill 得到 SMILES，再执行一次 `similarity-matrix`：

```python
payload = {
    "molecules": [{"id": name, "smiles": smiles} for name, smiles in resolved],
    "fingerprint": {"type": "morgan", "radius": 2, "n_bits": 2048},
    "sanitize": True,
}
```

结果从 `n["matrix"]` 和 `n["ranked_pairs"]` 读取。每个排名项固定为
`{"a": 名称, "b": 名称, "similarity": 数值}`；禁止读取 `i`、`j`、
`score`，禁止自行重算或添加阈值解释。

## 结果与失败边界

- 只报告本次 `native` 返回的字段、数值和警告，不用记忆补值。
- 描述符只能逐项复制 `item["descriptors"]` 中实际存在的键和值；不得补充
  `NumAromaticRings`、形式电荷、官能团、手性、结构原因、单位或解释，除非这些字段
  确实由本次 native 返回且用户明确要求。
- `valid: false` 是化学输入校验失败，原样报告 `error`/`warnings`。
- wrapper、CLI 或后端失败时，报告实际阶段和错误；不要继续探测或回退。
- 渲染结果只有在解码后的字节以 PNG magic bytes 开头时才能保存为 `.png`；禁止
  把 JSON envelope 保存成图片。
- PubChem 的 `XLogP` 与 RDKit 的 `MolLogP` 不是同一来源，不得互相替代。
