---
name: pubchem
description: 当用户给出化学品、分子、药物名称并询问 CID、同义词、分子式、分子量、SMILES、InChI、IUPAC 名、XLogP、TPSA 或供受体数量时使用；也用于在 RDKit 前批量把名称解析为 SMILES。所有实时请求只走 Delta CLI wrapper，并以当前 WORKSPACE_ROOT 下的有界 JSON 作为权威交接产物。
---

# PubChem 服务

## 强制执行规则

1. 第一个且唯一实时执行工具是 `python_repl`，直接执行
   `$SKILLS_ROOT/delta-science/scripts/invoke.py`。
   调用 `python_repl` 时工具参数对象只能包含 `code`；禁止传入 `deps`、
   `dependencies`、`packages` 或其他参数。
2. `SKILLS_ROOT` 只通过 `os.environ["SKILLS_ROOT"]` 读取；禁止 Bash、
   `list_dir/read_file/which/where/ls`、wrapper 检查和路径探测。
3. 禁止执行字面命令 `CLI/cli/delta-cli`，禁止 curl、requests、httpx、浏览器、
   PUG-REST 和本地替代。
4. wrapper 已解包所有 envelope，业务结果直接位于 `r["native"]`；禁止
   `native.data` 和递归找值。
5. 不先调用 health/schema，不为“验证”重复同一请求。

## 单化合物默认模板

```python
import json, os, subprocess, sys
from pathlib import Path
wrapper=os.path.join(os.environ["SKILLS_ROOT"],"delta-science","scripts","invoke.py")
payload={"identifier":"aspirin","namespace":"name"}
p=subprocess.run([sys.executable,wrapper,"--tool","pubchem","--endpoint","compound-summary",
                  "--data-json",json.dumps(payload)],capture_output=True,text=True,
                 encoding="utf-8",errors="replace",shell=False,timeout=150)
if p.returncode != 0: raise RuntimeError(p.stderr or p.stdout)
r=json.loads(p.stdout)
if r.get("ok") is not True or r.get("transport")!="delta-cli": raise RuntimeError(r)
n=r["native"]; x=n["properties"]
out={"transport":r["transport"],"endpoint":r["endpoint"],"valid":n["valid"],
     "cid":n.get("cid") or x.get("CID"),"canonical_smiles":x.get("CanonicalSMILES"),
     "molecular_formula":x.get("MolecularFormula"),
     "molecular_weight":x.get("MolecularWeight")}
output_path=Path(os.environ["WORKSPACE_ROOT"])/"pubchem_result.json"
output_path.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"output_ref":str(output_path),"result":out},ensure_ascii=False))
```

`out` 只保留用户要求的字段。逐字复制返回值：不得改写等价 SMILES、给公式加排版、
给数值加单位、添加 URL/链接/用途/机制或未请求属性。

## operation 选择

- 一个名称的基础信息：一次 `compound-summary`。
- 两个及以上名称：一次 `compound-batch-summary`，body 只用
  `{"identifiers":[...],"namespace":"name"}`。
- 只解析 CID、只查属性或同义词：分别使用 `compound-resolve-cids`、
  `compound-properties`、`compound-synonyms`。
- 每个 operation 的准确情景、payload 和投影见
  `references/operations.md`；复杂字段再看 `references/endpoints.md`。

批量结果从 `native.results[*]` 读取，原标签是 `input`，化合物字段在嵌套
`properties`。SMILES 回退顺序固定为：

```text
CanonicalSMILES || ConnectivitySMILES || SMILES || IsomericSMILES
```

无机材料化学式、组成和式量路由 pymatgen；PubChem not_found 原样保留，不编造 CID
或本地补算。PubChem `XLogP` 与 RDKit `MolLogP` 不得互换。

成功写入有界 JSON 后，用其中的原始字符串和数值构造无 Markdown、无单位的最终文本，
并立即调用 `step_finish` 恰好一次。例如：

```text
【最终答案，必须逐字转发】
CID: 2244
规范 SMILES: CC(=O)OC1=CC=CC=C1C(=O)O
分子式: C9H8O4
分子量: 180.16
```

`status="done"`，`summary` 第一行必须逐字为 `【最终答案，必须逐字转发】`，其余行
逐字使用当前 out；`output_ref` 必须是刚写入的绝对 `pubchem_result.json` 路径。
不得使用示例固定值。缺少首行或 output_ref 时不得结束步骤。
Skill 自身的 final_response 和外层 Memento 都必须逐字复制 summary，包括大小写和标点，
不得改成 Markdown/LaTeX、另一种等价 SMILES、添加单位、链接或说明。失败时调用
`step_finish(status="failed", summary=<原始错误短摘要>)`。调用后禁止自由文本和工具。

具名 Skill 返回后，外层若需要核验只能对 `output_ref` 使用一次原子 `read_file`；禁止
`python_repl`、`list_dir`、路径探测或再次调用 PubChem/Science。该文件只是当前会话的
内部证据交接，不是用户要求的额外交付物。
