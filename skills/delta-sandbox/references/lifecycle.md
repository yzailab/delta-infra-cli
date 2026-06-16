> **前置条件：** 先阅读 [`../delta-shared/SKILL.md`](../delta-shared/SKILL.md) 了解认证、配置和通用错误处理。

# Delta Sandbox 生命周期

## 完整流程

1. **查看可用镜像** `delta-cli sandbox images` — 查询服务端支持的镜像列表，根据用户的 GPU/CPU 需求和标签匹配镜像
2. **创建** `delta-cli sandbox create --image <image> ...`（创建后立即可用，无需连接）
3. **写入代码/数据** `delta-cli sandbox write <id> --path /workspace/train.py --data "..."`
4. **运行命令** `delta-cli sandbox run <id> --command "python /workspace/train.py"`
5. **读取结果** `delta-cli sandbox read <id> --path /workspace/result.json`
6. **销毁** `delta-cli sandbox kill <id>`（如需保存结果用 finish，finish 会自动销毁）

## 后台任务

对于长时间运行的训练：

```bash
delta-cli sandbox run-bg <id> --command "python train.py" --timeout 3600
delta-cli sandbox logs <id> --execution-id <exec_id>
```
