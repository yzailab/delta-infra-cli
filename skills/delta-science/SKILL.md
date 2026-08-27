---
name: delta-science
description: "公司在线 Science 能力的统一入口，所有调用都经 Delta CLI。凡是查询具体化合物/CID/SMILES/分子性质、批量 PubChem 与 RDKit 分子增强、计算分子描述符或相似度、解析晶体/CIF/空间群、材料表格建模与候选推荐、Quantum ESPRESSO/QE DFT、模拟或精修 XRD、执行 LAMMPS、根据实验数据做贝叶斯优化、反应条件优化，以及任何 LDM/大发现模型、KRAS G12D 小分子生成优化、固定候选池/PDF2Dock 轨迹或抗体 CDRH3 优化任务，都必须使用本 Skill；不得调用旧 large-discovery-model Skill、旧 gateway 脚本、网页搜索或本地科学库绕过 Delta CLI。普通查询、比较或校验默认直接返回文本，不要主动增加 JSON/CSV、报告、图片或图表步骤；只有用户明确要求保存、导出、绘图或生成文件时才创建产物。"
metadata:
  requires:
    bins: ["delta-cli"]
  cliHelp: "delta-cli science --help"
---

# Delta Science

把自然语言科研任务转换为最少数量、可验证的 Delta CLI Science 调用。只暴露本
Skill；工具选择、operation、参数、跨工具交接和结果校验都在本 Skill 内完成。

## 服务调用边界

- 所有在线 Science 操作最终都经
  `delta-cli science invoke -> Science Server`。
- 使用 CLI 的标准认证与 `base_url` 派生出的 Science 服务地址（`{base_url}/science_tool`）。
  不得通过环境变量、命令参数或业务 URL 改写服务路由。
- 禁止使用 `curl`、`requests`、`httpx`、浏览器和 PowerShell Web 命令直接访问公司网关或
  业务服务 URL。
- 不得将本地 RDKit、pymatgen、LAMMPS、BO、回归或 sandbox 结果冒充为 Science 结果。
  本地工具可用于格式转换、文件解析或展示，但必须明确其来源，并与 CLI 结果分开。
- 执行前读取对应 reference，并按其选择 operation 和请求字段；reference 缺失、过期或与
  当前目录不一致时，可查询实时目录。禁止凭记忆创造字段或枚举值。
- `tools.name` 和 `tool_endpoints.name` 是唯一权威调用名称。传给 CLI 的 tool 和
  endpoint 必须与当前数据库目录完全一致；CLI 不做别名映射、前缀裁剪、
  profile 判断或 `not_found` 后改名重试。reference 与目录不一致时终止并报告配置问题。
- 只有 CLI 子进程退出码为 0 且输出 JSON 顶层 `ok` 为 `true` 时，才能报告调用成功。
  CLI 顶层 `data` 保存服务响应；仅按对应 reference 说明的信封和业务结构读取字段，
  不得递归搜索看似合理的值，也不得把 `valid:false` 等业务结果误报为传输失败。

调用模板：

```text
delta-cli science invoke --tool TOOL --endpoint ENDPOINT --data JSON
```

仅当 reference 明确将字段定义为查询参数时使用 `--params JSON`。不要将 JSON 拼接为命令
代码；使用调用环境的安全参数传递机制传入单个 JSON 参数。

Materials Design 的训练表 multipart 上传、QE 的原始 artifact 上传和要求自定义
`Idempotency-Key` 的请求，只有在 Science Server 已提供明确的 JSON/query adapter 时才能
通过本 CLI 使用。不要把本地路径、base64 或请求头伪装成普通 `--data` 字段；若目录没有
这样的 adapter，按“未暴露、未发送远端请求”处理，不要直连 preflight Gateway。

只调用完成目标所需的 operation。跨工具任务在同一个 Skill 执行中按依赖顺序调用，
下游只能使用上一步已验证的业务字段。已知工具默认不要额外调用 health、schema、
catalog、render、descriptors 或文件操作；用户请求、诊断需要或 reference 与实时目录不一致时，
可执行最少的只读调用。

## 选择工具

| 科研目标 | tool | 详细规则 |
| --- | --- | --- |
| 化合物身份、CID、同义词、公共属性、名称转 SMILES | `pubchem` | [pubchem.md](references/pubchem.md) |
| SMILES/InChI、描述符、指纹、相似度、渲染、子结构 | `rdkit` | [rdkit.md](references/rdkit.md) |
| 无机化学式、CIF/POSCAR、晶体结构、空间群 | `pymatgen` | [pymatgen.md](references/pymatgen.md) |
| 粉末衍射模拟、Rietveld 精修 | `gsasii` | [gsasii.md](references/gsasii.md) |
| 分子动力学、最小化、thermo 与输出文件 | `lammps` | [lammps.md](references/lammps.md) |
| 通用数值/整数/分类实验变量优化 | `delta-bo` | [delta-bo.md](references/delta-bo.md) |
| 表格材料 surrogate、候选空间、EI/PI/UCB 与异步推荐作业 | `materials-design` | [materials-design.md](references/materials-design.md) |
| Quantum ESPRESSO/QE 的 PP、异步 DFT 作业、日志与 artifact | `qe` | [qe.md](references/qe.md) |
| 固定候选池 next-SMILES、PDF2Dock、分子 BO 轨迹 | `ldm-bo` | [ldm-bo.md](references/ldm-bo.md) |
| KRAS G12D 小分子生成、vina/activity 多目标迭代 | `strbo` | [strbo.md](references/strbo.md) |
| 反应条件初始化、基于真实得率推荐下一批实验 | `synbo` | [synbo.md](references/synbo.md) |
| 抗体 CDRH3 生成/评估及 AntBO 作业管理 | `antbo` | [antbo.md](references/antbo.md) |

