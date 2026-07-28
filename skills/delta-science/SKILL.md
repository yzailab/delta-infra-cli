---
name: delta-science
description: "公司在线 Science 能力的统一入口，所有调用都经 Delta CLI。凡是查询具体化合物/CID/SMILES/分子性质、计算分子描述符或相似度、解析晶体/CIF/空间群、模拟或精修 XRD、执行 LAMMPS、根据实验数据做贝叶斯优化、反应条件优化，以及任何 LDM/大发现模型、KRAS G12D 小分子生成优化、固定候选池/PDF2Dock 轨迹或抗体 CDRH3 优化任务，都必须使用本 Skill；不得调用旧 large-discovery-model Skill、旧 gateway 脚本、网页搜索或本地科学库绕过 Delta CLI。普通查询、比较或校验默认直接返回文本，不要主动增加 JSON/CSV、报告、图片或图表步骤；只有用户明确要求保存、导出、绘图或生成文件时才创建产物。"
---

# Delta Science

把自然语言科研任务转换为最少数量、可验证的 Delta CLI Science 调用。只暴露本
Skill；工具选择、operation、参数、跨工具交接和结果校验都在本 Skill 内完成。

## 强制调用链

- 所有在线 Science 操作必须走
  `宿主 shell/Python -> delta-science/scripts/invoke.py -> delta-cli science invoke -> Science Server`。
- 用宿主可用的 shell 或 Python 定位当前 Skill 的 `SKILL.md` 所在目录，再以该目录下的
  `scripts/invoke.py` 的绝对路径执行 wrapper。Claude Code 可使用
  `CLAUDE_SKILL_DIR`；Codex 应以当前已加载 Skill 的目录为工作目录，或在已安装的 Skills
  目录中查找精确的 `delta-science/scripts/invoke.py`。不得依赖宿主私有环境变量。
- 禁止直接执行 `delta-cli`、`curl`、`requests`、`httpx`、浏览器和 PowerShell Web 命令；
  禁止直接访问公司网关或业务服务 URL。
- 禁止使用本地 RDKit、pymatgen、LAMMPS、BO、回归或 sandbox 冒充 Science 结果。
- 执行前读取对应 reference，并从中逐字选择 operation 和请求字段；禁止凭记忆创造字段或
  枚举值。不得读取或修改 wrapper 源码、runtime 或配置文件。
- `tools.name` 和 `tool_endpoints.name` 是唯一权威调用名称。传给 wrapper 的 tool 和
  endpoint 必须与当前数据库目录完全一致；CLI 和 wrapper 都不做别名映射、前缀裁剪、
  profile 判断或 `not_found` 后改名重试。reference 与目录不一致时终止并报告配置问题。
- 业务结果直接位于 `result["native"]`。禁止读取 `native.data` 或递归搜索结果。
- 只有子进程退出码为 0、`result["ok"] is True` 且
  `result["transport"] == "delta-cli"` 时，才能报告业务成功。

固定 Python 模板（将 `wrapper` 替换为已定位的绝对路径）：

```python
import json, subprocess, sys

wrapper = "/absolute/path/to/delta-science/scripts/invoke.py"

def invoke(tool, endpoint, data=None, params=None, timeout=150):
    argv = [sys.executable, wrapper, "--tool", tool, "--endpoint", endpoint]
    if data is not None:
        argv += ["--data-json", json.dumps(data, ensure_ascii=False)]
    if params is not None:
        argv += ["--params-json", json.dumps(params, ensure_ascii=False)]
    p = subprocess.run(
        argv, capture_output=True, text=True, encoding="utf-8",
        errors="replace", shell=False, timeout=timeout
    )
    if p.returncode != 0:
        raise RuntimeError(p.stderr or p.stdout)
    result = json.loads(p.stdout)
    if result.get("ok") is not True or result.get("transport") != "delta-cli":
        raise RuntimeError(result)
    return result
```

只调用完成目标所需的 operation。跨工具任务在同一个 Skill 执行中按依赖顺序调用，
下游只能使用上一步已验证的 `native`。已知工具不要额外调用 health、schema、
catalog、render、descriptors 或文件操作，除非用户确实要求对应结果。

## 选择工具

| 科研目标 | tool | 详细规则 |
| --- | --- | --- |
| 化合物身份、CID、同义词、公共属性、名称转 SMILES | `pubchem` | [pubchem.md](references/pubchem.md) |
| SMILES/InChI、描述符、指纹、相似度、渲染、子结构 | `rdkit` | [rdkit.md](references/rdkit.md) |
| 无机化学式、CIF/POSCAR、晶体结构、空间群 | `pymatgen` | [pymatgen.md](references/pymatgen.md) |
| 粉末衍射模拟、Rietveld 精修 | `gsasii` | [gsasii.md](references/gsasii.md) |
| 分子动力学、最小化、thermo 与输出文件 | `lammps` | [lammps.md](references/lammps.md) |
| 通用数值/整数/分类实验变量优化 | `delta-bo` | [delta-bo.md](references/delta-bo.md) |
| 固定候选池 next-SMILES、PDF2Dock、分子 BO 轨迹 | `ldm-bo` | [ldm-bo.md](references/ldm-bo.md) |
| KRAS G12D 小分子生成、vina/activity 多目标迭代 | `strbo` | [strbo.md](references/strbo.md) |
| 反应条件初始化、基于真实得率推荐下一批实验 | `synbo` | [synbo.md](references/synbo.md) |
| 抗体 CDRH3 生成/评估及 AntBO 作业管理 | `antbo` | [antbo.md](references/antbo.md) |

