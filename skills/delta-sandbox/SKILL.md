---
name: delta-sandbox
description: "Run any command or script in a Delta Sandbox Linux container. Use it for sandbox-based tasks such as training, inference, compilation and data processing, supporting Python / Node.js / Go / Java / Rust and other runtimes. All tasks use the same output convention: the command prints structured JSON at the end of stdout; on the SSE path the CLI detects trailing JSON in stdout and includes it as `result_summary` in the complete frame, and the skill only needs to scan backwards through `log_file` if it is missing (on older servers, the CLI automatically extracts it as `data.result_summary` via `--summary` on the fallback path). When the Planner calls this skill, declare `[{kind: 'file', extensions: ['.json']}]` in `required_outputs` for the plan step. Describe commands in requests with neutral verbs (run/execute); use verbs such as create/write/save, with a file extension, only when a file will actually be written. Route authentication/configuration/permission errors to delta-shared."
metadata:
  requires:
    bins: ["delta-cli"]
  cliHelp: "delta-cli sandbox --help"
---

**CRITICAL — Before starting, you MUST use the Read tool to read [`../delta-shared/SKILL.md`](../delta-shared/SKILL.md), which covers authentication, configuration and general error handling**

# delta-sandbox

## When to use

- The user mentions a sandbox, container, GPU, CUDA, training, inference or a compute task.
- The user needs to create/manage a sandbox instance, run commands in it, or read/write files.
- **Do not** use this for authentication, configuration setup, permission recovery or update checks → route these to `delta-shared`.

## Scope

- Perform all sandbox operations with `delta-cli sandbox <subcommand>`.
- delta-cli has no built-in default credentials; complete authentication and configuration via `delta-shared` before running it.
- Get `sandbox_id` from an actual command response; do not guess it from what the user says.

## Sandbox environment (package mirrors)

- **Domestic deployments (`domestic`)**: the server automatically configures domestic package mirrors when creating a sandbox. `pip install`, `npm install`, `git clone` and Hugging Face downloads work without extra configuration. This covers the pip index URL (`pypi.tuna.tsinghua.edu.cn`), npm registry (`npmmirror`), `HF_ENDPOINT` (`hf-mirror.com`) and Git `insteadOf` rules (GitHub proxy).
- **Overseas deployments (`overseas`)**: mirrors are not configured; use the official sources.
- **Third-party compute sandboxes**: mirror injection is off by default; use the official sources.
- If a mirror fails, first check network access in the sandbox's region rather than assuming that no mirror is configured.

## Mandatory rules (breaking any of these makes the task a failure)

1. **You must use delta-cli**: perform all sandbox operations with `delta-cli sandbox <subcommand>`. **Do not** call the HTTP API directly with Python (`urllib`/`httpx`/`requests`) or any SDK. delta-cli provides typed error output (`error.type`), the only reliable way for an AI agent to interpret errors.
2. **You must destroy the sandbox**: after each successful `sandbox create`, you **must** run `sandbox kill <id>` or `sandbox finish <id>` to destroy it before the current task's final `step_finish`. Failing to destroy it counts as task failure.
3. **Destroy it even after an error**: if a command inside the sandbox fails, times out or reports an error, you **must still** run `sandbox kill <id>`. An error is no reason to skip cleanup.
4. **Do not rely on external cleanup**: sandboxes **do** have automatic reclamation, but it does not replace destroying them yourself.
   - The default `--max-life` is 30 minutes. On private compute (OpenSandbox) the timer starts when the create request is accepted and the platform reclaims the sandbox; on third-party compute (AutoDL/RunPod) it starts when the sandbox is ready, and the server-side cleanup reclaims it at max-life plus up to 10 minutes of grace.
   - The platform may still reclaim a sandbox early (cluster eviction, node failure, etc.; `termination_reason=platform_gone`).
   - **Automatic reclamation does not write back to OSS**, so artifacts that were not pulled are lost.
   - Without `kill`, the sandbox keeps occupying GPU resources until it expires, and the reclamation time cannot be used to preserve results. When the task ends you must still run `kill` / `finish` explicitly (only `finish` writes back to OSS).
5. **Complete synchronous tasks in one command; background tasks may span turns**:
   - Synchronous mode (`sandbox run`): complete the full lifecycle from `create` to `kill` in the same execution. Do not retain a sandbox across tasks.
   - Background mode (`sandbox run-bg`): you may report `sandbox_id` and `execution_id` to the user during the current execution, then retrieve the result in a later turn with `sandbox status` and `sandbox logs`. You must still run `sandbox kill` when the task is complete.
6. **Do not create duplicates**: only one sandbox may be active for the same task. If a command needs retrying, reuse the existing `sandbox_id` where possible. If a new sandbox really is needed, first run `sandbox kill <old_sandbox_id>` and confirm that the old instance has been destroyed before running another `sandbox create`. You may use `delta-cli sandbox list` to find and **clean up leftovers** from an interrupted previous task, but **do not** use `list` to get around the rule that only one sandbox may be kept for the same task.

