---
name: delta-science
description: "Delta Science 的内部共享运行时与跨服务编排参考。不要把普通用户步骤直接路由到本 Skill；规划器必须按科学目标选择 pubchem、rdkit、pymatgen、gsasii、lammps、delta-bo、ldm-bo、synbo-service、antbo-service 或 antbo-ldm-guard，并把跨服务任务拆成具名 Skill 步骤。"
metadata:
  allowed-tools:
    - read_file
    - python_repl
    - step_finish
---

# Delta Science

把普通的人类科学任务转换为一个或多个经过验证的 Delta CLI 调用。用户只需描述科学目标；本 Skill 负责选择工具和 operation、构造参数、执行、校验并简洁报告结果。

## 强制调用链

- 每个在线 Science 操作都必须由所选的具名 service Skill 直接执行本 Skill 的
  `scripts/invoke.py`，最终通过 Delta CLI。禁止把 Science 步骤派发给
  `task[general-purpose]`、通用 subagent 或自由文本子任务。
- 第一个且唯一的实时执行工具是 `python_repl`。禁止 Bash、`list_dir`、
  `read_file`、`which`、`where`、`ls` 和路径探测；禁止执行字面命令
  `CLI science invoke`、`CLI`、`cli` 或 `delta-cli`。
- `python_repl` 的工具参数对象只能包含 `code`；禁止传入 `deps`、
  `dependencies`、`packages` 或任何其他参数。
- `SKILLS_ROOT` 只在 Python 中通过 `os.environ["SKILLS_ROOT"]` 读取，不能把
  `@SKILLS_ROOT` 当作文件路径。
- 禁止使用 `httpx`、`requests`、`curl`、PowerShell Web 命令或浏览器直接访问公司网关、PubChem 或业务服务。
- CLI 调用失败时，禁止改用本地 RDKit、pymatgen 或直接 HTTP；如实报告 CLI 或服务端错误。
- 每次调用都使用 `scripts/invoke.py`。它负责解析 CLI 路径、安全传递 JSON、校验响应信封并记录调用链证据。
- 不要预先检查 wrapper 源码。在 Memento 中，必须在一个 `python_repl` 中用 `subprocess.run(..., shell=False)` 和 argv 列表执行。
- 用户请求中不需要出现 CLI 语法、operation、URL 或 JSON 字段；根据本 Skill 和 references 自动推断。

固定执行形式如下：

```python
import json, os, subprocess, sys
wrapper = os.path.join(os.environ["SKILLS_ROOT"], "delta-science", "scripts", "invoke.py")
payload = {"identifier": "aspirin", "namespace": "name"}
p = subprocess.run(
    [sys.executable, wrapper, "--tool", "pubchem", "--endpoint", "compound-summary",
     "--data-json", json.dumps(payload)],
    capture_output=True, text=True,
)
result = json.loads(p.stdout)
```

每次调用只替换 tool、endpoint 和 payload。只有 references 明确说明是查询参数时才使用 `--params-json`，否则使用 `--data-json`。必须满足 `result["ok"] is True` 且 `result["transport"] == "delta-cli"`，之后业务结果直接使用 `result["native"]`；wrapper 已完成信封解包，禁止再读取 `result["native"]["data"]`。

传给 wrapper 的 tool 和 endpoint 始终使用 references 中的规范名称，例如
`pymatgen/health`、`pymatgen/composition-parse`、`synbo/optimize`。不得自行改写为
`chem_pymatgen_health` 等旧数据库名称；wrapper 会根据 `science_base_url` 自动选择
canonical 或 legacy catalog，并在结果中返回 `resolved_tool`、`resolved_endpoint` 和
`catalog_profile` 作为调用证据。

根据已加载的内容选择服务。执行任何 operation 前，读取
[references/operation-contracts.md](references/operation-contracts.md) 中该 tool 的
对应行；这里只读取已知资源，不进行目录探测。每行给出人类情景、最小代码和 native
投影。更复杂字段才读取其他 reference。

