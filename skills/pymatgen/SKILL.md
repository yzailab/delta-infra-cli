---
name: pymatgen
description: 当用户需要解析材料化学式与组成、计算式量、解析或总结 CIF/POSCAR/JSON/CSSR/XSF 晶体结构、转换结构格式或分析空间群和对称性时使用。所有实时请求只走 Delta CLI wrapper；无机化学式优先使用本 Skill，不用 PubChem 或本地元素表替代。
metadata:
  allowed-tools:
    - read_file
    - python_repl
    - step_finish
---

# pymatgen 服务

## 强制规则

- 第一个且唯一实时执行工具是 `python_repl`；直接执行
  `$SKILLS_ROOT/delta-science/scripts/invoke.py`，tool 固定为 `pymatgen`。
- `python_repl` 工具参数只能包含 `code`，禁止 `deps/dependencies/packages`。
- `SKILLS_ROOT` 只通过 `os.environ` 读取。禁止 Bash、目录/路径探测、字面 CLI
  命令、直接 HTTP 和本地 pymatgen。
- wrapper 成功后的业务结果是 `r["native"]` 顶层，禁止 `native.data`。
- 结构接口必须发送完整结构文本，不能发送本地文件路径；只支持
  `cif/poscar/json/cssr/xsf`，不接收 LAMMPS data/dump。

## wrapper 模板

```python
import json, os, subprocess, sys
wrapper=os.path.join(os.environ["SKILLS_ROOT"],"delta-science","scripts","invoke.py")
p=subprocess.run([sys.executable,wrapper,"--tool","pymatgen","--endpoint",endpoint,
                  "--data-json",json.dumps(payload)],capture_output=True,text=True,shell=False)
if p.returncode != 0: raise RuntimeError(p.stderr or p.stdout)
r=json.loads(p.stdout)
if r.get("ok") is not True or r.get("transport")!="delta-cli": raise RuntimeError(r)
n=r["native"]
print(json.dumps(out,ensure_ascii=False))
```

`out` 必须从 `n` 投影，不得用记忆补值。

## operation 选择

- `health`：明确健康检查；省略 `--data-json`。
- `composition-parse`：`{"formula":"LiFePO4","format":"formula"}`。
- `structure-parse`：`{"input":结构文本,"format":"cif","primitive":false}`。
- `structure-summary`：同上，用于 formula、density、volume、lattice、species。
- `structure-convert`：`{"input":结构文本,"input_format":"cif","output_format":"poscar","primitive":false}`。
- `structure-symmetry`：`{"input":结构文本,"format":"cif","primitive":false,"symprec":0.01,"angle_tolerance":5.0}`。

详细 native 字段见 `references/endpoints.md`。一个请求只调用所需 operation；无机式量
只报告当前 native 的 `weight`，PubChem not_found 不得改写或本地补算。

成功打印有界 JSON 后立即调用 `step_finish(status="done", summary=<同一 JSON>)`
恰好一次；失败时调用 `step_finish(status="failed", summary=<原始错误短摘要>)`。
调用后不得输出自由文本或使用其他工具。
