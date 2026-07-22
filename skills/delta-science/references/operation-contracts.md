# Delta Science operation 最小契约

本文只记录当前 CLI catalog 已暴露的 9 个 tools、42 个 operations。选择 operation 后
只读取对应小节。代码示例均在同一个 `python_repl` 中先定义以下函数；禁止 Bash、
目录探测、直接 HTTP 和字面 CLI 命令。

调用 `python_repl` 时工具参数必须严格为 `{"code":"..."}`；禁止添加 `deps`、
`dependencies`、`packages` 或任何其他字段。

```python
import json, os, subprocess, sys

wrapper = os.path.join(os.environ["SKILLS_ROOT"], "delta-science", "scripts", "invoke.py")

def invoke(tool, endpoint, data=None, params=None):
    argv = [sys.executable, wrapper, "--tool", tool, "--endpoint", endpoint]
    if data is not None:
        argv += ["--data-json", json.dumps(data)]
    if params is not None:
        argv += ["--params-json", json.dumps(params)]
    p = subprocess.run(argv, capture_output=True, text=True, shell=False)
    if p.returncode != 0:
        raise RuntimeError(p.stderr or p.stdout)
    r = json.loads(p.stdout)
    if r.get("ok") is not True or r.get("transport") != "delta-cli":
        raise RuntimeError(r)
    return r["native"]
```

每个代码示例只调用一次。将返回值投影成用户要求的有界 JSON 并显式 `print`，然后
调用 `step_finish(status="done", summary=<同一 JSON>)` 恰好一次。失败则
`step_finish(status="failed", summary=<原始错误短摘要>)`，禁止重试或改走其他链路。

## PubChem（tool=`pubchem`）

| operation | 人类情景 | 最小代码 | native 投影 |
| --- | --- | --- | --- |
| `health` | “PubChem 服务现在能用吗？” | `n=invoke("pubchem","health")` | status、availability、metadata、limits、warnings |
| `compound-resolve-cids` | “把 aspirin 解析成 CID。” | `n=invoke("pubchem","compound-resolve-cids",data={"identifier":"aspirin","namespace":"name","max_records":20})` | identifier、valid、cids、error |
| `compound-properties` | “查 aspirin 的分子式和分子量。” | `n=invoke("pubchem","compound-properties",data={"identifier":"aspirin","namespace":"name","properties":["MolecularFormula","MolecularWeight"]})` | cid、valid、properties、aliases、error |
| `compound-synonyms` | “列出 aspirin 的前 5 个同义词。” | `n=invoke("pubchem","compound-synonyms",data={"identifier":"aspirin","namespace":"name","max_synonyms":5})` | cid、valid、synonyms、error |
| `compound-summary` | “查阿司匹林的基础身份信息。” | `n=invoke("pubchem","compound-summary",data={"identifier":"aspirin","namespace":"name"})` | valid、cid、properties 中用户要求的键 |
| `compound-batch-summary` | “一次比较 aspirin 和 caffeine 的基础属性。” | `n=invoke("pubchem","compound-batch-summary",data={"identifiers":["aspirin","caffeine"],"namespace":"name"})` | results[*].input、valid/error、properties |

## RDKit（tool=`rdkit`）