7. **Long tasks must run in the background**: for tasks expected to take over 60 seconds (for example, model downloads, training, fine-tuning, long inference runs or large-scale data processing), submit a background task with `delta-cli sandbox run-bg <id> --command "..." --timeout <seconds>`. Do not use synchronous `sandbox run`.

    **Recommended: one tool call, wait for completion**:
   ```bash
    delta-cli sandbox run-bg <id> --command "<command>" --timeout <seconds> --wait
   ```
    The CLI follows output in real time over SSE (`/logs/stream`) and passes each raw SSE frame (`data: {...}`) through to stdout, as with `curl -N`. The JSON `type` field identifies each frame: `init` (with `execution_id`), `stdout`, `stderr`, `error` or `complete`. The command ends when `complete` arrives. **The CLI fills in fields in the complete frame**: the server supplies `exit_code`/`execution_id`/`error`; the CLI adds the accumulated streamed `stdout`/`stderr`, a recovered `log_file` as a fallback, and a trailing-JSON `result_summary` when it detects a valid JSON object in the last 50 lines of stdout. Use `exit_code` in the `complete` frame to determine success. **If the command exits non-zero or reports an error, the CLI appends an `error.type: command_failed` envelope and exits with a non-zero code (process exit code 8)**; the envelope's `message` includes the end of stderr, which makes it easier to use with `&&`, branch on `error.type` and scan the failure reason. The CLI also best-effort appends the stderr tail to the `message` of a `type:"error"` frame; it does not append an envelope on success. If no `complete` frame arrives within `--timeout` (300s by default, serving as both the server command timeout and the client wait deadline), the CLI appends a snapshot envelope with `finished=false` after the frames already passed through, indicating that the command is still running. After `finished`, full stdout is written to `log_file` inside the sandbox (default: `/workspace/{user_id}/sandbox_logs/delta-result-{sandbox_id}-{execution_id}.json`; use the server-returned `log_file` field as authoritative). To read the full output, use `sandbox read <id> --path <log_file>` (the trailing JSON summary is already in the complete frame, so this is usually unnecessary). **`--summary`/`--artifacts` enrichment, including hints, is available only on the older-server fallback path** (when the server lacks the `/logs/stream` endpoint, the CLI automatically falls back to polling every 5s and returns a `CommandResult` envelope). Use `execution_id` for later `sandbox logs` or `cancel` calls.

    **For automation: `--format json` (same as `--json-result`)** — emits no `data:` frames, just **one** JSON envelope, so you can parse `data` directly instead of stitching stdout frames together:

   ```bash
   delta-cli sandbox run <id> --command "<command>" --timeout <seconds> --format json
   delta-cli sandbox run-bg <id> --command "<command>" --timeout <seconds> --wait --format json
   ```

   The `data` fields have the same names and meaning as in the `complete` frame: `execution_id`, `finished`, `exit_code`, `stdout_tail`, `stderr_tail`, `stdout_size`, `stderr_size`, `log_file`, `duration_seconds` and `result_summary`. `stdout_tail`/`stderr_tail` are the last 2000 characters of the accumulated streamed output (newlines preserved), so there is no need to aggregate the `stdout` frames. When the command exits non-zero the CLI emits `{"ok":false,"error":{...},"data":{...}}`, where `data` is the same object (including `exit_code`), and the process exit code is 8. This mode shares field semantics with SSE mode, so you can switch between them at any time.

    **Live following / manual polling (when you need intermediate progress)**:
    `sandbox logs <id> --execution-id <exec_id> --stream` follows the task in real time (SSE), passing each raw `data:` frame through to stdout until the `complete` event, with no trailing envelope (`--stream` requires `--execution-id`). Without `--stream`, `sandbox logs <id> --execution-id <exec_id>` returns a snapshot envelope. You may omit `--execution-id`; if omitted, the server queries only by sandbox and automatically uses ES (Elasticsearch) because `sandbox_id` and `execution_id` were not both supplied (it returns an **array** aggregated by execution ID rather than a single snapshot object):
    - `finished=true` and `exit_code=0` → complete
    - `finished=true` and `exit_code!=0` → failed
    - `running=true` → still running

    **Troubleshooting**: if `running=true` for three consecutive checks, `stderr_tail`/`stdout_tail`/`cursor` have not changed, and more than 60 seconds have passed since submission, use `sandbox status <id>` to check whether the sandbox is alive. Note: `cursor` has no `omitempty` and is always present in the response, even when it is 0; `stderr_tail` retains only the **last 200 bytes** of stderr by default, while `stdout_tail` retains the **last 800 bytes** of stdout (`tailString(s, n)` is hard-coded in the CLI and truncates by byte; for ASCII this is n characters, while multi-byte UTF-8 may be cut off). `cursor=0` usually means the server has not yet read any stderr lines from the provider.

    - After a background task succeeds, you must still destroy the sandbox as required by rules 2/3.

8. **Files are written to the sandbox working directory by default; do not use shell-variable paths**:
    - ✅ **Recommended**: `delta-cli sandbox write <id> --source train.py` (omit `--path` to write to `<working-directory>/train.py` by default)
    - ✅ **Explicit path**: `delta-cli sandbox write <id> --path <working-directory>/train.py --source train.py` (relative paths passed to `--path` are also prefixed with the working directory)
    - ❌ **Do not**: use `--source "$WORKSPACE_ROOT/train.py"` or `--source "$(pwd)/train.py"` (shell expansion can produce an empty file or fail)
    - ❌ **Do not**: use `--data "a large block of code..."` (shell-escaping problems)
    - ❌ **Discouraged**: write directly to the working-directory root with a path such as `--path /workspace/train.py`, outside `{user_id}`. Data there is not written back to the shared workspace after `kill` and will not persist.
    - To find the sandbox working directory, run `delta-cli sandbox working-directory <id>` (returns `data.path`). When a script is used with `run`/`run-bg`, give its full path, such as `python <working-directory>/train.py`.
    - For small configuration files (< 20 lines), you may use `--data "..."`, but you must also pass `--path` (the path cannot be inferred from a filename). Use `--mode 755` to set file permissions.

9. **Each `run-bg` creates a separate `execution_id`**: every call to `sandbox run-bg` returns a unique `execution_id`, which distinguishes background tasks. Save each returned `execution_id` and associate it with its task, then query each result with `sandbox logs <id> --execution-id <exec_id>`. Synchronous `sandbox run` does not need an `execution_id`; it returns the result directly.

10. **Use the available shell tool to run delta-cli commands directly; do not wrap `subprocess` in `python_repl`**
    - `delta-cli` returns structured JSON. Running it directly in the available shell keeps its output clear and makes `log_file` extraction easier.
    - ❌ **Do not** write `subprocess.run(['delta-cli', ...])` in `python_repl`. This mixes the output into a Python code block, making it harder to read and adding an unnecessary parsing step.
    - ✅ **Correct**: run `delta-cli sandbox ...` directly with the available shell tool.
    - Use `python3`/`python_repl` only when **parsing JSON**, for example, extracting `summary` from a `sandbox read` envelope and writing it to `result.json`.

11. **All code/data must enter the sandbox through `delta-cli sandbox write`**
    - All scripts, configuration files and data files to be run in the sandbox **must** be written with `delta-cli sandbox write <id> --source <local-filename>`. By default, files go to that sandbox's working directory (`/workspace/{user_id}/{sandbox_id}/`, which you can query with `delta-cli sandbox working-directory <id>`), within the OSS sync scope and available for persistence after `kill`.
    - Do not write a script to the host workspace and rely on synchronisation; files in the host workspace are not visible inside the sandbox.
    - This rule standardises the entry point as `sandbox write`; it does not depend on any particular host tool. Whatever file operation the host provides, the content must ultimately be sent into the sandbox.

