# 标准任务请求模式

本文件提供 `delta-sandbox` 处理常见任务时的推荐请求写法。这些示例是语言无关的模板，实际代码由 skill 在 sandbox 内部生成或写入。

## Planner 调用本 skill 时的 required_outputs

所有直接调用 `delta-sandbox` 的 plan step 都应该声明会落盘一个 `.json` 文件。这样 skill 运行命令后把 sandbox `result_file` 写入本地 `result.json` 时，host 可以正确通过 Phase-10B deliverable 校验。

```yaml
required_outputs:
  - kind: file
    extensions: [".json"]
```

> 说明：这是声明 skill 会创建 `.json` 结果文件，不是要求用户请求中出现 `.json`。用户请求仍按下面的模板使用中性动词。

## 通用脚本输出模板

为了让 skill 用同一套流程生成 `RESULT:` 并避免大模型去摘要长日志，推荐任何 sandbox 脚本在**执行结束时**打印一行结构化 JSON：

```json
{"status":"ok","key_metric_1":"value_1","key_metric_2":123}
```

SKILL 会把它提取为 `result.json` 的 `summary`，并生成 `result_summary` 与最终 `RESULT:` 行。

不同任务的关键字段示例：

- **CUDA 检查**：`status`, `torch_version`, `cuda_available`, `device_name`
- **训练任务**：`status`, `epochs`, `final_loss`, `final_accuracy`, `model_file`
- **推理任务**：`status`, `input_samples`, `output_file`, `avg_latency_ms`
- **数据处理**：`status`, `input_rows`, `output_rows`, `output_file`
- **编译/构建**：`status`, `build_time_s`, `output_binary`, `tests_passed`

## 1. GPU / CUDA 可用性检查

用户请求示例：

```text
在 GPU sandbox 中运行标准 PyTorch CUDA 自检脚本，返回 exit_code、torch 版本、CUDA 是否可用、CUDA/cuDNN 版本、GPU 名称与显存信息。
```

说明：

- 不要在请求里出现 `torch.cuda.is_available()` 等完整代码 token，避免被 host 误判为 `.cuda` 文件承诺。对应的 plan step 仍按上面模板声明 `.json` 输出。
- 推荐让脚本在 `stdout` 末尾输出一行结构化 JSON，例如：
  ```json
  {"torch_version":"2.7.0+cu128","cuda_available":true,"device_count":1,
   "device_name":"NVIDIA GeForce RTX 3090","tensor_op":"[101.0]",
   "memory_before_mb":{"allocated":0,"reserved":0,"max_allocated":0},
   "memory_after_mb":{"allocated":0.0005,"reserved":2.0,"max_allocated":0.001}}
  ```
- skill 会从 `result_file` 提取这个 JSON 作为本地 `result.json` 的 `summary`，最终只输出一行 `RESULT: ...`。
- 完整 `nvidia-smi` 原始输出保留在 sandbox 的 `result_file` 中。

## 2. 运行用户已有的脚本

```text
在 sandbox <sandbox_id> 中运行 /workspace/train.py，参数为 --epochs 10 --batch-size 32。
```

说明：文件已存在，用中性动词 `运行`，不使用 `创建` 等承诺动词。

## 3. 安装依赖并执行命令

```text
在 sandbox 中运行 pip install -r /workspace/requirements.txt，然后运行 python /workspace/app.py。
```

说明：依赖安装和命令执行都没有落盘新文件，使用中性动词描述。

## 4. 训练并将指标落盘

```text
在 GPU sandbox 中运行训练脚本（例如基于 PyTorch 的 MNIST 训练），训练完成后在 stdout 末尾打印包含 epochs、final_loss、final_accuracy、model_file 的结构化 JSON。
```

说明：

- 训练日志可能很长，不要让 skill 去读整段日志再摘要；让脚本自己输出关键指标。
- 推荐脚本最终打印：`{"status":"ok","epochs":10,"final_loss":0.023,"final_accuracy":0.992,"model_file":"/workspace/model.pt"}`
- skill 会把它提取为 `result.json` 的 `summary`，最终输出 `RESULT: exit_code=0, status=ok, epochs=10, ...`。
- 如需保存完整模型文件，可再用 `sandbox read` 或 `sandbox upload` 处理，不属于 `result.json` 的摘要范围。

## 5. 通用数据处理

```text
在 sandbox 中运行数据处理命令，读取 /workspace/input.csv，输出 /workspace/output.csv，并在 stdout 末尾打印包含 input_rows、output_rows、output_file 的结构化 JSON。
```

说明：

- 推荐脚本最终打印：`{"status":"ok","input_rows":10000,"output_rows":9876,"output_file":"/workspace/output.csv"}`
- skill 会把它提取为 `result.json` 的 `summary`，最终输出 `RESULT: exit_code=0, status=ok, input_rows=10000, output_rows=9876, output_file=/workspace/output.csv`。

## 6. 模型推理（Qwen / LLM / 视觉等）

用户请求示例：

```text
在 GPU sandbox 中用 ModelScope 上的 Qwen/Qwen2.5-0.5B-Instruct 运行一次推理，输入 "100+10"，返回模型的输出结果及 CUDA 可用性摘要。
```

说明：

- 请求里不要贴完整 Python 代码，也不要指定宿主文件路径（如 `@ROOT/inference.py`、本地绝对路径等）。脚本内容、模型下载、执行路径都由 skill 内部通过 `delta-cli sandbox write` 写入 sandbox 后运行。
- 推荐让脚本在 `stdout` 末尾打印一行结构化 JSON，例如：
  ```json
  {"status":"ok","cuda_available":true,"device":"cuda","model":"Qwen/Qwen2.5-0.5B-Instruct","input":"100+10","output":"110"}
  ```
- skill 会把它提取为 `result.json` 的 `summary`，最终输出 `RESULT: exit_code=0, status=ok, cuda_available=True, output=110, ...`。

## 注意事项

- 尽量用自然语言描述任务，完整代码由 skill 内部处理。
- 只有在 skill 会真实创建文件时，才在请求中显式写出 `*.py` / `*.json` / `*.csv` 等扩展名。
- 不要使用 `脚本需输出...` 这类把代码片段直接跟在承诺动词后的句式。
- **任务完成的标准是执行结果，不是脚本文件存在**。Planner 和 skill 都要以本地 `result.json` 的生成作为完成标志；`required_outputs` 必须声明 `.json`，不要只声明 `{"kind": "file"}`。
- **`skill_request` 里不要出现完整代码块或宿主文件路径概念**（如 `@ROOT/...`、`/Users/...`）。脚本应通过 `delta-cli sandbox write` 进入 sandbox 内部路径 `/workspace/...`。

## 本地 `result.json` 的内容约定

- 本地 `result.json` 是一份**精简摘要**，用于 host deliverable 校验，不是完整日志存档。
- 必须包含 `result_summary` 字段，内容与最终 `RESULT:` 行一致，方便 Runner 直接读取结论。
- 只写入关键字段（`execution_id`、`sandbox_id`、`exit_code`、`finished`、`summary`、`result_summary`、`error`、`stderr_preview` 等）。
- 不要把完整原始 `stdout` 塞进 `result.json`，否则 host 的 `read_file` 工具预览时会截断，Runner 可能误以为文件被截断。
- 完整原始输出保留在 sandbox 的 `result_file` 中，需要时再 `sandbox read`。
