> **Prerequisite:** Read [`../../delta-shared/SKILL.md`](../../delta-shared/SKILL.md) first for authentication, configuration and general error handling.

# Command reference

## Discovery

| Command | Description |
|------|------|
| `sandbox list [--status <running/finished/killed/error>] [--start-time <ISO8601>] [--end-time <ISO8601>] [--sandbox-id <id>] [--days N]` | List the current user's sandboxes (unlike `ls`, this lists **sandbox instances**); filter by status, time or sandbox_id. Time-range precedence: start_time/end_time > days > the default of 7 days. **Filtering by compute backend (provider) is no longer supported**—provider selection is an internal detail and is automatic. |
| `sandbox resources` | Show the resources currently **available to request** in each compute group (GPU/VRAM/cores). In the response, `compute_sources[].source` is `private` or `third_party`; the `gpu_types` structure varies by group—`private` has `total/used/available` for `vgpu`/`core`/`memory_mib`, while `third_party` has `gpu_name`/`total_gpu_num`/`idle_gpu_num`. |
| `sandbox images` | List available images (returns the **image name**; the underlying image identifier is hidden from users). With an older server using the "original logic", the response contains the internal image name (URI), which can be passed directly to `--image-name` to create a sandbox successfully. A server using the new logic returns a sanitised display name. |
| `sandbox recommend --cpu N --memory XGi [--gpu N] [--gpu-mem N]` | Recommend a resource configuration (`--memory`/`--gpu-mem` accept g/m/G/M formats, such as `1G`/`512M`; the CLI converts these to Gi/Mi automatically). |

## Lifecycle