12. **A task is complete when the command has produced a result, not when a script file exists**
    - The deliverable for this skill is **a summary of the result after the command has run in the sandbox** (the local `result.json` and its `result_summary`), not the `.py`, `.sh` or other script itself.
    - Writing a script to disk alone does not complete the task. Finish the full lifecycle—`write → run → read log_file → create result.json → kill sandbox`—before calling `step_finish`.
    - Therefore, do not phrase `skill_request` as “write/save/create a file and run it”, which makes writing the file sound like the milestone. Ask directly to “run the command and return a result summary”.

13. **`result.json` is required before completion**
    - Before calling `step_finish`, confirm that:
      1. `delta-cli sandbox run` / `run-bg --wait` has returned with `finished=true` **and `exit_code` = 0**. `finished=true` alone is not a success signal — a command that fails still finishes. A non-zero exit is reported as `error.type: command_failed` (process exit code 8), an **unknown** exit status as `error.type: unknown_execution_state` (exit code 1), and a wait timeout as `error.type: timeout` (non-zero exit, with `sandbox_id`/`execution_id` in `error.details`); in all three cases the task has **not** succeeded — report the failure instead of claiming a result;
      2. (By default) the `result_summary` in the SSE `complete` frame from `sandbox run` / `run-bg --wait` has been written to `result.json`; if it is missing (fallback), read `log_file` with `sandbox read` and parse it with Python.
      3. `sandbox kill <id>` has been run to destroy the sandbox;
      4. `final_response` consists of the single line `RESULT: <result_summary>`.

14. **Avoid redundant checks and validation**
    - If `skill_request` or the user's request already specifies the image and resources, **do not** call `sandbox images` or `sandbox recommend` before `sandbox create`.
    - After writing a file to the sandbox, it is enough to use `sandbox stat` (optionally) to confirm the size. **Do not** use `sandbox ls` plus `sandbox read` to read the file back to the host and verify its contents; that is an unnecessary round trip. (The `sandbox write` response already carries `server_sha256` and `size_verified`, so a local digest comparison is enough if the bytes matter.)
    - Do not repeatedly poll with `sandbox status` after a successful `sandbox create`; the sandbox is ready as soon as create returns.

## Request wording conventions

To reduce the risk of the host's Phase-10B file-extension check misclassifying a request, follow these conventions when constructing `skill_request`:

1. **Use neutral verbs when asking to run/execute commands**
   Prefer `run`, `execute` or `call`.
   - Correct: `Run a PyTorch CUDA self-check script in a GPU sandbox`
   - Avoid putting code directly in the request and using a verb such as “output”, for example:
     `Script should output: 1) torch.cuda.is_available(); ...`
     The regular expression may misread `torch.cuda` as a commitment to produce a `.cuda` file.

2. **Use commitment verbs and file extensions only when a file will actually be created**
   Use words such as `create`, `write`, `save`, `output` and `generate`, and specify the extension, only when the skill will actually write a file to disk.
   - Correct: `Create check_cuda.py and run it`
   - Correct: `Write the metrics to result.json after training`

3. **Do not put a complete code block in `skill_request`**
   Describe the task goal in natural language; the skill writes the specific code into the sandbox.
   - Correct: `Run the standard PyTorch CUDA availability check`
   - Avoid pasting `import torch; print(torch.cuda.is_available())` into `skill_request`.

### Declaring required_outputs

When constructing a plan step that calls this skill, you **must** declare that a `.json` file will be written in `required_outputs`:

```yaml
required_outputs:
  - kind: file
    extensions: [".json"]
```

The reason is that, after running a command, this skill reads `log_file` from the sandbox and writes a local `result.json`. The host's Phase-10B deliverable check uses OR semantics (any required extension satisfied by an actual file is enough); explicitly declaring `.json` prevents code tokens such as `torch.cuda` from being misread as a commitment to produce a `.cuda` file, avoiding duplicate execution caused by `VERIFICATION_FAILED`.

## Quick routing

> ⚠️ **Distinguish `list` from `ls`**: `sandbox list` lists the user's **sandbox instances** (like `docker ps`), while `sandbox ls <id>` lists a **directory inside a sandbox** (like the `ls` command). Take care when using Tab completion.