| operation | 人类情景 | 最小代码 | native 投影 |
| --- | --- | --- | --- |
| `health` | “RDKit 服务可用吗？” | `n=invoke("rdkit","health")` | status、availability、metadata、limits、warnings |
| `parse` | “这个 SMILES 合法吗？” | `n=invoke("rdkit","parse",data={"input":"CCO","format":"smiles","sanitize":True})` | valid、canonical_smiles、formula、inchi_key、warnings/error |
| `descriptors` | “计算乙醇的基础 RDKit 描述符。” | `n=invoke("rdkit","descriptors",data={"smiles":"CCO","descriptor_set":"basic","sanitize":True})` | valid、descriptors、warnings/error |
| `batch-descriptors` | “批量算几个 SMILES 的描述符。” | `n=invoke("rdkit","batch-descriptors",data={"smiles":["CCO","c1ccccc1"],"descriptor_set":"basic","sanitize":True})` | results 中输入、valid、descriptors、error |
| `batch-parse-describe` | “校验阿司匹林并给基础描述符。” | `n=invoke("rdkit","batch-parse-describe",data={"molecules":[{"id":"aspirin","smiles":"CC(=O)OC1=CC=CC=C1C(=O)O"}],"descriptor_set":"basic","sanitize":True})` | results[*].id、valid、canonical_smiles、descriptors、warnings/error |
| `render` | “画一张乙醇结构图。” | `n=invoke("rdkit","render",data={"smiles":"CCO","image_format":"png","width":500,"height":400})` | 指定图像字段；PNG 解码后验证 magic bytes |
| `fingerprint` | “生成乙醇 Morgan 指纹。” | `n=invoke("rdkit","fingerprint",data={"smiles":"CCO","radius":2,"n_bits":2048})` | valid、fingerprint_metadata、on_bits、warnings/error |
| `similarity` | “比较乙醇和乙胺的结构相似度。” | `n=invoke("rdkit","similarity",data={"query_smiles":"CCO","target_smiles":"CCN","radius":2,"n_bits":2048})` | similarity、metric、fingerprint metadata |
| `similarity-matrix` | “比较一组分子的两两相似度。” | `n=invoke("rdkit","similarity-matrix",data={"molecules":[{"id":"a","smiles":"CCO"},{"id":"b","smiles":"CCN"}],"fingerprint":{"type":"morgan","radius":2,"n_bits":2048},"sanitize":True})` | matrix、ranked_pairs[{a,b,similarity}] |
| `substructure` | “筛出含羧酸子结构的分子。” | `n=invoke("rdkit","substructure",data={"query_smarts":"C(=O)O","target_smiles":["CC(=O)O","CCO"]})` | query 与每个目标的 match/matches、valid/error |

## pymatgen（tool=`pymatgen`）

| operation | 人类情景 | 最小代码 | native 投影 |
| --- | --- | --- | --- |
| `health` | “pymatgen 服务是否正常？” | `n=invoke("pymatgen","health")` | status、availability、metadata、limits、warnings |
| `composition-parse` | “解析 LiFePO4 的组成和式量。” | `n=invoke("pymatgen","composition-parse",data={"formula":"LiFePO4","format":"formula"})` | valid、formula、reduced_formula、chemical_system、weight、element_amounts |
| `structure-parse` | “校验这段 CIF 能否解析。” | `n=invoke("pymatgen","structure-parse",data={"input":cif_text,"format":"cif","primitive":False})` | valid、formula、nsites、lattice、warnings/error |
| `structure-summary` | “总结这段 CIF 的结构信息。” | `n=invoke("pymatgen","structure-summary",data={"input":cif_text,"format":"cif","primitive":False})` | formula、reduced_formula、density、volume、lattice、species |
| `structure-convert` | “把 CIF 转成 POSCAR。” | `n=invoke("pymatgen","structure-convert",data={"input":cif_text,"input_format":"cif","output_format":"poscar","primitive":False})` | valid、output_format、转换后的结构文本、warnings/error |
| `structure-symmetry` | “分析这段 CIF 的空间群。” | `n=invoke("pymatgen","structure-symmetry",data={"input":cif_text,"format":"cif","primitive":False,"symprec":0.01,"angle_tolerance":5.0})` | space_group_symbol/number、crystal_system、point_group_symbol、hall、nsites |

## GSAS-II（tool=`gsasii`）

