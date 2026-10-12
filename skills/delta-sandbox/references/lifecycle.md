> **Prerequisite:** Read [`../../delta-shared/SKILL.md`](../../delta-shared/SKILL.md) first for authentication, configuration and general error handling.

# Delta Sandbox lifecycle

## Complete workflow

1. **Check available images** `delta-cli sandbox images` — list the images supported by the server. The image determines which language runtimes are available in the container (Python / Node.js / Go / Java / Rust, etc.); choose one that fits the user's technology stack and GPU/CPU requirements.
2. **List existing sandboxes (optional)** `delta-cli sandbox list` — check the active sandboxes already created by the current user to avoid creating duplicates.
3. **Create** `delta-cli sandbox create --image-name <image-name> --cpu 4 --memory 16Gi --gpu 1 --gpu-mem 8000 --max-life 120 [--gpu-type <model>] [--shm-size XGi] [--devices kvm]` (the sandbox is ready to use immediately; no connection step is needed. `--memory`/`--gpu-mem` accept g/m/G/M formats (for example, 1G/512M; lowercase is also accepted), which the CLI converts to Gi/Mi. `--max-life` sets the sandbox's maximum lifetime in minutes; the default is 30. `--no-auto-cleanup` prevents automatic cleanup; the sandbox can then be destroyed only with an explicit kill/finish. `--image-name` takes an image name, such as `"PyTorch CUDA13 (GPU)"`; compute backend selection is automatic and does not need to be specified. `--gpu-type` (optional) selects a GPU model, such as `"RTX 4090"` or `H100`; the server maps this to the HAMi use-gputype annotation for model-based scheduling. To see available models, check `sandbox resources` (the `third_party` group's `gpu_types[].gpu_name`); if omitted, scheduling is automatic. `--shm-size` (optional) increases the container's `/dev/shm` (the **default is only 64Mi**)—it must be increased when PyTorch `DataLoader(num_workers>0)`/`multiprocessing`, Chromium-based engines or similar report `No space left on device`/`Bus error`; **a Gi/Mi unit is required** (`4G`/`512M` are normalised by the CLI; the server rejects a bare number), and it **must not exceed `--memory`** (it is a memory filesystem and filling it causes OOMKill; `--memory` defaults to only 1Gi, so increasing shm usually requires increasing memory too, for example, `--memory 8Gi --shm-size 4Gi`). Only private compute (`private`) applies this setting (third-party compute ignores it), but unit/limit validation is backend-independent and rejects invalid values before creation. `--devices` (optional) requests host-device passthrough using comma-separated tokens (for example, `--devices kvm` makes `/dev/kvm` available inside the container for nested virtualisation); this raises privileges, and if the server allowlist is not enabled, creation is **explicitly rejected** (not silently ignored; validation is backend-independent). If this error occurs, do not retry; use an approach that does not depend on that device. Only private compute applies this setting. **Resource limits per sandbox**: cpu ≤ 512, memory ≤ 1024Gi, gpu ≤ 64, gpuMem ≤ 1024Gi, shmSize ≤ memory. Exceeding a limit returns a validation error promptly at request time rather than hanging.)
4. **Write code/data** `delta-cli sandbox write <id> --source <filename>` — write a local file directly to the sandbox. If `--path` is omitted, the file is written to that sandbox's working directory by default (`/workspace/{user_id}/{sandbox_id}/<filename>`, which is within the OSS sync scope, so the file persists after kill). Before writing, use `delta-cli sandbox working-directory <id>` to confirm the path. **You must** use a relative source path (for example, `--source infer.py`); do not use `"$WORKSPACE_ROOT/<filename>"` or `$(pwd)/...`. A relative `--path` is also resolved under the working directory; an absolute `--path` is used as-is (`/workspace/<filename>` is outside the OSS sync scope and is not recommended). You can also use `--data "..."` to write a small amount of inline content (requires an explicit `--path`), and `--mode 755` to set file permissions. The returned `size` field is the actual on-disk byte count verified with stat, so it can confirm that the write completed. Use `write-multiple` to write several files at once. File paths and extensions depend on the runtimes in the image.
5. **Run a command** — first use `delta-cli sandbox working-directory <id>` to get `<wd>`, then construct a command for a runtime in the image. Common examples: `python <wd>/train.py` (Python), `node <wd>/app.js` (Node.js), `go run <wd>/main.go` (Go), `bash <wd>/run.sh` (Shell).
   - **Short tasks ≤60s**: `delta-cli sandbox run <id> --command "<command>" --timeout <seconds>` runs synchronously; raw SSE `data:` frames are passed through to stdout (with no trailing envelope), `exit_code`/`log_file` are read from the `complete` frame, and full stdout is written to the log_file.
   - **Long tasks >60s**: run `delta-cli sandbox run-bg <id> --command "<command>" --timeout <seconds> --wait` in the background (recommended), or use `run-bg` + `logs` for manual polling (`run-bg --wait` includes `--summary` by default; without `--wait`, it returns `{execution_id, sandbox_id}` immediately).