| User goal | Command |
|---------|------|
| **Discover** | |
| View available images (image names) | `sandbox images` — returns `image_name` (public image name), `tags` (purpose tags) and `description` (brief image description) for each image; when there are many, **choose an image that suits the task using `description` and `tags`** (for example, Pytorch → `PyTorch CUDA13 (GPU)`, vLLM → `vLLM …`, or check `supports_shared_workspace` when a shared workspace is needed) |
| View remaining allocatable resources | `sandbox resources` — returns available GPUs, GPU memory and cores grouped by compute source: `compute_sources[].source` is `private` (private compute) or `third_party` (third-party compute); the shape of `gpu_types` varies by group (`private` includes `vgpu`/`core`/`memory_mib`; `third_party` includes `gpu_name`/`total_gpu_num`/`idle_gpu_num`). The compute backend is an internal detail and is selected automatically; it need not be specified. |
| Get a resource recommendation | `sandbox recommend --cpu N --memory XGi [--gpu N] [--gpu-mem N]` (`--memory`/`--gpu-mem` accept g/m/G/M formats such as `1G`/`512M`; the CLI converts these automatically to Gi/Mi) |
| List the current user's sandboxes | `sandbox list [--status <running/finished/killed/error>] [--start-time <ISO8601>] [--end-time <ISO8601>] [--sandbox-id <id>] [--days N]` |
| **Lifecycle** | |
| Create a sandbox | `sandbox create --image-name <image-name> [--cpu N --memory XGi --gpu N --gpu-mem N --gpu-type <model> --shm-size XGi --devices kvm --max-life M]`; `--memory`/`--gpu-mem` accept g/m/G/M formats (for example `1G`/`512M`, including lower-case forms), which the CLI converts to the server's `Gi`/`Mi` units; `--image-name` takes an image name (the `image_name` field returned by `sandbox images`, for example `"PyTorch CUDA13 (GPU)"`); the underlying image identifier is hidden from users. `--gpu-type` selects a GPU model (for example `"RTX 4090"` or `H100`); see `gpu_types[].gpu_name` in the output of `sandbox resources` for available models. If omitted, scheduling is automatic. `--shm-size` increases the container's `/dev/shm` (default is only 64Mi; essential for multiprocessing/DataLoader workloads; **must include Gi/Mi units** and must not exceed `--memory`; only applied on private compute). `--devices kvm` requests host-device passthrough (the container receives `/dev/kvm` for nested virtualisation; an operator must enable it on the allowlist; only applied on private compute). Add `--no-auto-cleanup` if you do not want automatic cleanup (only an explicit kill/finish destroys it). `--shared-workspace` defaults to true and enables a shared workspace; `supports_shared_workspace` in `sandbox images` indicates whether that compute source supports one. For quick tasks that do not rely on shared data, use `--shared-workspace=false` to skip workspace seeding/write-back. |
| Shared workspace (persistence across sandboxes) | `--shared-workspace=true` (the default) enables a shared workspace: when creating a sandbox, the platform **seeds** the user's workspace data into `/workspace/{user_id}`; on `kill`/`finish` it **writes the data back**, and the next sandbox receives it automatically, allowing files to be retrieved across sandboxes. **The only persistent directory is `/workspace/{user_id}`**. Files written elsewhere (`/tmp`, `/root`, custom directories, etc.) are lost when the sandbox is destroyed, so put any results you need to keep in this directory. ⚠️ Whether data persists across sandboxes depends on whether the platform detects a pre-installed `rclone` in the image at creation time: with rclone, seeding/write-back works; without it, those steps are skipped (data is not persisted across sandboxes, but creation still succeeds). If you are unsure whether an image includes rclone, write to `/workspace/{user_id}`, destroy the sandbox and create another to check. For quick tasks that do not rely on shared data, use `--shared-workspace=false` to skip seeding/write-back. |
**Per-sandbox resource limits**: cpu ≤ 512 / memory ≤ 1024Gi / gpu ≤ 64 / gpuMem ≤ 1024Gi / shmSize ≤ memory. Requests above these limits fail quickly rather than hanging.
| Extend the lifecycle | `sandbox extend <sandbox_id> --max-life N` — **dynamically extend** a running sandbox's max-life (increase or decrease it; N must exceed the elapsed minutes and be ≤10080; use `kill`/`finish` for early cleanup; sandboxes with `--no-auto-cleanup` do not need renewal). Without `--max-life`, this command reports the current lifecycle (elapsed time, time remaining and expiry); `status` output includes a `data.lifecycle` summary (elapsed time, time remaining and expiry; omitted if the lifecycle endpoint is unavailable). |
| Connect to a sandbox | `sandbox connect <id>` |
| View status | `sandbox status <id>` |
| Finish a sandbox | `sandbox finish <id> [--results '{...}']` |
| Destroy a sandbox | `sandbox kill <id>` |
| **Command execution** | |
| Run a command synchronously (≤60s) | `sandbox run <id> --command "..." [--timeout <seconds>] [--format sse\|json] [--json-result] [--summary/--no-summary] [--artifacts]` (`--format json` = a single unified result envelope, recommended for automation). **A non-zero exit is reported as `error.type: command_failed` with process exit code 8; an unknown exit status is reported as `error.type: unknown_execution_state` with exit code 1 — the CLI never reports an unknown outcome as success** |
| Run a command in the background (>60s) | `sandbox run-bg <id> --command "..." [--timeout <seconds>] [--wait] [--cancel-on-timeout] [--format sse\|json] [--json-result] [--summary/--no-summary] [--artifacts]` (`--wait --format json` = a single unified result envelope). **If the wait times out the CLI exits non-zero with `error.type: timeout` and keeps `sandbox_id`/`execution_id`/`remote_state` in `error.details`; `remote_state: not_cancelled` means only the local wait stopped and the remote command may still be running — add `--cancel-on-timeout` to cancel it** |
| View background logs | `sandbox logs <id> [--execution-id <exec_id>] [--tail N --grep <pattern> --context N] [--stream]` (`--execution-id` is optional; if omitted, query ES by sandbox only; only `--stream` requires it) |
| Interrupt a background command | `sandbox cancel <id> --execution-id <exec_id>` |
| **Tunnelling (port exposure)** | |
| Expose a port publicly | `sandbox expose <id> [--port N]` — expose a service port inside the sandbox to the public internet and return `public_url` (`http://<host>:<remote_port>`, where the server randomly assigns `remote_port` from 20000–29999); **start the service before exposing it** (the server reports “service not ready” if its health check fails); `--port` defaults to 8700 (platform convention) |
| List active tunnels | `sandbox exposes <id>` — list the public tunnels currently active for this sandbox |
| Reclaim a tunnel | `sandbox dispose <id> --port N` — explicitly reclaim a single tunnel (stop frpc and release the public port); killing the sandbox also reclaims all its tunnels |
| **File operations** | |
| Read a file | `sandbox read <id> --path <path> [--output <local-path> --tail N --grep <pattern> --offset N --limit N --context N --max-bytes N --parse-json]` — **a full copy is byte-exact** (chunked download, sha256-verified); with `--tail`/`--grep`/`--offset`/`--limit` it uses the text channel and the envelope reports `byte_exact:false` — use `sandbox pull` for binary files |
| Pull a file/directory | `sandbox pull <id> --source <sandbox-path> --target <local-path> [--pattern <glob>] [--concurrency N] [--no-resume] [--no-verify]` — pull a single file or **recursively** pull a directory (directories are always recursive), over the **chunked** path: binary-safe, sha256-verified, resumable and parallel (the reverse of upload: source=remote, target=local) |
| View the working directory | `sandbox working-directory <id>` (returns `data.path`, such as `/workspace/{user_id}/{sandbox_id}`) |
| Write a file | `sandbox write <id> --source <filename>` (without `--path`, writes to the working directory by default); **every sandbox-side path** — `--path`, the remote part of `write-multiple --entry`, `upload --target`, `pull --source`, `run`/`run-bg --log-file` — is prefixed with the working directory when relative, while an absolute path is used as given. The content is **binary-safe** (base64) and the server verifies the declared `size`/`sha256` before writing, so the response's `server_sha256`/`size_verified` can be compared with the local file |
| Write multiple files | `sandbox write-multiple <id> --entry <remote-path>=<local-path> [--entry ...]` |
| Upload a directory | `sandbox upload <id> --source <local-directory> --target <sandbox-path>` |
| List a directory | `sandbox ls <id> --path <path>` (defaults to `.`) |
| File metadata | `sandbox stat <id> --path <path>` |
| Move/rename | `sandbox mv <id> --entry <src=dest> [--entry ...]` |
| Replace content | `sandbox replace <id> --path <path> --old <text> --new <text>` |
| Change permissions | `sandbox chmod <id> --path <path> --mode <octal>` |
| Delete files | `sandbox rm <id> --path <path> [--path ...]` |
| Delete directories | `sandbox rmdir <id> --path <path> [--path ...]` |
| Create directories | `sandbox mkdir <id> --path <path> [--path ...]` |
| Search files | `sandbox search <id> --path <root-directory> --pattern <glob>` |