| operation | 人类情景 | 最小代码 | native 投影 |
| --- | --- | --- | --- |
| `health` | “GSAS-II 服务能做衍射计算吗？” | `n=invoke("gsasii","health")` | status、gsasii_available、metadata、limits、warnings |
| `powder-simulate` | “用这个 CIF 模拟 Cu Kα 粉末衍射。” | `n=invoke("gsasii","powder-simulate",data={"cif":cif_text,"phase_name":"phase","radiation":"CuKa","t_min":10.0,"t_max":80.0,"t_step":0.02,"include_profile":True,"max_profile_points":1000,"include_reflections":True,"max_reflections":1000,"return_refined_cif":False,"return_project":False})` | valid、profile、reflections、metadata、warnings |
| `powder-refine` | “用真实粉末数据和仪器文件做 Rietveld 精修。” | `n=invoke("gsasii","powder-refine",data={"powder_data":powder_text,"powder_format":"xy","instrument_parameters":instrument_text,"phases":[{"name":"phase","cif":cif_text}],"refinement_mode":"rietveld","refinement_steps":[],"max_cycles":3,"histogram_name":"powder","include_profile":True,"max_profile_points":1000,"include_reflections":True,"max_reflections":1000,"return_refined_cif":False,"return_project":False})` | valid、residuals、phase summaries、profile、reflections、warnings |

## LAMMPS（tool=`lammps`）

| operation | 人类情景 | 最小代码 | native 投影 |
| --- | --- | --- | --- |
| `health` | “LAMMPS 服务可用吗？” | `n=invoke("lammps","health")` | status、lammps_available、metadata、limits、warnings |
| `lj-melt-example` | “给我跑部署自带的最小 LJ 示例做检查。” | `n=invoke("lammps","lj-melt-example")` | 示例说明与精确 `request`；此调用本身不执行模拟 |
| `run` | “执行刚才返回的最小 LJ 请求。” | `example=invoke("lammps","lj-melt-example"); n=invoke("lammps","run",data=example["request"])` | valid、last_thermo、thermo rows、warnings、请求的输出文件；此场景固定两次依赖调用 |

`run` 也可接收用户明确提供的 `input_script`、相对路径 files、timeout 和有界输出配置；
不得从化学式猜力场。长任务需明确授权，失败后不得重试。

## Delta-BO（tool=`delta-bo`）

| operation | 人类情景 | 最小代码 | native 投影 |
| --- | --- | --- | --- |
| `commands` | “当前 Delta-BO 支持哪些命令？” | `n=invoke("delta-bo","commands")` | 当前部署返回的命令列表，不从旧文档补充 |
| `generate` | “在 0 到 1 之间给两个随机初始实验点。” | `n=invoke("delta-bo","generate",data={"params":[{"name":"x","type":"numeric","low":0.0,"high":1.0}],"num_suggestions":2,"algorithm":"random-search","seed":42})` | suggestions、suggestion_metadata、warnings、diversity |

有历史观测且用户明确要求 BO 时，`generate` 可加入 objectives、object-form histories、
model/acquisition/solver；历史少于 5 条默认 random-search，不编造观测。

## LDM-BO（tool=`ldm-bo`）

只用于小分子 SMILES/PDF2Dock，不用于抗体、CDRH3 或 AntBO。

| operation | 人类情景 | 最小代码 | native 投影 |
| --- | --- | --- | --- |
| `health` | “分子 LDM-BO 服务可用吗？” | `n=invoke("ldm-bo","health")` | availability、Vina/ReaSyn/模型/LLM 配置状态、warnings |
| `recommend` | “从候选池给下一条小分子 SMILES。” | `n=invoke("ldm-bo","recommend",data={"method":"bo-tanimoto","pool":["CCO","CCN","CCC"],"history":[{"smiles":"CCO","scores":[-7.1]},{"smiles":"CCN","scores":[-6.8]}],"batch_size":1})` | recommendations、acquisition_values、n_objectives、llm diagnostics |
| `trajectory` | “跑一个有界的小分子 BO 轨迹。” | `n=invoke("ldm-bo","trajectory",data={"method":"bo-tanimoto","seed":42,"seed-smiles":"CCO,CCN,CCC","num-evaluations":4,"batch-size":1,"objective":"vina+nn"})` | config、history、summary、llm_trajectory；保留连字符字段 |

