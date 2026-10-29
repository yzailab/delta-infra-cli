---
name: delta-shared
description: "delta-cli shared global rules: configuration and authentication checks, security boundaries, error handling, and sandbox destruction."
---

# delta-cli Shared Rules

General guidance for AI agents using `delta-cli`. Core principles: **check, do not guess or expose credentials**.

## Before any operation

1. Verify the server address:
   ```bash
   delta-cli config show
   ```
2. Inspect the local authentication configuration:
   ```bash
   delta-cli auth status
   ```

- If `auth status` reports `method: token` or `method: apikey`, a credential is configured locally; **run the requested command directly without logging in or initialising configuration again**.
- `auth status` reads local configuration and environment overrides; it does not validate the credential with the remote server. If it reports `method: none`, follow “Complete configuration” below. If a requested command returns `error.type: auth` or `permission`, follow the matching recovery action below.

## Complete configuration

If the server address or credentials are missing, **ask the user once**, then initialise with the flag that matches the credential type:

```bash
delta-cli config init --base-url <server-url> --token <token>
# For an API key:
delta-cli config init --base-url <server-url> --apikey <api-key>
```

Do not use interactive `config init` (without flags), as it may hang when stdin is unavailable.

### Priority of information sources

1. Environment variables: `DELTA_INFRA_BASE_URL`, `DELTA_INFRA_TOKEN`, `DELTA_INFRA_API_KEY`
2. `base_url`, `token`, and `apikey` in `~/.delta-infra/config.json` (environment values override file values)
3. Default value: only `base_url` has an internal default
4. If none of the above are available, **you must ask the user**; do not make anything up

### Runtime credentials

The CLI sends the effective credential in the `Authorization: Bearer <credential>` header; an API key takes precedence over a token when both are configured. It adds `X-User-Uid` when it can parse a `uid` from the credential as an unverified JWT.

## Querying user information and remaining credits

```bash
delta-cli usage
```

This returns the current user's information and remaining credits (through the gateway `/infra/api/users/me`; the CLI automatically attaches the configured credentials). Keep only these three fields in the output:

- `data.display_name`: display name (fall back to `user_id` if missing)
- `data.user_id`: user ID
- `data.resources.credit`: remaining balance in credits

`username`/`id`/`email`/`role`/`quota`/`group`/`tier`/`status`/`created_at`/`is_admin`, `stats` and its `total_consumed_credits` (in the database's original quota units) are internal fields and must not be exposed externally.

## Security rules

- **Never output credentials**: token and API key values must not appear in logs, messages or the terminal.
- **Never construct URLs or make HTTP requests yourself**: route all requests through `delta-cli`.
- **Do not install the CLI proactively**: if the user says it is not installed, direct them to the README or `install.sh`; do not choose an installation method yourself.
- **Confirm intent before write or delete operations**: tell the user what commands such as `sandbox kill`, `sandbox finish` and `sandbox write` will affect.
- `~/.delta-infra/config.json` must have `0600` permissions; do not loosen them manually.
- **The sandbox must be destroyed explicitly**: after calling `sandbox create`, call `sandbox kill` before the current task ends (use `finish` when results must be preserved). Sandboxes do get reclaimed automatically (default `--max-life` is 30 minutes; OpenSandbox starts the clock when create is accepted and the platform reclaims, while AutoDL/RunPod start at readiness and the server reclaims at max-life plus up to 10 minutes of grace), but the platform may reclaim early and automatic reclamation does not write back to OSS — relying on it loses artifacts. Do not skip destruction, even if an error occurs.

## JSON output conventions

```json
{"ok":true,"data":{...}}
{"ok":false,"error":{"type":"auth","message":"...","hint":"...","request_id":"..."}}
```

AI agent parsing rules:
- Always check `ok`; do not rely on the exit code alone.
- `error.type` is the stable field for branching on: `auth`, `permission`, `not_found`, `validation`, `network`, `api`, `command_failed`, `timeout`, `unknown_execution_state`, `internal`.
- `error.hint` may be shown to the user. **Act on it rather than retrying blindly**: for a failed `sandbox create` the hint names the concrete cause and the next step (for example, the image was not cached on the target node — retry, or pick a GPU type whose node already has the image).
- `error.request_id` identifies the same failure in the server log; quote it when reporting the failure.

## Exit code conventions

| Type | Exit Code | Scenario |
|------|-----------|----------|
| validation | 2 | Invalid flag or argument |
| auth | 3 | Not authenticated or authentication failed |
| permission | 4 | Insufficient permissions |
| not_found | 5 | Sandbox or file does not exist |
| network | 6 | DNS, timeout or connection failure |
| api | 7 | Server returned a non-2xx response |
| command_failed | 8 | Command failed inside the sandbox (non-zero `exit_code` or an error); on the SSE path, an error envelope is appended after the `complete` frame, with the stderr tail in `message` for quick reference |
| timeout | 11 | A local wait deadline elapsed (`sandbox run-bg --wait`): the remote command may still be running — `error.details` keeps `sandbox_id`, `execution_id` and `remote_state` (`not_cancelled` / `cancelled` / `cancel_failed`) so it can be queried or cancelled |
| unknown_execution_state | 1 | The command's outcome is **unknown** (the stream ended before the `complete` frame, or only an error frame arrived). Never treat this as success and never guess the exit code |
| internal | 10 | Internal client error |

## Upgrade check

After completing the user's request, if the JSON contains `_notice.update`, you may recommend:

```bash
delta-cli upgrade
```

## Common recovery actions

| Error / symptom | Recovery action |
|-------------|----------|
| `error.type: auth` / `method: none` | Check the server address and local credential configuration. If no credential is configured or the server rejects it, ask the user once for a credential; use `--apikey` for an API key or `--token` for a bearer token, or set the matching `DELTA_INFRA_API_KEY` / `DELTA_INFRA_TOKEN` environment variable. |
| `error.type: permission` | Check whether the current credential has sufficient permissions; if needed, ask for a credential with the required permissions. |
| `error.type: not_found` | Check `sandbox_id` / path |
| `error.type: network` | Check `base_url` and network connectivity |
| `error.type: validation` | Check required flags and argument formats |
| `error.type: command_failed` | Command failed inside the sandbox: the envelope's `message` already includes the stderr tail to help locate the issue quickly; the full `stderr` / `result_summary` are in the `complete` frame. Retry or correct the command |
| `error.type: timeout` | A local wait deadline elapsed, **not** a command failure. Read `error.details.execution_id` and query it with `sandbox logs <id> --execution-id <exec_id>`; cancel the still-running command with `sandbox cancel <id> --execution-id <exec_id>` (or re-run with `--cancel-on-timeout` so the CLI cancels it for you) |
| `error.type: unknown_execution_state` | The remote outcome is unknown — the CLI will not guess. Re-check the command with `sandbox logs <id> --execution-id <exec_id>` (the execution id is in the error details) before deciding whether it succeeded |
| `sandbox create` failed (`error.type: api` with a specific `hint`) | Follow the hint — it names the cause and the next step. "the image may not be cached on the target node" → retry once (the pull continues in the background, so later creates succeed) or pick a GPU type whose node already has the image. "check the target node's free disk space" → a retry will not help until an operator frees the node. A failed create leaves no sandbox behind, so retrying is safe. Quote `error.request_id` when reporting it. |
| Configuration file parsing failed | Check that `~/.delta-infra/config.json` contains valid JSON |