## Full lifecycle

1. **Choose an image (if needed)**:
   - The compute backend (provider) is an internal detail selected automatically by the system; **users neither need to nor can specify it**.
   - If the request already specifies the image (for example, the image name in `--image-name "PyTorch CUDA13 (GPU)"`) and resources (cpu/memory/gpu, plus optional `--gpu-type`/`--shm-size`/`--devices`), **go straight to step 2 and create the sandbox**. Do not call `sandbox images` or `sandbox recommend` again.
   - Call these only when the user asks for “a configuration recommendation” or you need to check which images are available:
     - `delta-cli sandbox images` — list the images supported by the server (returns image names and hides the underlying image identifiers)
     - `delta-cli sandbox recommend --cpu N --memory XGi [--gpu N]` — recommend a resource configuration
2. **Create**: `delta-cli sandbox create --image-name <image-name> --cpu 4 --memory 16Gi --gpu 1 --gpu-mem 8000 --max-life 120`. **The returned JSON envelope contains `data.sandbox_id`, not `data.id`; all later commands must use this real `sandbox_id`.** (The sandbox is ready immediately after creation; there is no need to connect.) **The response echoes the requested image name/resources (the CLI fills in fields omitted by the server using the request values, while server values take precedence), so you can verify the resource configuration without calling status.** (The echoed image is its display name; `provider` is an internal detail and is no longer echoed.) **If this task already has a `sandbox_id`, do not create another; reuse it first.**
    - `--max-life` sets the sandbox's maximum lifetime in minutes; the default is 30. Increase it for long tasks so the sandbox is not reclaimed while a command is running.
    - **Match `--gpu-mem` (in MiB) to the model being run**: larger models and higher precision need more GPU memory; a large model in too little memory will cause an OOM. The example value 8000 (8GiB) is suitable only for small models. Estimate memory needs and increase it as appropriate before running a 7B/9B/13B model. **Meaning: `--gpu-mem` is GPU memory in MiB per card (`--gpu 2 --gpu-mem 8000` = 8000MiB per card, 16000MiB in total); `--memory` is the container's total CPU memory.**
    - **`--gpu-type <model>` (optional) selects a GPU model**: for example, `"RTX 4090"` or `H100`. This schedules the task on that GPU model. Use `sandbox resources` to see available models (`gpu_types[].gpu_name`). Specify a model only when the user explicitly requests one; otherwise, the system schedules automatically.
    - **`--shm-size <size>` (optional) increases the container's `/dev/shm`**: the default is only **64Mi**. Workloads such as PyTorch `DataLoader(num_workers>0)`, `torch.multiprocessing`/shared memory and Chromium-based engines (Playwright/Selenium) may fail with `No space left on device` / `Bus error` when shared memory is insufficient; increase it as needed (for example, `--shm-size 4Gi`). Hard constraints: **include Gi/Mi units** (`4Gi`/`512Mi`; the CLI normalises `4G`/`512M` to `4Gi`/`512Mi`, while the server rejects a bare number such as `4` with a clear error because its meaning differs from the server's); **do not exceed `--memory`** (`/dev/shm` is a memory filesystem counted against the container's memory cgroup; filling it can cause an OOMKill). Since `--memory` defaults to only `1Gi`, increasing shm usually means increasing `--memory` too (for example, `--memory 8Gi --shm-size 4Gi`). This parameter is applied only on private compute (third-party compute ignores it); however, unit and limit checks happen before creation regardless of backend, so invalid values are rejected even when using third-party compute. The create response echoes the effective `resource.shmSize` for verification.
    - **`--devices <token>` (optional) requests host-device passthrough**: a comma-separated token list (currently `kvm` is supported, which adds `/dev/kvm` inside the container), used for **nested virtualisation** workloads such as QEMU/KVM, Android emulators and Kata inside the sandbox. **This is a privilege escalation, not an ordinary resource request**: device passthrough exposes host devices to the container, so the server uses an explicit allowlist. If operations staff have not enabled it, creation is **explicitly rejected (not silently ignored)**. Do not retry or change the syntax after this error; use an approach that does not require the device. This parameter is applied only on private compute (third-party compute ignores it), but the allowlist check happens before creation regardless of backend.
    - `--no-auto-cleanup`: when this flag is set, the sandbox **will not be cleaned up automatically** (OpenSandbox gets `timeout=None`, so platform TTL and the server's periodic cleanup are both skipped). It can be destroyed only by an explicit `sandbox kill`/`finish`, and `status` reports `expires_at`/`remaining` as null. Use this only when the task genuinely needs to survive past periodic cleanup; you must destroy it explicitly when the task is done to avoid leaking resources.
    - **Do not repeatedly poll with `sandbox status` after a successful create**. The sandbox is ready as soon as `sandbox create` returns; use its returned `data.sandbox_id` directly for `write`/`run`. Extra polling adds tool calls without providing any benefit.
3. **Write code/data**:
   - **Single file**: `delta-cli sandbox write <id> --source <filename>` — omit `--path` to write to the sandbox's working directory by default (`/workspace/{user_id}/{sandbox_id}/`; query it with `delta-cli sandbox working-directory <id>`). Pass only a local filename to `--source` (for example, `--source train.py`). **Do not** use shell-variable paths such as `"$WORKSPACE_ROOT/train.py"` or `$(pwd)/train.py`. With `--source`, the CLI reads the local file itself without shell expansion, making this the safest option. If you need a specific path, a relative `--path <relative-path>` is automatically prefixed with the working directory; absolute paths are used as given (the same rule applies to every sandbox-side path: the remote part of `write-multiple --entry`, `upload --target`, `pull --source`, and `run`/`run-bg --log-file`) (**avoid** paths such as `/workspace/<filename>` outside `{user_id}`, as they do not persist after `kill`). The returned `size` field is the actual number of bytes on disk (verified with stat), so you can check that the write is complete. For small configuration files (<20 lines), you may use `--data "..."`, but you must also pass `--path`. File paths and extensions depend on the runtime in the image.
   - **Write multiple files**: `sandbox write-multiple <id> --entry <remote-path>=<local-path> [--entry ...]` (remote path is on the left of `=`, local path on the right; bulk writes with `--data` are not supported)
   - **Upload a directory**: `sandbox upload <id> --source <local-directory> --target <sandbox-path>` — the CLI packages the local directory as tar.gz and uploads it using multipart/form-data; the server extracts it into the target directory. The response lists each file's path, size and mode. After upload, the CLI checks the local and remote file lists for integrity and warns about mismatched sizes, extra files and similar issues.
     - **Note**: `--source` is a **local directory path**; `--target` is the **target directory inside the sandbox**. The target directory is created if it does not exist.
     - Nested directories are supported, and empty directories are created too.
     - **Optional post-write check**: use `sandbox stat <id> --path <path>` to confirm that the file exists and its size is as expected. **Do not** use `sandbox ls` plus `sandbox read` to read the just-written file back to the host and compare it character by character; if there is no issue, no read-back is needed.
4. **Run the command**:
    - **Short task (expected to take ≤ 60 seconds)**: run synchronously with `delta-cli sandbox run <id> --command "<command>" --timeout <seconds>`. The command's stdout/stderr is passed to stdout over SSE as **raw `data:` frames, one at a time** (with no trailing envelope). Read `exit_code` / `log_file` / `execution_id` / `stdout_tail` / `stderr_tail` / `duration_seconds` from the `complete` frame. For automation, add `--format json` (or `--json-result`) so the CLI emits a single unified result envelope instead of making you stitch frames together yourself. After completion, the full `stdout` is written to the run-envelope log file (the `log_file` field); use `sandbox read` to read it in full or extract trailing JSON. **Do not** then call `sandbox logs`. You can customise the run-envelope log path with `--log-file <path>`; the default is `/workspace/{user_id}/sandbox_logs/delta-result-{sandbox_id}-{execution_id}.json` (use the server-returned `log_file` field as authoritative). A script written with `sandbox write` is in the working directory; run it using its full path, `<working-directory>/<filename>` (first query `sandbox working-directory <id>`). Build the command for the runtime in the image. Common examples (where `<wd>` is the working directory):
     - Python: `python <wd>/train.py`
     - Node.js: `node <wd>/app.js`
     - Go: `go run <wd>/main.go`
     - Shell: `bash <wd>/run.sh`
    - **Long task (expected to take > 60 seconds, such as a model download, training, compilation or large-scale data processing)**: submit it in the background with `delta-cli sandbox run-bg <id> --command "<command>" --timeout <seconds> [--log-file <path>]`. Once you have the `execution_id`, retrieve the result with one of these commands:
        - `delta-cli sandbox logs <id> --execution-id <execution_id> --stream` — follow the task in real time over SSE, passing raw `data:` frames through to stdout until the `complete` event (including `exit_code`/`log_file`), with no trailing envelope (`--stream` requires `--execution-id`).
        - `delta-cli sandbox logs <id> --execution-id <execution_id>` — returns a snapshot envelope with `stdout_tail` (last 800 bytes), `stderr_tail` (last 200 bytes), `stdout_size`, `stderr_size`, `cursor`, `running`, `finished`, `exit_code` and (after completion) `log_file`. Treat it as complete when `finished=true`; read `log_file` for the full output. You may omit `--execution-id`; if omitted, the server queries by sandbox only and automatically uses ES because `sandbox_id`/`execution_id` were not both supplied, returning an **array** aggregated by execution ID.
            Do not use synchronous `sandbox run` for long tasks.

   **Recommended practice**: have the sandbox script print a standalone structured JSON object at the end of `stdout` (for example, `{"status":"ok", ...}`). On the SSE path, the CLI detects this trailing JSON and includes it as `result_summary` in the `complete` frame. **When the task ends, reuse the `result_summary` from the complete frame directly in `result.json`**; there is no need to scan `log_file` again with `sandbox read`. Only if `result_summary` is missing from the complete frame (no valid trailing JSON) should you read `sandbox read <id> --path <log_file>` and scan backwards as described in step 5, avoiding a request for the model to “read the whole log and summarise it”.
5. **Create result.json** (prefer the SSE path: reuse `result_summary` from the complete frame; only read and parse `log_file` if it is missing):
    - **Get the `log_file` path**: the SSE `complete` frame from `run` / `run-bg --wait` contains a `log_file` field (the CLI fills it in as a fallback); the `sandbox logs <id> --execution-id <eid>` snapshot also returns `log_file` once `finished=true`. Parse it as below only when you need to read it:
      - `sandbox read` returns a CLI envelope `{"ok":true,"data":{"content":"..."}}`; the actual result JSON is in the `data.content` field.
      - **Do not write the CLI envelope or the full, lengthy `stdout` verbatim to local `result.json`**; parse it and create a concise structured summary.
      - **Recommended approach (to avoid heredoc quoting failures)**: first use the available shell to save the envelope to a temporary file, then use `python3` (or `python_repl`) to read that file and create `result.json`. **Do not** pipe the output of `delta-cli sandbox read` directly into an inline heredoc; combining a pipe and heredoc is very likely to fail due to shell escaping/quoting.
        1. Save the envelope in the available shell (Bash syntax example):
           ```bash
           delta-cli sandbox read <sandbox_id> --path <log_file> > /tmp/_delta_result_envelope.json
           ```
        2. `python3` / `python_repl` creates `result.json`:
           ```python
           import json, os

           env = json.load(open("/tmp/_delta_result_envelope.json", encoding="utf-8"))
           raw = json.loads(env["data"]["content"])

             # Reduce this to the minimal fields the user cares about, to avoid truncation in the host's read_file preview
            concise = {
                "exit_code": raw.get("exit_code"),
                "finished": raw.get("finished"),
                "summary": {},
                "error": raw.get("error"),
            }

           # Prefer the standalone JSON object at the end of stdout as the summary
           stdout = raw.get("stdout", "")
           for line in reversed(stdout.strip().splitlines()):
               s = line.strip()
               if s.startswith("{") and s.endswith("}"):
                   try:
                       concise["summary"] = json.loads(s)
                       break
                   except Exception:
                       pass

           # Build result_summary as a one-line string and use it directly in the final RESULT: line
           parts = [f"exit_code={concise['exit_code']}", f"finished={concise['finished']}"]
           for key, value in concise["summary"].items():
               # Avoid putting long text in result_summary
               if isinstance(value, (str, int, float, bool)) and len(str(value)) < 200:
                   parts.append(f"{key}={value}")
           concise["result_summary"] = ", ".join(parts)

           ws = os.environ.get("WORKSPACE_ROOT", ".")
           with open(os.path.join(ws, "result.json"), "w", encoding="utf-8") as f:
               json.dump(concise, f, indent=2, ensure_ascii=False)
           print(concise["result_summary"])
           ```
        3. If `python3` is not available in the current environment, use `jq`, `node` or any JSON-capable tool to implement **the same logic**: 1) read `/tmp/_delta_result_envelope.json`; 2) unwrap the CLI envelope and get `data.content`; 3) parse the inner JSON; 4) extract the summary JSON from the end of `stdout`; 5) build `result_summary` and write `result.json`.
      - If `stdout` is very large (training or download logs, etc.), do not put all of it in `result.json`; keep only key metrics and a preview.
      - The complete raw output remains in the sandbox's `log_file` and can be retrieved again with `sandbox read` if needed.
    - The purpose of writing a local copy is to let the host's deliverable check find an actual `.json` file. Since the check uses OR semantics, a `.json` file takes precedence over a `.cuda` file commitment mistakenly inferred from tokens such as `torch.cuda`.