6. **Read the results** `delta-cli sandbox read <id> --path <wd>/result.json` (`<wd>` is the working directory; use `delta-cli sandbox working-directory <id>` to find it) — returns `content` (contents), `size` (disk bytes, from stat) and `content_length` (character count). Reading a non-existent file returns an error rather than empty content.
7. **Destroy the sandbox** `delta-cli sandbox kill <id>` (if you need to save results, use finish; finish destroys the sandbox automatically).

> **Note:** The server has no automatic sandbox expiry or TTL mechanism. If you do not kill a sandbox, it will occupy GPU resources indefinitely. Always destroy it when the task is complete.

## Background tasks

For long-running tasks (>60 seconds, such as training, compilation or data processing), run `run-bg` asynchronously in the background:

### Method 1 (recommended): wait for completion with `--wait`

```bash
delta-cli sandbox run-bg <id> --command "<command>" --timeout 7200 --wait
```
The CLI follows the live SSE stream (`/logs/stream`) and passes raw SSE frames (`data: {...}`) through to stdout one by one; the command ends when a `complete` frame arrives. **The CLI fills in fields in the complete frame**: in addition to the server-provided `exit_code`/`execution_id`/`error`, it adds the `stdout`/`stderr` accumulated from the stream, a recovered `log_file` if needed, and a detected trailing JSON `result_summary` (a valid JSON object found within the last 50 lines of stdout). If the command exits non-zero or errors, the CLI **appends an `error.type: command_failed` envelope and exits non-zero** (process exit code 8), which is useful for `&&` chains and agent branching; on success, no envelope is appended. This uses only **1 tool call**, making it suitable when intermediate progress is not needed.

> On the SSE path, `--wait` puts `result_summary` directly in the **complete frame** (if trailing JSON is detected), so there is no need to scan backwards with `sandbox read <id> --path <log_file>`. Read the log_file manually only if no valid JSON is found at the end. `--summary`/`--artifacts` enrichment (including hints) still takes effect only on the legacy-server fallback path.

> **Output contract (SSE path):** On success, `run-bg --wait` writes only raw SSE frames to stdout, with **no trailing envelope**. On command failure, it appends an `{"ok":false,"error":{"type":"command_failed",...}}` envelope after the complete frame. If the command has not finished within `--timeout`, it appends a `finished=false` `CommandLogsResult` snapshot envelope. For an older server (without the `/logs/stream` endpoint), the CLI falls back to polling every 5s and outputs a `CommandResult` envelope (the `finished` key is always present; when `finished=true`, it includes `result_summary`/`hints` enrichment).

### Method 2: poll manually (when you need to see live output)

```bash
# 1. Start the background command
delta-cli sandbox run-bg <id> --command "<command>" --timeout 7200
# ↑ Returns execution_id

# 2a. Follow the live stream (SSE, recommended):
delta-cli sandbox logs <id> --execution-id <exec_id> --stream
# ↑ Raw data: frames pass through to stdout one by one until the complete event, with no trailing envelope (--stream requires --execution-id)

# 2b. Poll a snapshot manually (use --tail N / --grep <pattern> to filter large output)
delta-cli sandbox logs <id> --execution-id <exec_id>
# ↑ Returns {sandbox_id, execution_id, stderr_tail, stderr_size, cursor, running, finished, exit_code, log_file?}
#   --execution-id may be omitted: if omitted, the query is by sandbox only; because sandbox_id and execution_id are not both passed, the server automatically uses ES;
#   the response is then an **array** grouped by execution_id (each item contains execution_id/stdout/stderr/exit_code/command/finished/error/log_file),
#   rather than a single snapshot object; the CLI also applies 800/200-byte tail trimming and --tail/--grep/--context filters to each item

# 3. Destroy after completion
delta-cli sandbox kill <id>
```

### How to interpret polling results

The data structure returned by `sandbox logs` looks like this:

```json
{"ok":true,"data":{"sandbox_id":"...","execution_id":"...","stdout_tail":"...","stderr_tail":"...","stdout_size":1234,"stderr_size":1234,"cursor":5,"running":false,"finished":true,"exit_code":0,"log_file":"/workspace/{user_id}/sandbox_logs/delta-result-{sandbox_id}-{execution_id}.json"}}
```

