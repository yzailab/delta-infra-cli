# Delta Science 路由索引

本文件只描述稳定的科研意图边界，不复制 Science Server 的工具和 endpoint 清单。
实际可用工具以 `delta-cli science list` 和 `delta-cli science endpoints list` 返回的
实时目录为准。

## 路由优先级

- 普通化合物名称、CID 和公共属性使用 PubChem；已有 SMILES/InChI 且需要结构计算时
  使用 RDKit。
- 用户明确要求一次得到名称解析、PubChem 字段和 RDKit 描述符/指纹时，使用
  `chemistry` 的 molecule-enrich workflow；不要为同一需求重复调用中间服务。
- 无机化学式、组成、CIF、POSCAR 和空间群使用 pymatgen；粉末衍射模拟或 Rietveld
  精修使用 GSAS-II。
- 表格材料数据、可控变量/目标、候选空间、 surrogate 验证和候选排序使用
  Materials Design；不要把候选预测说成实验结果。
- 需要 Quantum ESPRESSO 电子结构计算时使用 QE；先解析 workflow 与整组元素的 PP
  policy/lock，再按异步 job 生命周期处理 execution、solver 和 scientific 状态。
- 明确的 LAMMPS input、data 和力场任务使用 LAMMPS；不得从化学式或 CIF 猜测势函数。
- 通用数值、整数或分类实验变量优化使用 Delta-BO。
- 固定 SMILES 候选池或 PDF2Dock 轨迹使用 LDM-BO；固定 KRAS G12D 生成式优化使用
  STRBO；反应条件与真实历史得率使用 SynBO；抗体 CDRH3 使用 AntBO。
- “LDM/大发现模型”是跨上述三类能力的工作流意图，先读取 `ldm.md` 决定唯一后端，
  不是服务端 tool，也不得路由到旧 `large-discovery-model` Skill。

## 已验证 reference

- [pubchem.md](pubchem.md)
- [rdkit.md](rdkit.md)
- [molecule-enrich.md](molecule-enrich.md)
- [pymatgen.md](pymatgen.md)
- [gsasii.md](gsasii.md)
- [lammps.md](lammps.md)
- [delta-bo.md](delta-bo.md)
- [materials-design.md](materials-design.md)
- [qe-dft.md](qe-dft.md)
- [ldm-bo.md](ldm-bo.md)
- [ldm.md](ldm.md)
- [strbo.md](strbo.md)
- [synbo.md](synbo.md)
- [antbo.md](antbo.md)

以上 reference 是已验证参数契约，不是服务端完整目录。用户明确点名新工具时，按
`SKILL.md` 的实时 catalog 流程发现工具和 endpoint；若目录未返回请求 schema，不猜测
请求体。
