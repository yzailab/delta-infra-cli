# 跨服务工作流

整个流程由单一 `delta-science` Skill 编排。线上调用通过宿主可用的 shell/Python 直接执行
`delta-cli science invoke`，禁止直接 HTTP。可使用 subagent 协助整理输入、核对 reference 或
展示结果，但主流程负责工具选择和所有线上调用。CLI 成功后每一步只消费对应 reference 定义的
`data` 响应字段。已知 reference 中没有目标 operation 时，不猜测相近 endpoint；reference
缺失、过期或与 CLI 返回不一致时，按 `SKILL.md` 的只读实时 catalog 流程确认。

## 单个已命名分子

1. 用 PubChem `compound-summary` 解析名称并取得身份字段。
2. 按文档规定的回退顺序提取 SMILES。
3. 只有用户要求 RDKit 描述符或明确的结构校验时，才调用 RDKit `batch-parse-describe`。
4. 只有用户明确要求图片时，才调用 RDKit `render`，并解码、验证图片字节。
5. 比较分子式、分子量、InChIKey 和供体/受体数量时，要明确区分 LogP、TPSA 等依赖模型的数值。

## 多分子比较

1. 用 PubChem 批量解析全部名称，请求体只包含 `identifiers` 和 `namespace:"name"`。省略 `properties`。
2. 从业务响应的 `results[*]` 读取记录，并从每条记录的嵌套 `properties` 读取字段。
3. 未解析成功的记录要排除，并明确说明原因。
4. 使用 RDKit `similarity-matrix` 校验和排序两两相似度。它的 `sanitize` 已经校验输入，不要额外调用 parse。
5. 用 PubChem 记录的原始 `input` 作为 molecule id，并按文档顺序从嵌套属性中提取 SMILES。
6. 保持输入顺序，报告每个分数时明确对应的分子对。
7. 除非用户明确要求，不要渲染、保存用户文件、检查健康状态或探测额外描述符。
8. `ranked_pairs` 使用命名字段 `a`、`b`、`similarity`。找指定目标的最近邻时，
   在包含该目标的记录中取最大 `similarity`，另一侧字段就是最近邻；不要使用
   `i`、`j`、`score` 或猜测矩阵下标。

## 材料工作流

1. 使用 pymatgen 校验化学式/结构并转换 CIF；无机式量只能取当前业务响应 `weight`。
2. GSAS-II 只能接收真实 CIF 文本后再做衍射计算。
3. LAMMPS 只能在已有明确的力场、data 和脚本设置后运行；部署检查可以使用内置有界示例。
4. 从 LAMMPS 返回 pymatgen 或 GSAS-II 前，需要从弛豫结果重新构造 CIF/POSCAR。不要直接传递 LAMMPS data/dump 文件。

## 优化工作流

- 通用数值或分类实验变量：Delta-BO
- 固定 SMILES 候选池或 PDF2Dock/Vina+NN 轨迹：LDM-BO
- 固定 KRAS G12D 的生成式小分子闭环：STRBO
- 指定抗原的 11-aa CDRH3 闭环：AntBO
- 偶联反应、反应条件和带真实历史得率的下一批实验推荐：SynBO

用户以 “LDM/大发现模型” 描述任务时，必须先按 `SKILL.md` 读取 `ldm.md`，再读取唯一
选定后端的 reference。LDM 是工作流意图，不是 tool；禁止旧
`large-discovery-model`、`run_ldm_loop.py`、gateway backend 和直接 HTTP。

禁止为了让优化器运行而编造观测数据。用户没有提供测量结果时，只能使用初始化或随机建议模式，并明确说明它是待实验验证的建议，不是已经验证的最优条件。
SynBO/Delta-BO 没有返回 recommendations 时，不得用本地回归、GP、UCB 或人工排序替代。

SynBO 只接受离散条件列表。用户给连续范围时，在一次调用前完成以下处理：

1. 条件网格包含用户上下界、全部历史观测值和少量合理中间点。
2. 同一条件列在 `condition_dict` 与 `previous_results` 中统一为字符串。
3. 得率等 objective metric 保持数值。
4. 小数据 CPU 默认 `tiny + RF + UCB`，并在最终答案中报告实际离散网格。
5. CLI 返回失败或业务响应为空 recommendations 时结束；不得连续尝试多种 payload 或模型。

用户未要求文件时只返回 recommendations 文本，不创建输入 CSV。必须交接时，仅把本次
成功业务响应写入当前 `WORKSPACE_ROOT/synbo_result.json`。