6. **Destroy the sandbox**: `delta-cli sandbox kill <id>` (if you need to save results, use `sandbox finish --results '{...}'` instead of kill; finish destroys the sandbox automatically)

For the detailed steps, see [lifecycle.md](references/lifecycle.md).

## Tunnelling (port exposure)

Expose a service port inside the sandbox to the public internet so the user can access it directly through `public_url`. How it works: inside the sandbox,
`frpc` opens an outbound connection to the public `frps` server, which forwards TCP traffic from a randomly assigned public port (20000–29999)
back to the service in the sandbox. **No per-sandbox port configuration is needed on the host** (this uses a reverse connection).

Available commands:

| Command | Purpose |
|------|------|
| `sandbox expose <id> [--port N]` | Expose a port and return `public_url`; `--port` defaults to **8700** (platform convention), so you can omit it |
| `sandbox exposes <id>` | List the tunnels currently active for this sandbox (service_port / remote_port / public_url) |
| `sandbox dispose <id> --port N` | Explicitly reclaim one tunnel (stop frpc and release the public port) |

Follow this order and these conventions:

1. **Start the service before exposing it**. Before running `expose`, the service must be listening inside the sandbox (bound to `0.0.0.0`, not
   only `127.0.0.1`), and the server checks `127.0.0.1:{port}` for health — **any HTTP response
   (including 4xx/5xx) counts as alive**; only a connection failure or timeout reports “service not ready”.