一次成功调用并显式打印有界 JSON 后，立即调用
`step_finish(status="done", summary=<以“【最终答案，必须逐字转发】”开头的有界纯文本>)`
恰好一次；纯文本中的值必须来自同一 JSON，不得加单位、链接、解释或改写字符串。
Skill final_response 与外层 Memento 必须逐字复制该 summary，不能重新排版或补充。
失败时调用
`step_finish(status="failed", summary=<原始错误短摘要>)`。`step_finish` 后禁止输出
自由文本或调用任何工具。具名 service Skill 成功返回后，外层代理必须直接使用其
summary 完成当前计划步骤；如果存在 `output_ref`，最多对该精确路径做一次原子
`read_file`。禁止 `python_repl`、`list_dir`、寻找 CLI 或重复 Science。

## 执行流程

1. 在内部重述科学目标；不要向用户追问本 Skill 已经定义的实现细节。
2. 选择能完成任务的最窄服务，并严格保持用户请求范围。推断 operation 或参数不代表可以增加用户没有要求的图片、文件、健康检查、描述符探测、分析或交付物。
3. 如果 Memento 仅为跨步骤传递已验证数据而要求文件，可以在完成在线调用的同一个 `python_repl` 中写一个有界的内部 JSON。不得为生成或检查交接文件而重复业务调用，也不要把内部交接文件描述成用户要求的产物。
   交接文件必须位于当前 `WORKSPACE_ROOT`（即 `@ROOT`）内；忽略任何其他
   workspace、runner 文件或历史结果文件，绝不能用它们补全当前会话。
4. 已知标识符直接使用。普通分子名称先由 PubChem 解析，再把返回的 SMILES 交给 RDKit。
5. 构造最小合法参数。对于模糊探索任务使用有界默认值，并在最终答案中说明会显著影响科学结论的假设。
6. 通过 wrapper 调用，并保留 `transport` 与 native 结果。只有进程退出码和所有响应信封均成功时，才算调用成功。
7. 单个已命名化合物的基础查询只调用一次 PubChem `compound-summary`；成功后直接完成，不得重放。
8. 多个已命名化合物的性质与结构相似度比较，默认只做两个 Science 调用：
   - PubChem `compound-batch-summary`
   - RDKit `similarity-matrix`

   不得额外调用 health、parse、descriptors、fingerprint、substructure 或 render，除非用户明确需要这些不同输出。

   PubChem 默认请求体必须严格为：

   ```json
   {"identifiers":["aspirin","caffeine"],"namespace":"name"}
   ```

   不要添加 `properties`、`synonym_limit` 或 `CID`。默认响应已经包含基础字段，不支持的属性会导致响应校验失败。记录位于 `native["results"]`；用每条记录的 `input` 保留原始标签，并从嵌套的 `properties` 读取属性。

   两个服务应在各自规定的单个 `python_repl` 中完成。不得打印原始 stdout、stderr、完整信封或完整 native 对象。RDKit 请求使用：

   ```json
   {
     "molecules": [{"id":"aspirin","smiles":"..."}],
     "fingerprint": {"type":"morgan","radius":2,"n_bits":2048},
     "sanitize": true
   }
   ```

   `similarity-matrix` 的 `native["ranked_pairs"]` 每项固定为
   `{"a": <输入 id>, "b": <输入 id>, "similarity": <数值>}`，不是矩阵下标。
   禁止读取 `i`、`j` 或 `score`。找某个目标分子的最近邻时，只筛选 `a` 或
   `b` 等于该目标的记录，取最大 `similarity` 并返回另一侧 id。

9. 下游调用只能使用上一步已验证的 native 输出。禁止伪造 CIF、SMILES、粉末衍射数据、历史实验或优化观测。
   对无机材料化学式、组成或式量，首选 pymatgen `composition-parse`；不要把
   PubChem 的 `not_found`/404 改写为 CID、名称或式量，也不要用本地元素周期表补算。
