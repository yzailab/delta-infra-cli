# RDKit operation 契约

所有示例都在 `SKILL.md` 的 wrapper 模板中设置 `endpoint` 和 `payload`。业务结果直接
位于 `r["native"]`。只做用户请求所需的一次调用，成功后调用 `step_finish`。

## health

- 情景：明确检查 RDKit 服务状态。
- 代码：`endpoint="health"; payload=None`，调用时省略 `--data-json`。
- 投影：status、可用性、metadata、limits、warnings 中存在的字段。

## parse

- 情景：只校验并规范化一个 SMILES/InChI。
- 代码：`endpoint="parse"; payload={"input":"CCO","format":"smiles"}`
- 投影：valid、canonical_smiles、formula、inchi_key、warnings/error。

## descriptors

- 情景：只计算一个已知 SMILES 的描述符。
- 代码：`endpoint="descriptors"; payload={"smiles":"CCO","descriptor_set":"basic","sanitize":True}`
- 投影：valid 与 descriptors 中实际返回的键。

## batch-descriptors

- 情景：对多个已知且无需再次解析的 SMILES 计算同一组描述符。
- 代码：`endpoint="batch-descriptors"; payload={"smiles":["CCO","c1ccccc1"],"descriptor_set":"basic","sanitize":True}`
- 投影：results 中每项的输入 SMILES、valid、descriptors、warnings/error。

## batch-parse-describe

- 情景：同时校验、规范化并计算一个或多个分子的描述符。
- 代码：`endpoint="batch-parse-describe"; payload={"molecules":[{"id":"aspirin","smiles":"CC(=O)OC1=CC=CC=C1C(=O)O"}],"descriptor_set":"basic","sanitize":True}`
- 投影：results 中 id、valid、canonical_smiles、descriptors、warnings/error。

## render

- 情景：用户明确要求分子结构图。
- 代码：`endpoint="render"; payload={"smiles":"CCO","image_format":"png","width":500,"height":400}`
- 投影：只解码文档指定的 base64 字段；验证 PNG magic bytes 后再保存。

## fingerprint

- 情景：明确要求一个分子的 Morgan 指纹。
- 代码：`endpoint="fingerprint"; payload={"smiles":"CCO","radius":2,"n_bits":2048}`
- 投影：valid、fingerprint_metadata、on_bits、warnings/error。

## similarity

- 情景：比较两个已知 SMILES。
- 代码：`endpoint="similarity"; payload={"query_smiles":"CCO","target_smiles":"CCN","radius":2,"n_bits":2048}`
- 投影：native 实际返回的 similarity、metric、fingerprint metadata。

## similarity-matrix

- 情景：比较三个及以上分子的所有两两相似度。
- 代码：`endpoint="similarity-matrix"; payload={"molecules":[{"id":"a","smiles":"CCO"},{"id":"b","smiles":"CCN"}],"fingerprint":{"type":"morgan","radius":2,"n_bits":2048},"sanitize":True}`
- 投影：matrix 与 `ranked_pairs[{a,b,similarity}]`；禁止 i/j/score。

## substructure

- 情景：用 SMARTS 在一个或多个目标 SMILES 中筛选子结构。
- 代码：`endpoint="substructure"; payload={"query_smarts":"C(=O)O","target_smiles":["CC(=O)O","CCO"],"sanitize":True}`
- 投影：query、每个目标的 valid/match/matches 与 warnings/error。