用户使用 “LDM”“大发现模型”“小分子药 LDM” 或 “抗体 LDM” 表述完整科研流程时，
先根据任务目标选择真实后端工具，再只读取所选后端对应的 reference；`ldm-bo` 是可调用的
工具，`LDM` 本身不是 `--tool` 参数。若用户说“批量分子增强”或类似需求，应拆成真实
工具调用：先用 `pubchem` 做名称/标识解析，再用 `rdkit` 做结构标准化或分子计算。

工具明确时直接读取所选 tool 的 reference，其中已经包含 operation、参数和最小场景；
不要读取其他工具文档。跨工具任务由本 Skill 的路由规则拆分，并只读取实际参与任务的
工具 reference；不要依赖单独的路由、服务、工作流或目录文档。

本表只列出已经维护真实工具 reference 的科研工具，不是静态服务端清单。若用户点名本表之外的新工具，或 reference
缺失、过期或与 CLI 返回不一致，允许运行 `delta-cli science list`，再使用目录返回的精确 tool name 运行一次
`delta-cli science endpoints list <tool>`；两次输出都必须满足退出码为 0 且顶层
`ok:true`。不得用空 body、错误参数、源码或直接 HTTP 探测。实时 endpoint
元数据若没有足够的请求字段契约，应说明“目录已发现，
但服务端未提供可安全构造请求的 schema”，不得猜 body、模糊匹配或转换名称。新增工具
因此无需修改 CLI；只有确认它是独立真实工具并需要自然语言自动选路或自动组装参数时，才补充对应的单工具 reference。

## 路由边界

- 普通分子名称先用 PubChem；只有需要结构计算时才把成功返回的 SMILES 交给 RDKit。
- 无机化学式、组成和式量优先 pymatgen，不用 PubChem 或本地元素表补算。
- 表格材料建模与候选排序使用 Materials Design；必须区分可控变量、目标、候选空间、
  交叉验证和不确定性，推荐结果只是待验证假设。
- 需要显式电子结构计算时使用 QE；先处理元素全集、PP policy/lock 和结构 artifact，
  再提交异步 workflow，不把作业接收、scheduler 完成或 solver 收敛混为一谈。
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
- 参数校验、空 recommendations 和业务后端失败均按本次失败结束。对 `health`、目录和其他
  明确只读、幂等的 operation，网络类 502、504 或 timeout 可按相同参数最多重试一次。
  SynBO 每个用户任务最多一次业务调用；不得换模型、换 acquisition 或改用本地算法。
- CLI 首次返回失败后应返回原始错误短摘要。用户明确要求排障时，可运行只读的
  `delta-cli auth status`、`delta-cli config show` 或 `delta-cli ... --help`；不得自行登录、
  修改配置或环境变量、伪造 UID、令牌或 API Key，也不得改变 operation、参数或调用链重试。
- `X-User-Uid`、登录、quota 或 permission 错误属于终止性认证错误；只转发原始错误和
  登录提示。Skill 绝不自行登录、检查凭据、猜测用户标识或尝试绕过 quota。
- 重型调用串行执行。客户端超时不代表远端计算已取消。
- 用户未要求文件时不创建 CSV、图片或报告。内部交接文件只能写入当前
  `WORKSPACE_ROOT`，不得读取其他会话 workspace 或历史结果补全当前任务。
- 外层规划器自动附加的路径、JSON、图表或报告不等同于用户明确要求。若任务本质只是
  查询、比较或校验，直接返回最小文本结果；不得为了满足附加产物而重复 Science 调用。
- 二进制产物只解码文档明确的字段；PNG 必须验证 magic bytes。
- 用户明确要求公开背景资料或文献时，可进行网页检索，但不得将其作为 Science 服务调用或
  用其替代 CLI 结果；分别标明来源。

## 输出

将当前 CLI `data` 中、由对应 reference 定义的业务响应投影为用户要求的最小结果；逐字保留字符串、数值、警告和来源。
不得补充服务未返回的单位、机制、引用、链接、预测值或记忆知识。预测结果不得
描述为实测结果。
成功取得最后一个所需业务结果后，直接将其投影为最终答复。禁止为了排序、排版、生成
表格或摘要再次执行 CLI，也禁止把结果手工复制成新的数据字面量；简单
筛选、比较和文本组织直接在最终答复中完成。

成功时只返回由当前 CLI 业务结果生成的有界纯文本；失败时只返回 CLI 原始错误短摘要。
完成后不得重新计算、改写或用手工建议替代成功/失败的 Science 结果。

每次成功结果保留：

```text
证据边界：仅限当前 Delta CLI `data` 中的业务结果
调用链：delta-cli
禁止补充未返回内容：是
```

## 完成标准

- 每个在线操作都有 CLI 退出码为 0 且顶层 `ok:true` 的证据；
- 每个科学数值来自当前调用 `data` 中、由 reference 定义的业务字段；
- 下游输入来自当前任务中已验证的上游结果；
- 失败准确归类为配置、CLI、参数、Science Server、业务服务或超时；
- 没有直接 HTTP、本地科学库、跨会话文件或人工结果替代。