Field descriptions:
- `sandbox_id` / `execution_id` — match the request; if `--execution-id` is omitted, the server queries ES by sandbox and this field is empty.
- `stdout_tail` — the last **800 bytes** of stdout, retained by default by the CLI to keep context small.
- `stderr_tail` — the last **200 bytes** of stderr, retained by default by the CLI (the CLI hard-codes `tailString(s, n)` to slice by byte; for ASCII, this is n characters, while multibyte UTF-8 may be truncated). This keeps context small. If no range flag is passed, the CLI clears the raw `stdout`/`stderr` fields and exposes only `stdout_tail`/`stderr_tail` and `stdout_size`/`stderr_size`.
- `stdout_size` — number of bytes in the original stdout (calculated by the CLI).
- `stderr_size` — number of bytes in the original stderr (calculated by the CLI).
- `cursor` — server-side stderr line counter; **this field has no `omitempty` and is always present in the response**, even when 0. `cursor=0` usually means the server has not yet read any stderr lines from the provider. **A cursor alone is not a reliable way to detect a stall** (`cursor` stays at 0 for stdout-only or silent tasks); use `last_updated` as the primary signal when detecting stalls.
- `last_updated` — most recent activity time (RFC3339). On the SSE streaming path, the CLI sets this to the arrival time of the last data frame. On the snapshot polling path, it is supplied by the server (which may currently omit it); if missing, fall back to changes in `cursor`/`stdout_tail` when checking for a stall.
- `running` — whether the command is still running.
- `finished` — whether the command has completed (`finished = not running`).
- `exit_code` — exit code (available only after completion; omitted while running).
- `log_file` — present only when `finished=true`; path to the run-envelope log file (containing full stdout + stderr + exit_code + finished + command + error). Read it with `delta-cli sandbox read <id> --path <log_file>`. On the SSE path, the CLI fills in this field in the complete frame if needed.

**stdout routing:** By default, `sandbox logs` returns the last 800 bytes of stdout (`stdout_tail`) as a preview of live progress. Full stdout is written to the sandbox's `log_file` when the command ends; use `sandbox read` to read it all. On the SSE path, the CLI includes full `stdout` and `result_summary` in the complete frame (the latter is included when trailing JSON is detected). `--summary` enrichment (including hints) takes effect only on the legacy-server fallback path.

To customise the output slice with `--tail`/`--grep`/`--context`, pass any one of these flags. The CLI writes filtered stdout and stderr back to the `stdout`/`stderr` fields and updates `stdout_size`/`stderr_size`. Without these flags, it keeps `stdout=""` + the last 800 bytes in `stdout_tail` + `stderr=""` + the last 200 bytes in `stderr_tail` (about 1 KB total).

```bash
# Show the last 50 lines of stdout and stderr
delta-cli sandbox logs <id> --execution-id <eid> --tail 50
# Filter ERROR/warning lines (applies to both stdout and stderr)
delta-cli sandbox logs <id> --execution-id <eid> --grep "ERROR|warning" --context 2
```

Interpret task status using these rules, in order:

1. **`finished=true` + `exit_code=0`** → completed successfully; read the results and destroy the sandbox.
2. **`finished=true` + `exit_code≠0`** → command failed; check stderr/error details.
3. **`running=true`** → the task is still running; keep waiting (poll every 15–30 seconds is recommended).
4. **`running=true` for 3 consecutive polls, with no output changes and more than 60 seconds since submission** → the task may be stalled or producing no output; use `sandbox status <id>` to check whether the sandbox is alive. To judge whether output has changed: if the snapshot has `last_updated`, compare it directly with the current time and check whether it remains consistently stale. Only if `last_updated` is missing should you fall back to changes in `stderr_tail`/`cursor` (note that `cursor` reflects stderr lines only and stays at 0 for stdout-only tasks; do not use it alone to misdiagnose a hang).
5. **`sandbox status` is normal but logs still have not changed** → use `sandbox run <id> --command "ps aux | grep <process-name>" --timeout 15` to check inside the container whether the command is still running.

**Notes:**
- Use `sandbox logs` only with `sandbox run-bg`; synchronous `sandbox run` returns its result directly, so `logs` cannot and should not be called for it.
- Without `--wait`, the `sandbox run-bg` HTTP request itself returns quickly with `{execution_id, sandbox_id}`. If the command times out, it exits with a non-zero code; retrieve `exit_code` later with `logs`.
- In `sandbox run-bg --wait` mode, `--timeout` serves **both** as the server-side command timeout and the client-side waiting deadline (default 300s). The CLI follows the live SSE stream (`/logs/stream`), passes raw `data:` frames through to stdout and ends when `complete` arrives (with no trailing envelope); on timeout, it appends a `finished=false` snapshot envelope. The initial `/run-background` POST has its own 60s HTTP timeout.
- Background commands can be queried across tool-call turns: save `sandbox_id` and `execution_id`, then retrieve results in later turns with `sandbox status` / `sandbox logs`.
