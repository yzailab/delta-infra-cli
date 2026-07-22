# PubChem operation 契约

先使用 `SKILL.md` 的唯一 wrapper 模板。下面每行都是对应 operation 的最小设置；
wrapper 成功后的业务结果均为 `r["native"]`，不是 `native.data`。执行一次后调用
`step_finish`，不得重复调用。

## health

- 情景：用户明确询问 PubChem 服务是否可用。
- 代码：`endpoint="health"; data=None; params=None`
- 投影：只保留 `status`、可用性、metadata、limits、warnings 中实际存在的字段。

## compound-resolve-cids

- 情景：把名称、SMILES、InChI 等标识符解析为 CID 列表。
- 代码：`endpoint="compound-resolve-cids"; data={"identifier":"aspirin","namespace":"name","max_records":20}; params=None`
- 投影：输入标签、有效性、CID 列表和错误。

## compound-properties

- 情景：已有标识符，只要求指定 PubChem 属性。
- 代码：`endpoint="compound-properties"; data={"identifier":"aspirin","namespace":"name","properties":["MolecularFormula","MolecularWeight"]}; params=None`
- 投影：只复制本次返回的 CID、请求属性、aliases、valid/error。

## compound-synonyms

- 情景：查询一个化合物的同义词。
- 代码：`endpoint="compound-synonyms"; data={"identifier":"aspirin","namespace":"name","max_synonyms":5}; params=None`
- 投影：CID、有效性和最多用户要求数量的 synonyms。

## compound-summary

- 情景：一个已命名分子的 CID、SMILES、分子式、分子量等基础属性。
- 代码：`endpoint="compound-summary"; data={"identifier":"aspirin","namespace":"name"}; params=None`
- 投影：`native.valid`、`native.cid` 与 `native.properties` 中用户要求的键。

## compound-batch-summary

- 情景：一次解析两个或更多名称，供后续比较或 RDKit 使用。
- 代码：`endpoint="compound-batch-summary"; data={"identifiers":["aspirin","caffeine"],"namespace":"name"}; params=None`
- 投影：`native.results[*]` 的 `input`、valid/error 及嵌套 `properties`；不得加 `properties` 或 `synonym_limit` 请求字段。
