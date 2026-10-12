# Quantum ESPRESSO DFT reference

Use QE to run traceable, asynchronous Quantum ESPRESSO workflows through Chemistry Gateway.
The agent interacts only with the Gateway/Science Server contract: it does not run local `pw.x`,
call internal QE containers, or submit shell commands, scheduler scripts, `pseudo_dir`, `outdir`
or host paths.

The actual CLI tool for this reference is `qe`. Copy `tools.name` and `tool_endpoints.name`
exactly from the current CLI catalogue. The paths below describe the QE service contract; they
are not URLs to access directly or endpoint aliases that may be rewritten automatically.

## Capability groups

| Service path | Purpose | Type |
| --- | --- | --- |
| `/chem/qe/health`, `/healthz`, `/readyz` | Runtime, scheduler, storage and PP readiness | Read-only |
| `/chem/qe/v1/qe/workflow-types` | Workflow catalogue and support status | Read-only |
| `/chem/qe/v1/pp-sets`, `/pp-locks/{digest}` | Published PP profiles/locks | Read-only |
| `/chem/qe/v1/pp-sets:resolve` | Resolve PP candidates for the complete set of campaign elements | Read-only/validation |
| `/chem/qe/v1/artifacts` | Upload, query and download structure/fixed-coordinate artifacts | File/binary |
| `/chem/qe/v1/qe/jobs` | Submit asynchronous calculations and query jobs | Remote mutation |
| `/chem/qe/v1/qe/jobs/{job_id}/events`, `steps`, `logs`, `artifacts` | Read job progress and results | Read-only |
| `/chem/qe/v1/qe/jobs/{job_id}:cancel`, `:retry`, `:review` | Cancel, retry and scientifically review a job | Remote mutation |

When selecting a new operation, first run:

```text
delta-cli science list
delta-cli science endpoints list <exact tool name>
```

Then call it using the exact names returned by the catalogue. If the catalogue has no schema, do
not guess the operation, path parameters, headers or body.

## CLI file and idempotency boundaries

Structure artifact uploads require `application/octet-stream` and query metadata; QE job
submission requires a stable `Idempotency-Key`. `science invoke` remains for JSON/query only;
send files through `science file` and persistent jobs through `science task`:

- `delta-cli science file invoke --tool qe --endpoint artifact-upload --file <path>` uploads
  a structure artifact; for `custom-pp-upload`, also provide `custom_pp_id` in `--data`;
- `delta-cli science task submit --tool qe --operation job-submit --input JSON
  --idempotency-key KEY` submits a durable QE job; the worker passes the idempotency key to Gateway;
- `delta-cli science file download --tool qe --endpoint artifact-content --params JSON
  --output <path>` downloads a raw artifact;
- Do not send structure text, file paths, base64, `Idempotency-Key` or QE service credentials as
  ordinary business fields, and do not call public or private Gateway URLs or `qe-cloud-compute:18020`.

## Correct sequence for a new job

1. Read health. Read readiness only when diagnosing the deployment, and choose a currently
   `supported` task from the workflow catalogue.
2. Determine the complete `campaign_elements` set and use `pp-sets:resolve` to obtain a profile.
   Production jobs must use the returned `pp_set_id` and immutable `lock_id`; do not infer the
   lock from the profile name alone.
3. Ask the service to validate the structure artifact. The job must reference only the returned
   `sha256:<digest>` artifact ID.
4. Submit to `qe/jobs` with stable idempotency semantics. A `202` response means accepted/queued,
   not that QE has converged.
5. Poll the job, events, steps, logs and artifacts; read the `execution`, `solver` and
   `scientific` states independently.
6. Verify each artifact's SHA-256 when downloading results. Report the selected backend, resource
   telemetry, solver state, scientific review state and warnings separately.

The minimum business-data shape for PP resolution is shown below. Values must come from the
current service/catalogue; do not insert a fabricated production lock:

```json
{
  "campaign_id": "si-bulk-scf-v1",
  "campaign_elements": ["Si", "O"],
  "workflows": ["qe.pw.scf"],
  "explicit_mode": null
}
```

The core job structure is shown below. `workflow_inputs` must follow the current task schema:

```json
{
  "task": "qe.pw.scf",
  "schema_version": "1.1",
  "campaign_id": "si-bulk-scf-v1",
  "campaign_elements": ["Si"],
  "structure": {"format": "artifact", "artifact_id": "sha256:<64-hex>"},
  "physics": {
    "parameter_set": "<approved-parameter-set>",
    "pp_policy": {
      "mode": "sssp_single",
      "pp_set_id": "<approved-pp-set>",
      "lock_id": "sha256:<64-hex>"
    },
    "kpoints": [4, 4, 4]
  },
  "resources": {
    "profile": "standard",
    "nodes": 1,
    "mpi_ranks_per_node": 1,
    "omp_threads_per_rank": 1,
    "walltime_seconds": 3600,
    "gpu_policy": "cpu"
  },
  "client_request_id": "si-scf-v1",
  "workflow_inputs": {}
}
```

## CPU/GPU and state interpretation

CPU is the default, particularly for small or medium interactive jobs, PP/structure/audit/archive
jobs, and cost-sensitive work. Use `gpu` only when the user explicitly requests it or the project
already has a GPU budget, and the live catalogue returns `gpu_support_status: "verified"`. Do not
silently fall back to CPU when GPU is required. Claim that GPU was used only when the result
explicitly returns `selected_backend: "gpu"`; `auto` does not prove GPU use.

Keep the three state channels separate:

- `execution`: prepared/submitted/queued/running/scheduler completion/cancelled/failed;
- `solver`: not started/running/converged/not converged/failed/unknown;
- `scientific`: unreviewed, scientifically accepted, accepted with limitations, needs
  recalculation, not assessable, failed or archived.

scheduler completion does not mean solver convergence, and solver convergence does not mean
scientific acceptance. Branch on stable error codes rather than messages. Key codes include
`PP_SET_INCOMPLETE`, `PP_POLICY_INCOMPATIBLE`,
`PP_CAPABILITY_UNKNOWN`, `ARTIFACT_MISSING`, `SOLVER_NOT_CONVERGED`,
`SCIENTIFIC_GATE_FAILED`, `RESTART_INCOMPATIBLE`, `IDEMPOTENCY_CONFLICT`,
`EXECUTION_BACKEND_NOT_READY`, `GPU_UNSUPPORTED` and `GPU_UNAVAILABLE`.

Submission, cancellation, retry and review are remote mutations and require the user's explicit
authorisation. Do not retry when the outcome is unknown. Do not describe a GPU smoke test,
scheduler log or parseable QE output as a scientific conclusion or a customer-level performance
guarantee.