| Command | Description |
|------|------|
| `sandbox create --image-name <image-name> [--cpu N --memory XGi --gpu N --gpu-mem N --gpu-type <model> --shm-size XGi --devices kvm --max-life M --no-auto-cleanup]` | Create a sandbox container (`--image-name` takes an image name, such as `"PyTorch CUDA13 (GPU)"`; the underlying image identifier is hidden from users. `--gpu-type` selects a GPU model, such as `"RTX 4090"` or `H100`; the server maps this to the HAMi use-gputype annotation for model-based scheduling. To see available models, check `sandbox resources` (the `third_party` group's `gpu_types[].gpu_name`); if omitted, scheduling is automatic. `--no-auto-cleanup` prevents automatic cleanup; the sandbox can then be destroyed only with an explicit kill/finish); `--memory`/`--gpu-mem` accept g/m/G/M formats (for example, `1G`/`512M`; lowercase is also accepted), which the CLI converts to the `Gi`/`Mi` units accepted by the server; `--shm-size` increases the container's `/dev/shm` (the **default is only 64Mi**; it must be increased if PyTorch `DataLoader(num_workers>0)`/`multiprocessing`, Chromium-based engines or similar report `No space left on device`/`Bus error` because shared memory is insufficient; **a Gi/Mi unit is required** (`4G`/`512M` are normalised by the CLI; the server rejects a bare number); it **must not exceed `--memory`** (it is a memory filesystem and filling it causes OOMKill; `--memory` defaults to only `1Gi`, so increasing shm usually requires increasing memory too); validation is backend-independent and rejects invalid values before creation, but this setting is applied only on private compute (third-party compute ignores it); `--devices` requests host-device passthrough using comma-separated tokens (for example, `kvm` makes `/dev/kvm` available inside the container for nested virtualisation; this raises privileges, and if the server allowlist is not enabled, creation is **explicitly rejected** rather than silently ignored; this setting is applied only on private compute); **resource limits per sandbox**: `--cpu` ≤ 512, `--memory` ≤ 1024Gi, `--gpu` ≤ 64, `--gpu-mem` ≤ 1024Gi, and `--shm-size` ≤ `--memory`. Exceeding a limit returns a **validation error promptly at request time** (it does not hang); normal tasks are well below these limits. The response echoes the requested image name/resource (request values fill fields not returned by the server; server values take precedence); compute backend is an internal detail and is selected automatically, so `--provider` is no longer supported. |
| `sandbox connect <id>` | Connect to an existing sandbox. |
| `sandbox status <id>` | Check sandbox status (running / done). |
| `sandbox finish <id> [--results '{...}']` | Save results and destroy the sandbox automatically. |
| `sandbox kill <id>` | Destroy the sandbox immediately without saving results. |

## Command execution

| Command | Description |
|------|------|
| `sandbox run <id> --command "..." [--timeout N] [--summary/--no-summary] [--artifacts]` | Run a command synchronously (live SSE stream; raw `data:` frames are passed through to stdout one by one; **there is no trailing envelope on success**; the CLI fills in `exit_code`/`execution_id`/`log_file`/`stdout`/`stderr`/`result_summary` in the `complete` frame; **if the command exits non-zero or errors, an `error.type: command_failed` envelope is appended and the process exits non-zero**; the envelope's `message` includes the stderr tail, as does the message in a `type:"error"` frame on a best-effort basis). `--summary`/`--artifacts` take effect only on the legacy-server fallback path (when there is no SSE endpoint and a `CommandResult` envelope is returned). |
| `sandbox run-bg <id> --command "..." [--timeout N] [--wait] [--summary/--no-summary] [--artifacts]` | Run a command in the background. Without `--wait`, return `{execution_id, sandbox_id}` immediately. With `--wait`, follow the live SSE stream until `complete` (raw `data:` frames are passed through to stdout; the CLI fills in `log_file`/`stdout`/`stderr`/`result_summary` in the `complete` frame; **on command failure, a `command_failed` envelope is appended and the process exits non-zero**; the envelope's `message` includes the stderr tail; on timeout, a `finished=false` snapshot envelope is appended). `--summary`/`--artifacts` take effect only on the legacy-server fallback path. |
| `sandbox logs <id> --execution-id <eid> [--tail N --grep <pattern> --context N] [--stream]` | Retrieve background-command logs. **By default, returns `stdout_tail` (last 800 bytes) + `stderr_tail` (last 200 bytes) + `stderr_size` + `cursor`**, about 1 KB in total, to keep context small. `--stream` follows the live `/logs/stream` SSE endpoint, passing raw `data:` frames through to stdout until `complete` (the CLI fills in `stdout`/`stderr`/`log_file`/`result_summary` in the complete frame; there is no trailing envelope). `--tail N` applies to both stdout and stderr (last N lines from each); `--grep <pattern>` filters both stdout and stderr (regular expression); `--context N` includes N lines before and after each grep match (for both stdout and stderr). The `cursor` field has no `omitempty` and is always present, even when 0. Snapshots include `last_updated` (filled by the CLI on the SSE path; the server snapshot path is awaiting a server-side update). **If `--execution-id` is omitted, query by sandbox** (the server uses ES); the response is an **array** grouped by execution_id (each item contains `execution_id`/`stdout`/`stderr`/`exit_code`/`command`/`finished`/`error`/`log_file`), and the CLI applies the same tail/grep trimming to each item. |
| `sandbox cancel <id> --execution-id <eid>` | Interrupt a background command that is running. |

## File operations

| Command | Description |
|------|------|
| `sandbox read <id> --path <path> [--output <local-path>] [--tail N] [--grep <pattern>] [--offset N] [--limit N] [--context N] [--max-bytes N] [--parse-json]` | Read a file; returns `content` + `size` + `content_length`. `--output <path>` saves it locally; `--tail`/`--grep` filter the output. For non-UTF-8 files, the CLI automatically falls back to base64. |
| `sandbox working-directory <id>` | Get the sandbox's current working directory (absolute path `/workspace/{user_id}/{sandbox_id}`). |
| `sandbox write <id> [--path <path>] --source <filename>` | Write a file (recommended). If `--path` is omitted, write to the working directory (`<working-directory>/<filename>`); a relative `--path` is also resolved under the working directory. An absolute `--path` is used as-is (but the `/workspace/<filename>` root path is outside the OSS sync scope and is not recommended). |
| `sandbox write <id> --path <absolute-path> --data "..."` | Write a small amount of inline content (`--data` has no source filename, so `--path` must be specified explicitly). |
| `sandbox write-multiple <id> --entry <src=path> [--entry ...]` | Write multiple files in one operation (a relative target `path` is also resolved under the working directory). |
| `sandbox pull <id> --source <sandbox-path> --target <local-path> [--recursive] [--pattern <glob>]` | Pull files/directories to the local machine (the reverse of `upload`; flag directions are reversed: `--source`=remote sandbox path, `--target`=local path). Single files are detected automatically; directories are traversed recursively by default; SHA-1 integrity is checked by both the CLI and server. |
| `sandbox ls <id> --path <path>` | List directory contents (defaults to `.`). |
| `sandbox stat <id> --path <path>` | Get file metadata (size / mode / owner / group). |
| `sandbox mv <id> --entry <source=dest> [--entry ...]` | Move or rename files. |
| `sandbox replace <id> --path <path> --old <text> --new <text> [--regex] [--ignore-case]` | Replace file contents. |
| `sandbox chmod <id> --path <path> --mode <octal>` | Change file permissions. |
| `sandbox rm <id> --path <path> [--path ...]` | Delete files. |
| `sandbox mkdir <id> --path <path> [--path ...]` | Create directories (`mkdir -p`). |
| `sandbox search <id> --path <root-directory> --pattern <glob>` | Search for files. |

## Notes

- `list` ≠ `ls`: `sandbox list` lists sandbox instances; `sandbox ls <id>` lists directories inside a sandbox.
- **Compute backend (provider) is an internal detail**: the system selects it automatically, and commands no longer support `--provider`. The `sandbox providers` command was retired when the server's `/providers` endpoint was removed; calling it returns 404. Do not use it.
- After writing a file, the returned `size` is the actual on-disk byte count verified with stat.
- Reading a file returns `size` (disk bytes, from stat) and `content_length` (characters in memory); comparing them can reveal encoding differences.
- Reading a non-existent file returns an error rather than silently returning empty content.
