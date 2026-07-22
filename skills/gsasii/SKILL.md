---
name: gsasii
description: 当用户要求使用真实 CIF 模拟粉末 XRD/中子衍射，或使用真实粉末数据、仪器参数与相模型执行 GSAS-II Rietveld 精修时使用。所有实时请求只走 Delta CLI wrapper；禁止伪造 CIF、粉末数据或仪器文件。
---

# GSAS-II 服务

## 强制规则

- 第一个且唯一实时执行工具是 `python_repl`，通过
  `$SKILLS_ROOT/delta-science/scripts/invoke.py`，tool=`gsasii`。
- `python_repl` 工具参数只能包含 `code`，禁止 `deps/dependencies/packages`。
- 禁止 Bash、目录/路径探测、字面 CLI 命令、直接 HTTP 和本地 GSAS-II。
- 业务结果直接位于 `r["native"]`，禁止 `native.data`。
- 输入不是 CIF 时先由 pymatgen 成功转换；精修必须有真实 powder data、真实
  instrument parameters 和真实 phase CIF，任何失败都不得用合成数据补齐。

## operation 选择

- `health`：明确检查服务状态，无 body。
- `powder-simulate`：最小有界请求包含 `cif`、`phase_name`、`radiation:"CuKa"`、
  `t_min/t_max/t_step`、profile/reflection 开关和上限；`t_step` 与 `n_points` 二选一。
- `powder-refine`：包含 `powder_data`、`powder_format`、
  `instrument_parameters`、`phases:[{name,cif}]`、`refinement_mode:"rietveld"`、
  `refinement_steps`、`max_cycles` 和有界输出上限。

完整最小 payload 与字段见同级 `references/endpoints.md`。`pawley`/`lebail` 在当前
服务未实现时原样报告，不改成 rietveld。长 profile/reflections/project 不在最终答复
展开，只报告点数、范围、残差、警告和用户要求的有界字段。

## 调用与完成

在一个 `python_repl` 中用 `subprocess.run(..., shell=False)` 调 wrapper，使用
`--data-json`（health 省略），校验退出码、`ok=true`、`transport="delta-cli"`，
显式打印从 native 投影的有界 JSON。成功后立即
`step_finish(status="done", summary=<同一 JSON>)`；失败则 `status="failed"`。
只调用一次，不调试打印，不自动重试。
