# 服务与参数参考

只读取当前所选服务对应的部分。下文中的 endpoint 是 Delta CLI catalog 名称，不是 URL 路径。

## PubChem

Tool：`pubchem`。

- 普通名称查询：`compound-summary`，data 为 `{"identifier":"caffeine","namespace":"name"}`。
- 批量查询：`compound-batch-summary`。模糊的多分子比较必须严格使用 `{"identifiers":["aspirin","caffeine"],"namespace":"name"}`。
- 批量查询不要添加 `properties` 或 `synonym_limit`，尤其不能把 `CID` 放进 `properties`。
- 其他 operation：`compound-resolve-cids`、`compound-properties`、`compound-synonyms`。

模糊问题优先使用 summary。按 `CanonicalSMILES`、`ConnectivitySMILES`、`SMILES`、`IsomericSMILES` 的顺序提取 SMILES。PubChem 返回的 `MolecularWeight`、`XLogP` 和 `TPSA` 必须保留为 PubChem 数据。

批量 native 输出为 `{"results":[...]}`。每条记录用 `input` 保存原始标签，化合物字段位于嵌套的 `properties`；记录不是平铺结构，集合键也不是 `compounds`。

## RDKit

Tool：`rdkit`。

- `parse`：`{"input":"CCO","format":"smiles"}`
- `descriptors`：`{"smiles":"CCO","descriptor_set":"basic","sanitize":true}`
- `batch-parse-describe`：`{"molecules":[{"id":"ethanol","smiles":"CCO"}],"descriptor_set":"basic","sanitize":true}`
- `render`：`{"smiles":"CCO","image_format":"png","width":500,"height":400}`
- `similarity`：使用 `query_smiles` 和 `target_smiles`
- `similarity-matrix`：使用 `molecules:[{id,smiles}]`
- `substructure`：使用 `query_smarts` 和 `target_smiles`

`batch-parse-describe` 使用 `molecules`，不能用 `inputs`；分子字段使用 `smiles`，不能用 `input`。fingerprint 选项是对象，不是布尔值。PubChem `XLogP` 与 RDKit `MolLogP` 使用不同模型。

## pymatgen

Tool：`pymatgen`。

- 化学式：`composition-parse`，data 为 `{"formula":"LiFePO4","format":"formula"}`
- 结构 operation：`structure-parse`、`structure-summary`、`structure-convert`、`structure-symmetry`

结构调用必须发送完整结构文本，不能发送本地文件路径。支持 CIF、POSCAR、JSON、CSSR 和 XSF。不要把 LAMMPS data/dump 文件交给 pymatgen。

## GSAS-II

Tool：`gsasii`；operation 为 `powder-simulate` 和 `powder-refine`。

模拟需要完整 `cif` 文本。字段必须使用 `phase_name`、`include_profile`、`include_reflections`、`t_min`、`t_max` 和 `t_step`。

精修需要真实的 `powder_data`、`instrument_parameters` 和 `phases:[{name,cif}]`。依赖模拟结果时，只能从成功调用的 native `profile[*].x` 和 `profile[*].y_calc` 构造粉末数据。

## LAMMPS

Tool：`lammps`。

- 只读有界示例：`lj-melt-example`，无参数
- 执行：`run`，参数必须是示例返回的精确 native `request`，或用户明确授权的 `input_script`/files

绝不能把 CLI 外层信封传给 `run`，只能传 `native["request"]`。LAMMPS 不会自动推断力场。交互式运行必须保持有界。

## Delta-BO

Tool：`delta-bo`。

- 命令目录：`commands`，无参数
- 无状态建议：`generate`，例如 `{"params":[{"name":"x","type":"numeric","low":0,"high":1}],"num_suggestions":2,"algorithm":"random-search","seed":42}`

观测少于五条时，除非用户明确要求 BO，否则优先使用 `random-search`。有状态 native session 命令属于变更操作，不能盲目重试。

## LDM-BO

Tool：`ldm-bo`；operation 为 `recommend` 和 `trajectory`。

有界测试使用 `bo-tanimoto`。`recommend` 接受 `method`、`pool`、`history:[{smiles,scores}]` 和 `batch_size`。`trajectory` 必须保留 native 连字符字段：`seed-smiles`、`num-evaluations` 和 `batch-size`。

## SynBO

Tool：`synbo`；operation 为 `initialize` 和 `optimize`。

二者都使用 `condition_dict`、`opt_metrics` 和 `batch_size`。`optimize` 还要求数值型 `previous_results`，且每条记录必须包含全部条件和指标。有界 CPU 测试使用 `accuracy:"tiny"` 和 `device:"cpu"`，并串行执行。

常规回归可以测试 `initialize`。在已知后端数组维度问题修复前跳过 `optimize`，除非用户明确要求。

## AntBO

Tool：`antbo`。

部署 catalog 中存在时，`health` 是只读调用。`run-default-job` 会改变远端状态，`log_name`、`append` 和 `timeout_seconds` 必须通过 `--params-json` 传递，不能作为 request data。没有用户明确授权时，不得启动、停止或重试作业；必须保留返回的 PID 和日志名称。
