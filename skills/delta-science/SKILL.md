---
name: delta-science
description: "用于所有涉及化合物、材料、衍射、分子动力学、贝叶斯优化、反应条件或抗体优化的 Science 任务，包括简短、模糊的人类请求。所有在线操作必须通过 Delta CLI。对于多个已命名分子的性质与结构比较，规划三个 Memento 步骤：PubChem 用一次批量调用写入 @ROOT/compounds_basic.json；RDKit 用一次 similarity-matrix 调用写入 @ROOT/science_comparison_result.json；主代理随后直接用 read_file 读取并回答。RDKit 返回产物后立即完成该步骤。主代理不得再次运行 python_repl、探测路径、查找可执行文件、重复调用 Science、分派 filesystem Skill，或补充交接结果中没有的阈值结论、结构原因和来源链接。"
---

# Delta Science

把普通的人类科学任务转换为一个或多个经过验证的 Delta CLI 调用。用户只需描述科学目标；本 Skill 负责选择工具和 operation、构造参数、执行、校验并简洁报告结果。

## 强制调用链

- 每个在线 Science 操作都必须通过 `delta-cli science invoke` 执行。
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

每次调用只替换 tool、endpoint 和 payload。只有 references 明确说明是查询参数时才使用 `--params-json`，否则使用 `--data-json`。必须满足 `result["ok"] is True` 且 `result["transport"] == "delta-cli"`，之后只使用 `result["native"]`。

第一次在线调用前读取 [references/cli-contract.md](references/cli-contract.md)。构造参数前，只读取 [references/services.md](references/services.md) 中被选服务的部分。多服务任务还要读取 [references/workflows.md](references/workflows.md)。

## 执行流程

1. 在内部重述科学目标；不要向用户追问本 Skill 已经定义的实现细节。
2. 选择能完成任务的最窄服务，并严格保持用户请求范围。推断 operation 或参数不代表可以增加用户没有要求的图片、文件、健康检查、描述符探测、分析或交付物。
3. 如果 Memento 仅为跨步骤传递已验证数据而要求文件，可以在完成在线调用的同一个 `python_repl` 中写一个有界的内部 JSON。不得为生成或检查交接文件而重复业务调用，也不要把内部交接文件描述成用户要求的产物。
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

9. 下游调用只能使用上一步已验证的 native 输出。禁止伪造 CIF、SMILES、粉末衍射数据、历史实验或优化观测。
10. 跨服务比较时保留数据来源。例如 PubChem `XLogP` 与 RDKit `MolLogP` 使用不同模型，不得相互覆盖。
11. 大型或二进制产物只能从文档明确的 native 字段解码。PNG 必须验证文件头为 PNG magic bytes，不能把以 `{` 开头的 JSON 保存成图片。
12. 先报告科学结果，再列出使用的服务与 CLI 调用链证据。失败和被阻塞的后续步骤必须明确说明。
13. 当前调用的 `native` 响应是 Skill 和 Memento 最终答案的完整证据边界。禁止补充当前结果未返回的记忆知识、机制推测、临床结论、单位、引用或链接。若规划要求了服务不支持的字段，写明“当前 Science 工具未返回该字段”，然后停止补充。

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
