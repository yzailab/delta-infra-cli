> **前置条件：** 先阅读 [`../delta-shared/SKILL.md`](../delta-shared/SKILL.md) 了解认证、配置和通用错误处理。

# Delta Sandbox 生命周期

## 完整流程

1. **查看可用镜像** `delta-cli sandbox images` — 查询服务端支持的镜像列表，根据用户的 GPU/CPU 需求和标签匹配镜像
2. **列出现有 sandbox（可选）** `delta-cli sandbox list` — 查看当前用户已创建的活跃 sandbox，避免重复创建
3. **创建** `delta-cli sandbox create --image <image> --cpu 4 --memory 16Gi --gpu 1 --gpu-mem 8000`（创建后立即可用，无需连接；这些是 `create` 全部资源参数，不要 invented 其它 flag）
4. **写入代码/数据** `delta-cli sandbox write <id> --path /workspace/train.py --data "..."`
5. **运行命令** `delta-cli sandbox run <id> --command "python /workspace/train.py"`
   - `sandbox run` 是同步执行，返回结果里直接包含 `stdout`、`stderr`、`exit_code`，**不要**再调 `sandbox logs`
6. **读取结果** `delta-cli sandbox read <id> --path /workspace/result.json`
7. **销毁** `delta-cli sandbox kill <id>`（如需保存结果用 finish，finish 会自动销毁）

## 后台任务

对于长时间运行的训练，才使用 `run-bg` + `logs`：

```bash
delta-cli sandbox run-bg <id> --command "python train.py" --timeout 3600
delta-cli sandbox logs <id> --execution-id <exec_id>
```

**注意**：`sandbox logs` 只应配合 `sandbox run-bg` 使用；同步 `sandbox run` 的结果直接返回，不能也不应该调用 `logs`。
