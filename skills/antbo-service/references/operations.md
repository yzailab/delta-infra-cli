# AntBO operation 契约

在 `SKILL.md` 的 wrapper 模板中设置 `endpoint`、`data`、`params`。业务结果直接位于
`r["native"]`。标为“变更”的 operation 只有用户明确授权时才能执行，且不得重试。

## health（只读）

- 情景：检查远程 AntBO 环境是否可用。
- 代码：`endpoint="health"; data=None; params=None`
- 投影：status、antbo_available、metadata、limits、warnings。

## run-default-job（变更）

- 情景：用户明确要求启动标准后台续跑任务。
- 代码：`endpoint="run-default-job"; data=None; params={"log_name":"antbo_<唯一时间戳>.log","append":False,"timeout_seconds":86400}`
- 投影：started、pid、log_name/log_path、timeout_seconds；未知结果禁止重试。

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

## 当前不支持：AntBO LDM

`ldm/suggest`、`ldm/initialize`、`ldm/evaluate` 不在 CLI catalog。不得调用工具或
切换到分子 `ldm-bo`，以 Skill 规定的固定能力边界答复结束步骤。