## SynBO（tool=`synbo`）

| operation | 人类情景 | 最小代码 | native 投影 |
| --- | --- | --- | --- |
| `health` | “SynBO 服务当前可用吗？” | `n=invoke("synbo","health")` | status、synbo_available、metadata、limits、runtime、warnings |
| `initialize` | “没有实验历史，先选三组反应条件。” | `n=invoke("synbo","initialize",data={"condition_dict":{"catalyst":["Pd(OAc)2","Pd(PPh3)4"],"solvent":["THF","Toluene"],"base":["K2CO3","DBU"]},"opt_metrics":["yield"],"opt_metric_settings":[{"opt_direct":"max","opt_range":[0,100],"metric_weight":1.0}],"batch_size":3,"sampling_method":"random","desc_normalize":"minmax","random_seed":42})` | recommendations/initial conditions、warnings、metadata |
| `optimize` | “根据真实历史收率推荐下一批条件。” | `n=invoke("synbo","optimize",data={"condition_dict":{"catalyst":["Pd(OAc)2","Pd(PPh3)4","Pd2(dba)3"],"solvent":["THF","Dioxane","Toluene"],"base":["K2CO3","NaOEt","DBU"]},"opt_metrics":["yield"],"previous_results":[{"batch":0,"catalyst":"Pd(OAc)2","solvent":"THF","base":"K2CO3","yield":42.0},{"batch":0,"catalyst":"Pd(PPh3)4","solvent":"Dioxane","base":"NaOEt","yield":55.0},{"batch":0,"catalyst":"Pd2(dba)3","solvent":"Toluene","base":"DBU","yield":63.0}],"batch_size":2,"accuracy":"tiny","device":"cpu","random_seed":42})` | recommendations、model/acquisition metadata、warnings；失败/空结果不得本地替代 |

## AntBO（tool=`antbo`）

抗体/CDRH3 场景即使出现 “LDM” 也必须路由到 AntBO，不得改用分子 LDM-BO。

| operation | 人类情景 | 最小代码 | native 投影 |
| --- | --- | --- | --- |
| `health` | “AntBO 环境可用吗？” | `n=invoke("antbo","health")` | status、antbo_available、metadata、limits、warnings |
| `run-default-job` | “启动标准 AntBO 后台任务。” | `n=invoke("antbo","run-default-job",params={"log_name":"antbo_<唯一时间戳>.log","append":False,"timeout_seconds":86400})` | started、pid、log_name/log_path、timeout_seconds |
| `run` | “用明确的受限配置同步跑一次 AntBO。” | `n=invoke("antbo","run",data={"script_path":"./bo/main.py","config_path":"./bo/config.yaml","n_trials":1,"seed":42,"antigens_file":"<项目根内路径>","extra_args":[],"timeout_seconds":86400,"cuda_visible_devices":"0","conda_env":"DGM","log_name":"antbo_custom.log","append":False})` | ok、returncode、timed_out、log_path、log_truncated |
| `log` | “查看 antbo_run.log 的尾部。” | `n=invoke("antbo","log",params={"log_name":"antbo_run.log"})` | log_name、log、log_truncated |
| `jobs` | “查看当前活动 AntBO 作业。” | `n=invoke("antbo","jobs")` | jobs[*].pid/running/returncode/log_name/log_path |
| `stop` | “停止 PID 12345。” | `n=invoke("antbo","stop",params={"pid":12345})` | stopped、pid、message |

`run-default-job`、`run`、`stop` 是远程变更，必须有用户明确授权，未知结果不得重试。
AntBO `ldm/suggest`、`ldm/initialize`、`ldm/evaluate` 当前不在 catalog：不调用工具，
固定报告“未暴露该 operation；未发送远端请求”。

注意：AntBO `health` 可能公布公司服务内部的 `ldm_suggest` 等 endpoint，但它们并不
因此成为 Delta CLI operation；禁止调用不存在的 `antbo/catalog`，也禁止根据 health
为 Memento 推导新的 endpoint。
