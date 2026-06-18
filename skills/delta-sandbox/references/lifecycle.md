> **前置条件：** 先阅读 [`../delta-shared/SKILL.md`](../delta-shared/SKILL.md) 了解认证、配置和通用错误处理。

# Delta Sandbox 生命周期

## 完整流程

1. **查看可用镜像** `delta-cli sandbox images` — 查询服务端支持的镜像列表，根据用户的 GPU/CPU 需求和标签匹配镜像
2. **列出现有 sandbox（可选）** `delta-cli sandbox list` — 查看当前用户已创建的活跃 sandbox，避免重复创建
3. **创建** `delta-cli sandbox create --image <image> --cpu 4 --memory 16Gi --gpu 1 --gpu-mem 8000 --max-life 120`（创建后立即可用，无需连接；--max-life 指定 sandbox 最大存活时间（分钟），默认 30；这些是 `create` 全部资源参数，不要 invented 其它 flag）
4. **写入代码/数据** `delta-cli sandbox write <id> --path /workspace/train.py --data "..."`
5. **运行命令** `delta-cli sandbox run <id> --command "python /workspace/train.py"`
   - `sandbox run` 是同步执行，返回结果里直接包含 `stdout`、`stderr`、`exit_code`，**不要**再调 `sandbox logs`
6. **读取结果** `delta-cli sandbox read <id> --path /workspace/result.json`
7. **销毁** `delta-cli sandbox kill <id>`（如需保存结果用 finish，finish 会自动销毁）

## 后台任务

对于长时间运行的训练（>5 分钟），使用 `run-bg` 在后台异步执行：

```bash
# 1. 启动后台命令（立即返回，不阻塞）
delta-cli sandbox run-bg <id> --command "python train.py" --timeout 7200

# ↑ 返回数据中包含 execution_id，请保存以便后续查询

# 2. 轮询命令是否完成（可在后续 tool call 轮次执行）
delta-cli sandbox logs <id> --execution-id <exec_id>
# ↑ 如果返回 finished=false，说明命令仍在运行

# 3. 全部完成后销毁 sandbox
delta-cli sandbox kill <id>
```

**注意**：
- `sandbox logs` 只应配合 `sandbox run-bg` 使用；同步 `sandbox run` 的结果直接返回，不能也不应该调用 `logs`。
- `sandbox run-bg` 的 `--timeout` 传给服务端作为命令超时，HTTP 请求本身会快速返回；命令若超时会以非零退出码结束。
- 后台命令可跨 tool call 轮次查询：保存 `sandbox_id` 和 `execution_id`，后续轮次通过 `sandbox status` / `sandbox logs` 获取结果。
