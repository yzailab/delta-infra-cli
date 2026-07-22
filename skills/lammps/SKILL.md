---
name: lammps
description: 当用户要求检查 LAMMPS 服务、运行部署自带的有界 LJ melt 示例，或使用明确的 LAMMPS input/data/force-field 配置执行分子动力学、最小化并读取 thermo/log/dump/data 输出时使用。所有实时调用只走 Delta CLI；成功执行不代表物理收敛或生产可用。
metadata:
  allowed-tools:
    - read_file
    - python_repl
    - step_finish
---

# LAMMPS 服务

## 强制规则

- 第一个且唯一实时执行工具是 `python_repl`，通过
  `$SKILLS_ROOT/delta-science/scripts/invoke.py`，tool=`lammps`。
- `python_repl` 工具参数只能包含 `code`，禁止 `deps/dependencies/packages`。
- 禁止 Bash、路径探测、字面 CLI 命令、直接 HTTP、本地 LAMMPS 和本地回归替代。
- 业务结果是 `r["native"]`，禁止 `native.data` 或把外层 envelope 交给 `run`。
- LAMMPS 不从化学式、CIF 或 POSCAR 自动推断 data、原子类型、势函数与边界条件。

## operation 选择

- `health`：明确健康检查，无 body。
- `lj-melt-example`：返回部署自带的精确 `native["request"]`，本身不执行模拟。
- `run`：只接受前一步已验证的 `native["request"]`，或用户明确提供的
  `input_script`、相对路径 `files`、timeout 与有界输出设置。

用户说“用最小示例测试 LAMMPS”时，在同一个 `python_repl` 中严格执行两次依赖调用：
先 `lj-melt-example`，再把其 `request` 原样作为 `run` 的 `--data-json`。不增加 health、
日志探测或本地可执行文件检查。普通明确 run 只调用一次。

最终只逐字复制当前 native 的 `last_thermo`、final step/temperature/total energy、
warnings 和用户要求的输出文件摘要。禁止能量除以原子数、换算单位、替换步数或推断
收敛性/稳定性。详细 run schema 见 `references/endpoints.md`。

显式打印有界 JSON 后立即调用
`step_finish(status="done", summary=<同一 JSON>)` 恰好一次；失败或 timeout 调用
`step_finish(status="failed", summary=<原始错误短摘要>)`，禁止重试和后续工具。