2. **Keep long-running services in the foreground**: with `run-bg`, make the service process the task's foreground process,
   **Do not** background it with `nohup ... &` (the background process is reclaimed when the task ends, so the service disappears):

   ```bash
   delta-cli sandbox run-bg <id> --command "cd <wd> && exec python3 -m http.server 8700 --bind 0.0.0.0" --timeout 3600
   delta-cli sandbox expose <id>   # --port defaults to 8700; no need to pass it
   ```

3. **Tunnels are reclaimed automatically with the sandbox lifecycle**: when the sandbox is killed, a server hook marks the tunnel record as closed,
   and frps automatically releases the public port when the frpc connection closes; use `dispose` to reclaim a tunnel without destroying the sandbox.
   **Exposed ports are fully open to the public internet, so the service itself must require authentication**; do not leave it unprotected.
4. If the public URL is unreachable, troubleshoot in this order: (1) check whether the service is listening inside the sandbox (`curl 127.0.0.1:{port}`; you can test first with
   `sandbox run`); (2) check whether the `frpc` process is alive (`ps aux | grep frpc`); (3) check connectivity to the public `frps` host;
   (4) check whether the security group allows the service port range; (5) confirm that the frpc and frps tokens match.

## General structured-output convention

This convention applies to **all** `delta-sandbox` tasks (GPU/CPU, training/inference/compilation/data processing, etc.). Its purpose is to let the Runner read the result directly from `result.json` without parsing long logs again.

### What sandbox scripts/commands should output

After the command finishes, it is recommended to print a standalone line of **structured JSON** at the end of `stdout`. For example:

- CUDA check: `{"status":"ok","torch_version":"2.5.1+cu121","cuda_available":true,"device_name":"NVIDIA H100 80GB HBM3"}`
- Training task: `{"status":"ok","epochs":10,"final_loss":0.12,"final_accuracy":0.94,"model_file":"<wd>/model.pt"}`
- Data processing: `{"status":"ok","input_rows":10000,"output_rows":9876,"output_file":"<wd>/output.csv"}`

This lets the skill extract the result into the `summary` field of `result.json` with the same code, then produce the `RESULT:` line.

- **Do not** print redundant marker lines such as `FINAL_ANSWER: ...` to stdout; they may cause the Runner to mistake ordinary text for a result field.
- Do **not** use schema-duplicate keys such as `final_answer` in `summary`. Use fields that describe the result, for example `generated_text`/`output`/`result` for inference, `final_loss`/`final_accuracy` for training, and `output_file`/`output_rows` for data processing.

