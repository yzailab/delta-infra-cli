# AntBO 详细规则

直接用 `delta-cli science invoke` 设置 `endpoint`、`data`、`params`。按本文件定义的
CLI 服务响应字段读取业务结果。标为“变更”的 operation 只有用户明确授权时才能执行，且不得重试。

抗体/CDRH3 场景即使出现 “LDM” 也不得改用小分子 LDM-BO 或 STRBO。当前 catalog
同时暴露 CDRH3 生成/建议/评估接口和传统 AntBO 作业管理接口。

## health（只读）

- 情景：检查远程 AntBO 环境是否可用。
- 代码：`endpoint="health"; data=None; params=None`
- 投影：status、antbo_available、metadata、limits、warnings。

## run-default-job（变更）

- 情景：用户明确要求启动标准后台续跑任务。
- 代码：`endpoint="run-default-job"; data=None; params={"log_name":"antbo_<唯一时间戳>.log","append":False,"timeout_seconds":86400}`
- 投影：started、pid、log_name/log_path、timeout_seconds；未知结果禁止重试。

只有同一次业务响应同时包含 `started=true`、非空 `pid` 以及 `log_name` 或
`log_path` 时，才能声称作业已启动；字段缺失时标记为未验证，不得重复提交。

## run（重型变更）

- 情景：用户明确给出受限 AntBO 脚本、配置、抗原文件并要求同步执行。
- 代码：`endpoint="run"; data={"script_path":"./bo/main.py","config_path":"./bo/config.yaml","n_trials":1,"seed":42,"antigens_file":"<项目根内路径>","extra_args":[],"timeout_seconds":86400,"cuda_visible_devices":"0","conda_env":"DGM","log_name":"antbo_custom.log","append":False}; params=None`
- 投影：ok、returncode、timed_out、log_path、日志截断状态；不在最终答复展开完整日志。

## log（只读）

- 情景：用户提供已知 log_name 并要求查看尾部日志。
- 代码：`endpoint="log"; data=None; params={"log_name":"antbo_run.log"}`
- 投影：log_name、log、log_truncated；长日志只给有界尾部摘要。

## jobs（只读）

- 情景：查看当前 service 容器登记的活动作业。
- 代码：`endpoint="jobs"; data=None; params=None`
- 投影：jobs 中 pid、running、returncode、log_name、log_path。

## stop（变更）

- 情景：用户明确要求停止已确认 PID 的任务。
- 代码：`endpoint="stop"; data=None; params={"pid":12345}`
- 投影：stopped、pid、message；不得盲目重试或在多任务时无参数调用。

## CDRH3 生成与优化

服务端支持的抗原由 health 的 `supported_antigens` 决定；不得猜测或把任意蛋白文件
路径当成 antigen。部署通常支持 `1ADQ_A`、`1FBI_X`、`1H0D_C`、`1NSN_S`、
`1OB1_C`，但执行前以当前服务响应和用户选择为准。

### ldm-health（只读）

- 代码：`endpoint="ldm-health"; data=None; params=None`
- 投影：supported_antigens、cdrh3_length、objective、Absolut/模型真实性字段。

### ldm-init / ldm-init-validate

```json
{
  "task": "为指定抗原生成初始 CDRH3 候选",
  "num_initial": 3,
  "antigen": "1ADQ_A",
  "seed": 42
}
```

只校验参数时使用 `ldm-init-validate`；正式生成使用 `ldm-init`。成功候选必须是服务
返回的 CDRH3 序列，不得由模型自行编造。

### ldm-suggest / ldm-suggest-validate

```json
{
  "task": "继续降低抗原结合能",
  "history_xs": ["ARVGYSLYAMD", "AKYGGYDYAMD"],
  "history_ys": [-18.2, -17.4],
  "num_suggestions": 2,
  "antigen": "1ADQ_A",
  "seed": 42
}
```

AntBO 是单目标，`history_ys` 必须是一维有限数值数组，并与 `history_xs` 等长。
每条 CDRH3 必须是 11 个标准氨基酸字符；以 `ldm-health` 当前返回的
`cdrh3_length` 为最终约束。

### evaluate / evaluate-validate

```json
{
  "designs": ["ARVGYSLYAMD", "AKYGGYDYAMD"],
  "antigen": "1ADQ_A"
}
```

成功 score 数量必须与 designs 一致；结合能越低越好。生成、建议和评估均为远端重型
调用，结果未知或超时时不得重试，也不得用本地随机分数补全。
