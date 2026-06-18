> **前置条件：** 先阅读 [`../delta-shared/SKILL.md`](../delta-shared/SKILL.md) 了解认证、配置和通用错误处理。

# 命令速查表

| 命令 | 说明 |
|------|------|
| `sandbox images` | 查看可用镜像列表 |
| `sandbox list` | 列出当前用户创建的活跃 sandbox |
| `sandbox create` | 创建 sandbox |
| `sandbox connect` | 连接 sandbox |
| `sandbox kill` | 直接销毁 sandbox，不保存结果（有结果要保存时用 finish 替代） |
| `sandbox finish` | 保存结果后自动销毁 sandbox（二选一：finish 或 kill，不要同时调用） |
| `sandbox status` | 查看状态 |
| `sandbox run` | 同步运行命令，结果直接返回 |
| `sandbox run-bg` | 后台运行命令 |
| `sandbox logs` | 获取后台命令日志（仅配合 `run-bg`） |
| `sandbox read` | 读取文件 |
| `sandbox write` | 写入文件 |