### General local `result.json` schema

```json
{
  "exit_code": 0,
  "finished": true,
  "summary": {},
  "result_summary": "exit_code=0, status=ok, torch_version=..., ...",
  "error": null
}
```

Key fields:
- `summary`: the structured result object printed by the command.
- `result_summary`: a **one-line string** matching the final answer's `RESULT:` line, so the Runner can read it directly.
- `error`: error information when the command fails; usually `null` on success.
- **Do not include the full `stdout`**. The complete log remains in the sandbox's `log_file`.

## Reading output and final-answer format

1. **On the SSE path, the `complete` frame from `sandbox run` / `run-bg --wait` includes `result_summary`** (injected by the CLI when it detects trailing JSON) and `stdout` / `stderr` / `log_file` (filled in by the CLI as a fallback). Read `exit_code` / `log_file` / `execution_id` from the complete frame. On command failure, an `error.type: command_failed` envelope is appended after the complete frame (process exit code 8). The `log_file` path can also be obtained from a `sandbox logs <id> --execution-id <eid>` snapshot after `finished=true`.
2. **Extract the summary**: prefer reusing `result_summary` from the complete frame directly. If it is missing, read the run-envelope log file with `sandbox read <id> --path <log_file>`, parse it and scan backwards through trailing stdout JSON to produce `result_summary` (see step 5 in “Full lifecycle”).
   - The run-envelope log file contains the full `stdout`, `stderr`, `exit_code`, `finished`, `command` and `error`.
3. **Create a concise local `result.json`** (see step 5 in “Full lifecycle” and “General structured-output convention”). The local copy should contain only key fields and a summary, **not the full, lengthy `stdout`**.
4. **The final answer must be a single line beginning with `RESULT:`.**
   - Prefer reusing the `result_summary` field in `result.json` directly:
     ```text
     RESULT: <result_summary from result.json>
     ```
   - If `result_summary` is missing, build one line from the `summary` object, for example:
     ```text
     RESULT: exit_code=0, status=ok, torch_version=2.7.0+cu128, cuda_available=True, device_name=NVIDIA GeForce RTX 3090.
     ```
5. **`final_response` must begin with `RESULT:`**
   - **The first character must be `R`, immediately followed by the `ESULT:` prefix**; the entire response must be a single line, `RESULT: <result_summary>`, with no preceding natural language, blank lines, transition or progress report.
   - Reason: the host Runner and downstream LLM recognise a `final_response` beginning with `RESULT:` by default, then pass the content after it to the user as the task result. Any preceding text—including neutral status updates such as “Sandbox destroyed”, “Task complete” or “Full lifecycle complete”—makes the Runner treat `final_response` as a process extract rather than the final result. It may then show a failure message such as “No specific result.json content was included” and lose the actual result.
   - Correct: `RESULT: exit_code=0, cuda_available=True, torch_version=2.5.1+cu121, device_name=NVIDIA H100 80GB HBM3`
   - Incorrect (prefix contamination; a real example): `Sandbox destroyed successfully. The full lifecycle is complete: create → write → run → generate result.json → destroy.\n\nRESULT: torch_version=2.5.1+cu121, cuda_available=True, ...` — after seeing the “Sandbox destroyed successfully...” prefix, the Runner stopped reading before the later `RESULT:` line, and the user saw “No specific result.json content was included”.
   - Incorrect: `Sandbox killed successfully. Final answer with result summary. RESULT: ...`
   - Incorrect: `Sandbox killed. Task done. Need final answer exactly RESULT: line from result_summary. RESULT: ...`
   - Incorrect: `The user wants me to verify CUDA... RESULT: ...`
   - Incorrect: `Summary: ... RESULT: ...`
   - Incorrect: adding extra sentences after `RESULT:`, such as `Let me know if you need anything else.`
6. **Do not rely on `stdout`/`stderr` fields that may be truncated**; key conclusions must come from `summary` / `result_summary` in `result.json`.
7. **Do not call any more tools after `sandbox kill` succeeds**. A kill response of `{ok:true}` means the task is finished; the **next turn's `final_response` must strictly follow rule 5 and begin with `RESULT:`**. Do not put any transition or progress report before `RESULT:`, including “Sandbox destroyed successfully”, “Full lifecycle complete”, “Task complete” or “Sandbox killed”; the Runner does not need these details, and they would push `RESULT:` later in `final_response`, risking the lost-result problem described in rule 5. Do not call any shell, `read_file` or `ls` tool again, and do not start with an internal monologue such as “Need final answer exactly...”.

## Host / Planner call guidance

This skill is designed to make the conclusion self-contained: when execution ends, **`result.json`'s `result_summary` and `final_response` already contain the user-facing conclusion**. Therefore:

- When the **Planner** calls this skill in a plan step, `required_outputs` must include `.json` (see “Request wording conventions” above).
- After receiving the skill result, the **host (host / Runner / finalize stage)** should use `final_response` or `result_summary` in `result.json` directly as the final answer. **Do not ask the model to read `result.json`, verify its contents or reason again.**
- If the host is concerned that the content may be untrusted, it may inspect `result.json`, but the **final output must still be a single line beginning with `RESULT:`**. Do not expose reasoning such as “I need to read the file to verify it” or “Wait, I don't have...” to the user.

## Common recovery

| Error / symptom | Recovery action |
|-------------|----------|
| `error.type: not_found` | Check whether `sandbox_id` is correct and whether the sandbox has been killed |
| `error.type: network` | Check `base_url` and network connectivity |
| `error.type: validation` | Check parameter formats and required flags |
| `error.type: auth / permission` | Follow the permission-denied guidance in delta-shared |
| `error.type: api` (5xx) | Server error; check the API service status |
| `sandbox create` failed | Read `error.hint` — it states the cause and the next step (for example, the image was not cached on the target node, so the initial pull exceeded the readiness timeout: retry once, or pick a GPU type whose node already has the image). A failed create leaves no sandbox behind, so retrying is safe. `error.request_id` identifies the failure in the server log. |
| Command execution failed (`exit_code ≠ 0`) | Check stdout/stderr returned by `run` |
| Command timed out | Increase `--timeout` or use `run-bg` |
| `error.type: internal` | Client-side internal error; check the delta-cli version or contact the maintainer |
