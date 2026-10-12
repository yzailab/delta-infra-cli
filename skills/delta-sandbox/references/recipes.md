# Standard task request patterns

This file provides recommended request patterns for common tasks handled by `delta-sandbox`. The examples are language-agnostic templates; the actual code is generated or written by the skill inside the sandbox.

## `required_outputs` when the Planner calls this skill

Every plan step that directly calls `delta-sandbox` should declare that it will write a `.json` file to disk. This allows the host to validate the deliverable in Phase-10B when the skill writes the sandbox `log_file` to the local `result.json` after running the command.

```yaml
required_outputs:
  - kind: file
    extensions: [".json"]
```

> This declares that the skill will create a `.json` result file; it does not require `.json` to appear in the user's request. Keep the user's request neutral in its wording, following the templates below.

## General script output template

To let the skill generate `RESULT:` consistently and avoid asking an LLM to summarise long logs, we recommend that every sandbox script print one line of structured JSON **at the end of execution**:

```json
{"status":"ok","key_metric_1":"value_1","key_metric_2":123}
```

> On the SSE path, the **complete frame for `sandbox run` / `run-bg --wait` already includes `result_summary`** (the CLI detects a valid JSON object in the last 50 lines of stdout and injects it, so there is no need to read and parse it manually). The script author only needs to ensure that the last line of stdout is valid JSON; the skill can then take `result_summary` directly from the complete frame. Only if the complete frame lacks this field (because there is no valid JSON at the end) should it fall back to `sandbox read` to read the `log_file` and scan backwards. `--summary` enrichment (including hints) still takes effect only on the legacy-server fallback path.

The skill extracts this as the `summary` in `result.json`, then generates `result_summary` and the final `RESULT:` line.

**Do not** output marker lines such as `FINAL_ANSWER: ...` or use a `final_answer` field in the JSON. Semantic fields in the summary (such as `output`, `result`, `generated_text` and `final_accuracy`) are enough to express the result.

Examples of key fields for different tasks:

- **CUDA check**: `status`, `torch_version`, `cuda_available`, `device_name`
- **Training task**: `status`, `epochs`, `final_loss`, `final_accuracy`, `model_file`
- **Inference task**: `status`, `input_samples`, `output_file`, `avg_latency_ms`
- **Data processing**: `status`, `input_rows`, `output_rows`, `output_file`
- **Compilation/build**: `status`, `build_time_s`, `output_binary`, `tests_passed`

## 1. GPU / CUDA availability check

Example user request:

```text
Run the standard PyTorch CUDA self-check script in a GPU sandbox; return exit_code, the torch version, whether CUDA is available, CUDA/cuDNN versions, the GPU name and memory information.
```

Notes:

- Do not include full code expressions such as `torch.cuda.is_available()` in the request; the host may mistake them for a `.cuda` file commitment. The corresponding plan step should still declare `.json` output using the template above.
- We recommend that the script print one line of structured JSON at the end of `stdout`, for example:
  ```json
  {"torch_version":"2.7.0+cu128","cuda_available":true,"device_count":1,
   "device_name":"NVIDIA GeForce RTX 3090","tensor_op":"[101.0]",
   "memory_before_mb":{"allocated":0,"reserved":0,"max_allocated":0},
   "memory_after_mb":{"allocated":0.0005,"reserved":2.0,"max_allocated":0.001}}
  ```
- The skill extracts this JSON from `log_file` as the `summary` in the local `result.json`, then outputs only one `RESULT: ...` line.
- The full raw `nvidia-smi` output remains in the sandbox `log_file`.

## 2. Run a script the user already has

```text
In sandbox <sandbox_id>, run <wd>/train.py with the arguments --epochs 10 --batch-size 32.
```

> `<wd>` is this sandbox's working directory (`/workspace/{user_id}/{sandbox_id}`; first check it with `delta-cli sandbox working-directory <id>`).

Notes: the file already exists, so use the neutral verb `run` rather than a commitment verb such as `create`.

## 3. Install dependencies and run a command

```text
In the sandbox, run pip install -r <wd>/requirements.txt, then run python <wd>/app.py.
```

Notes: neither dependency installation nor command execution creates a new deliverable file, so describe them with neutral verbs.

## 4. Train and write metrics to disk

```text
In a GPU sandbox, run a training script (for example, PyTorch-based MNIST training). When training finishes, print structured JSON at the end of stdout containing epochs, final_loss, final_accuracy and model_file.
```

Notes:

- Training logs can be long; do not have the skill read the entire log and then summarise it. Have the script output the key metrics itself.
- We recommend that the script finish by printing: `{"status":"ok","epochs":10,"final_loss":0.023,"final_accuracy":0.992,"model_file":"<wd>/model.pt"}`
- The skill extracts this as the `summary` in `result.json`, then outputs `RESULT: exit_code=0, status=ok, epochs=10, ...`.
- To save the complete model file, use `sandbox read` or `sandbox upload` as needed; the model file is outside the scope of the `result.json` summary.

## 5. General data processing

```text
In the sandbox, run a data-processing command that reads <wd>/input.csv and writes <wd>/output.csv, then prints structured JSON at the end of stdout containing input_rows, output_rows and output_file.
```

Notes:

- We recommend that the script finish by printing: `{"status":"ok","input_rows":10000,"output_rows":9876,"output_file":"<wd>/output.csv"}`
- The skill extracts this as the `summary` in `result.json`, then outputs `RESULT: exit_code=0, status=ok, input_rows=10000, output_rows=9876, output_file=<wd>/output.csv`.

## 6. Model inference (Qwen / LLM / vision, etc.)

Example user request:

```text
Run one inference in a GPU sandbox using Qwen/Qwen2.5-0.5B-Instruct from ModelScope, with "100+10" as input; return the model's output and a summary of CUDA availability.
```

Notes:

- Do not paste complete Python code into the request or specify a host file path (such as `@ROOT/inference.py` or a local absolute path), and do not ask the script to output a `FINAL_ANSWER:` marker line. The skill writes the script, downloads the model and sets the execution path inside the sandbox using `delta-cli sandbox write`.
- We recommend that the script print one line of structured JSON at the end of `stdout`, for example:
  ```json
  {"status":"ok","cuda_available":true,"device":"cuda","model":"Qwen/Qwen2.5-0.5B-Instruct","input":"100+10","generated_text":"110"}
  ```
- The skill extracts this as the `summary` in `result.json`, then outputs `RESULT: exit_code=0, status=ok, cuda_available=True, generated_text=110, ...`.

> **Match GPU memory to the model:** The `--gpu-mem` value (in MiB) used to create the sandbox must match the model being run. Larger models and higher precision require more memory; putting a large model in a sandbox with too little `--gpu-mem` will cause OOM directly. The example above uses `Qwen2.5-0.5B` (a small 0.5B model); **do not use it as a memory reference for larger models such as 7B/9B/13B**. Before running a larger model, assess its memory requirements, increase `--gpu-mem` as appropriate, and consider verifying the workflow with a smaller model first.

## Notes

- Describe tasks in natural language where possible; the skill handles the full code internally.
- Mention extensions such as `*.py` / `*.json` / `*.csv` explicitly in the request only when the skill will actually create a file.
- Do not use phrasing such as `The script should output...` that puts a code fragment immediately after a commitment verb.
- **Task completion is determined by the execution result, not by the presence of a script file.** The Planner and skill should both treat the creation of the local `result.json` as the completion criterion. `required_outputs` must declare `.json`; do not declare only `{"kind": "file"}`.
- **Do not include complete code blocks or host-file-path concepts in `skill_request`** (such as `@ROOT/...` or `/Users/...`). The script should be written to the sandbox working directory (`/workspace/{user_id}/{sandbox_id}/...`) with `delta-cli sandbox write <id> --source <filename>`.

## Local `result.json` content contract

- **Preferred SSE path (recommended, one step):** The **complete frame for `sandbox run` / `run-bg --wait` includes `result_summary` directly** (the CLI injects detected trailing JSON from stdout), so the skill can extract it from the complete frame without reading and parsing the log.
- **SSE fallback path:** If the complete frame lacks `result_summary` (there is no valid JSON at the end of stdout), `delta-cli sandbox read <id> --path <log_file>` reads the run-envelope log file, then scans backwards through stdout to extract trailing JSON. The `log_file` path comes from the SSE `complete` frame (the CLI fills it in if needed) or the `sandbox logs` snapshot (after `finished=true`).
- **Legacy-server fallback path:** When `run` / `run-bg --wait` falls back to polling, it returns a `CommandResult` envelope whose `data.result_summary` field can be reused directly.
- The local `result.json` is a **concise summary** for host deliverable validation, not a complete log archive.
- It must include the `result_summary` field, with content matching the final `RESULT:` line, so the Runner can read the conclusion directly.
- Write only the key fields (`exit_code`, `finished`, `summary`, `result_summary`, `error`). **Do not** add fields such as `final_answer`.
- Do not put the full raw `stdout` in `result.json`; the host's `read_file` preview would be truncated, and the Runner might mistake this for a truncated file.
- Keep the full raw output in the sandbox `log_file` and use `sandbox read` to inspect it when needed.
