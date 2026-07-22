# 跨服务工作流

## 单个已命名分子

1. 用 PubChem `compound-summary` 解析名称并取得身份字段。
2. 按文档规定的回退顺序提取 SMILES。
3. 只有用户要求 RDKit 描述符或明确的结构校验时，才调用 RDKit `batch-parse-describe`。
4. 只有用户明确要求图片时，才调用 RDKit `render`，并解码、验证图片字节。
5. 比较分子式、分子量、InChIKey 和供体/受体数量时，要明确区分 LogP、TPSA 等依赖模型的数值。

## 多分子比较

1. 用 PubChem 批量解析全部名称，请求体只包含 `identifiers` 和 `namespace:"name"`。省略 `properties`。
2. 从 `native.results[*]` 读取记录，并从每条记录的嵌套 `properties` 读取字段。
3. 未解析成功的记录要排除，并明确说明原因。
4. 使用 RDKit `similarity-matrix` 校验和排序两两相似度。它的 `sanitize` 已经校验输入，不要额外调用 parse。
5. 用 PubChem 记录的原始 `input` 作为 molecule id，并按文档顺序从嵌套属性中提取 SMILES。
6. 保持输入顺序，报告每个分数时明确对应的分子对。
7. 除非用户明确要求，不要渲染、保存用户文件、检查健康状态或探测额外描述符。

## 材料工作流

1. 使用 pymatgen 校验化学式/结构并转换 CIF。
2. GSAS-II 只能接收真实 CIF 文本后再做衍射计算。
3. LAMMPS 只能在已有明确的力场、data 和脚本设置后运行；部署检查可以使用内置有界示例。
4. 从 LAMMPS 返回 pymatgen 或 GSAS-II 前，需要从弛豫结果重新构造 CIF/POSCAR。不要直接传递 LAMMPS data/dump 文件。

## 优化工作流

- 通用数值或分类实验变量：Delta-BO
- 以分子结构为决策变量：LDM-BO
- 带真实历史结果的分类反应条件：SynBO

禁止为了让优化器运行而编造观测数据。用户没有提供测量结果时，只能使用初始化或随机建议模式，并明确说明它是待实验验证的建议，不是已经验证的最优条件。