用户使用 “LDM”“大发现模型”“小分子药 LDM” 或 “抗体 LDM” 表述完整科研流程时，
先读取 [ldm.md](references/ldm.md)，再只读取其中选定后端对应的一个 reference。
`ldm.md` 是编排规则，不是 tool，不得把 `ldm` 当作 `--tool` 参数。

工具明确时直接读取所选 tool 的 reference，其中已经包含 operation、参数和最小场景；
不要读取其他工具文档。只有任务在两个或多个工具之间存在歧义时，才先读
[routing-index.md](references/routing-index.md)。跨工具任务再读
[workflows.md](references/workflows.md)。

本表是经过验证的科研路由，不是服务端工具清单。若用户明确点名本表之外的新工具，
允许通过宿主 shell/Python 运行同目录的 `scripts/catalog.py --tools`，再使用目录返回
的精确 tool name 运行一次 `catalog.py --endpoints <tool>`；两次读取都必须满足
`transport="delta-cli"`。不得用空 body、错误参数、health、help、源码、wrapper 或
直接 HTTP 探测。实时 endpoint 元数据若没有足够的请求字段契约，应说明“目录已发现，
但服务端未提供可安全构造请求的 schema”，不得猜 body、模糊匹配或转换名称。新增工具
因此无需修改 CLI；只有需要自然语言自动选路或自动组装参数时，才补充对应 reference。

## 路由边界

- 普通分子名称先用 PubChem；只有需要结构计算时才把成功返回的 SMILES 交给 RDKit。
- 无机化学式、组成和式量优先 pymatgen，不用 PubChem 或本地元素表补算。
- 通用实验变量使用 Delta-BO；已有固定 SMILES 候选池或 PDF2Dock 轨迹使用 LDM-BO；
  围绕服务端固定 KRAS G12D 生成并迭代小分子使用 STRBO；偶联反应、反应条件和历史
  得率使用 SynBO；抗体/CDRH3 使用 AntBO，不得混用。
- 在线 LDM、STRBO、AntBO 和 LDM-BO 任务不得转交旧 `large-discovery-model` Skill，
  不得运行其 gateway 脚本或内置服务地址。离线演示不属于公司 Science 结果；只有用户
  明确要求“不调用公司资源”时才能说明该边界，但本 Skill 仍不得运行旧 Skill。
- GSAS-II 精修必须有真实粉末数据、仪器参数和 phase CIF。LAMMPS 必须有明确的
  input/data/force-field；禁止编造实验数据、CIF、力场、历史观测或优化结果。

## 安全、重试与产物

- `run-default-job`、`run`、`stop` 等远程变更必须由用户明确授权。结果未知、超时或
  断连时不得重试，因为远端操作可能已经发生。
- 参数校验、502、504、timeout、空 recommendations 和后端失败均按本次失败结束。
  SynBO 每个用户任务最多一次业务调用；不得换模型、换 acquisition 或改用本地算法。
- wrapper 第一次返回失败后立即向用户返回原始错误的短摘要（包含 `stage` 和
  `error_type`）。不得读取 wrapper/runtime/config、不得运行 `delta-cli config/auth/help`、
  不得修改环境变量、
  不得伪造 UID、令牌或 API Key，也不得改 operation、参数或调用链重试。
- `X-User-Uid`、登录、quota 或 permission 错误属于终止性认证错误；只转发原始错误和
  登录提示。Skill 绝不自行登录、检查凭据、猜测用户标识或尝试绕过 quota。
- 重型调用串行执行。客户端超时不代表远端计算已取消。
- 用户未要求文件时不创建 CSV、图片或报告。内部交接文件只能写入当前
  `WORKSPACE_ROOT`，不得读取其他会话 workspace 或历史结果补全当前任务。
- 外层规划器自动附加的路径、JSON、图表或报告不等同于用户明确要求。若任务本质只是
  查询、比较或校验，直接返回最小文本结果；不得为了满足附加产物而重复 Science 调用。
- 二进制产物只解码文档明确的字段；PNG 必须验证 magic bytes。

## 输出

将当前 `native` 投影为用户要求的最小结果；逐字保留字符串、数值、警告和来源。
不得补充 native 未返回的单位、机制、引用、链接、预测值或记忆知识。预测结果不得
描述为实测结果。
成功取得最后一个所需 native 后，直接将其投影为最终答复。禁止为了排序、排版、生成
表格或摘要再次执行 wrapper，也禁止把 native 手工复制成新的 Python/JSON 字面量；简单
筛选、比较和文本组织直接在最终答复中完成。

成功时只返回由当前 native 生成的有界纯文本；失败时只返回包含 `stage`、`error_type` 的
原始错误短摘要。完成后不得重新计算、改写或用手工建议替代成功/失败的 Science 结果。

每次成功结果保留：

```text
证据边界：仅限当前 Delta CLI native 结果
调用链：delta-cli
禁止补充未返回内容：是
```

## 完成标准

- 每个在线操作都有 `transport="delta-cli"` 证据；
- 每个科学数值来自当前调用的 native；
- 下游输入来自当前任务中已验证的上游结果；
- 失败准确归类为配置、CLI、参数、Science Server、业务服务或超时；
- 没有直接 HTTP、本地科学库、跨会话文件或人工结果替代。