10. 跨服务比较时保留数据来源。例如 PubChem `XLogP` 与 RDKit `MolLogP` 使用不同模型，不得相互覆盖。
11. 大型或二进制产物只能从文档明确的 native 字段解码。PNG 必须验证文件头为 PNG magic bytes，不能把以 `{` 开头的 JSON 保存成图片。
12. 先报告科学结果，再列出使用的服务与 CLI 调用链证据。失败和被阻塞的后续步骤必须明确说明。
13. 当前调用的 `native` 响应是 Skill 和 Memento 最终答案的完整证据边界。禁止补充当前结果未返回的记忆知识、机制推测、临床结论、单位、引用或链接。若规划要求了服务不支持的字段，写明“当前 Science 工具未返回该字段”，然后停止补充。

14. 反应优化必须由 SynBO 或 Delta-BO 的当前 CLI `recommendations` 支持。若
    `optimize` 返回数组维度错误、超时、空 recommendations 或失败，写入有界错误
    交接并报告“未产生推荐”；禁止改用本地 GP、UCB、响应面、随机采样或人工排序。
15. AntBO 启动属于远端变更。只有当前 native 同时返回 `started=true`、`pid` 与
    `log_name` 或 `log_path` 时，才能声称作业已启动；将这些字段写入
    `@ROOT/antbo_submission.json` 后由主代理读取。字段缺失时不得编造或重复提交。
16. LAMMPS 最终答复只读取本次 `@ROOT/lammps_result.json`。逐字保留
    `final_step`、`final_temperature`、`final_total_energy` 和 `last_thermo`；
    禁止将总能量除以原子数、替换步数、换算单位或推测物理收敛性。
17. 如果请求的 operation 不在当前 CLI catalog 中，不调用工具、不探测路径、不直连
    HTTP，直接说明该 operation 尚未暴露且“未发送远端请求”。AntBO 当前支持
    `health/run-default-job/run/log/jobs/stop`；`ldm/suggest` 不可由 Skill 补齐，
    也不得改用小分子 LDM-BO。

每次 Skill 回答结尾都保留以下中文交接信息：

```text
证据边界：仅限当前 Delta CLI native 结果
调用链：delta-cli
禁止补充未返回内容：是
```

## 服务选择

| 用户需求 | 服务 |
| --- | --- |
| 化合物身份、CID、名称、同义词和公共属性 | PubChem |
| SMILES 校验、描述符、渲染、相似度和 SMARTS | RDKit |
| 化学式、组成、CIF/POSCAR、晶体结构和对称性 | pymatgen |
| 粉末衍射模拟或精修 | GSAS-II |
| 有界分子动力学或能量最小化 | LAMMPS |
| 通用实验参数优化 | Delta-BO |
| 分子 next-SMILES 推荐或 BO 轨迹 | LDM-BO |
| 分类反应条件初始化或优化 | SynBO |
| 抗体优化作业 | AntBO |

## 安全与重试

- AntBO 启动/停止、Delta-BO 有状态命令和结果不明确的长任务属于远端变更。没有用户明确授权时不得执行或重试。
- health、查询、解析、描述符和 dry-run 属于只读操作。
- 参数校验错误不要重试；只读请求遇到临时网络错误最多重试一次；超时的变更操作绝不自动重试。
- 重型服务串行运行。客户端超时不代表远端计算已取消。
- 已经取得所需信息后，不要探测未记录的枚举值或替代参数。参数实验属于独立回归任务，不属于普通用户请求。
- SynBO `optimize` 当前存在已知的后端数组维度问题，常规回归中跳过；只有用户明确要求时才测试。

## 完成标准

只有同时满足以下条件，任务才算完成：

- 每个声称的科学数值都来自当前运行；
- 每个在线操作都有 `transport="delta-cli"` 的 wrapper 证据；
- 依赖调用使用了真实的上游 native 输出；
- 失败被归类为 CLI/配置、Science Server、公司后端、参数校验或超时；
- 没有使用直接 HTTP 或本地科学库替代。
