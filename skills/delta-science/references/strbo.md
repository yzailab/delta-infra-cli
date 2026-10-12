# STRBO reference

STRBO performs generative multi-objective optimisation for the server-fixed **KRAS G12D**
target. The objective order is fixed as `[vina, activity]`: lower Vina is better and higher
activity is better. `task` guides candidate generation but does not change the target; do not
claim that user-defined receptors are supported.

Use `tool="strbo"` for every call. Generation, suggestion, evaluation and job submission consume
remote resources, so call them only when the user actually asks for the relevant research task.
Do not retry if the outcome is unknown or the request times out.

## Initialisation

- Synchronous operation: `molecules-init`
- Asynchronous operation: `molecules-init-job`
- Validation-only operation: `molecules-init-validate`

```json
{
  "task": "Generate candidate small molecules for KRAS G12D that balance binding and activity",
  "num_initial": 3,
  "seed": 42
}
```

Use validate only when you need to check parameters. For a full run, do not validate before
submitting; that would make an unnecessary call. A successful result should contain the same
number of candidate SMILES as `num_initial`.

## Suggest the next batch of candidates

- Synchronous operation: `molecules-suggest`
- Asynchronous operation: `molecules-suggest-job` (prefer it for heavy tasks)
- Validation-only operation: `molecules-suggest-validate`

```json
{
  "task": "Continue improving binding and activity for KRAS G12D",
  "history_xs": ["CCO", "CCN", "CCC"],
  "history_ys": [
    [-6.8, 0.31],
    [-7.1, 0.42],
    [-6.5, 0.28]
  ],
  "num_suggestions": 2,
  "seed": 42
}
```

`history_xs` and `history_ys` must have the same length. Each `history_ys` item must contain two
finite numbers in the exact order `[vina, activity]`. Do not present predictions as wet-lab results.

## Evaluate candidates

- Synchronous operation: `molecules-evaluate`
- Asynchronous operation: `molecules-evaluate-job`
- Validation-only operation: `molecules-evaluate-validate`

```json
{
  "designs": ["CCO", "CCN"]
}
```

The number of scores in a successful result must match the number of designs, with exactly two
finite numbers per row. If any item explicitly fails, treat the entire run as failed; do not
report only the successful subset.

## Asynchronous jobs

After submitting an asynchronous operation, read a non-empty `job_id` from the current business
response, then poll:

```text
delta-cli science invoke --tool strbo --endpoint job-status --params JSON
```

Read the result only once the status changes to `succeeded`:

```text
delta-cli science invoke --tool strbo --endpoint job-result --params JSON
```

`queued` and `running` do not mean the job is complete; stop immediately on `failed`. Status
queries may be repeated at intervals of about five seconds, but never repeat the submission
operation. The total wait for one user task is limited to 15 minutes. If that limit is reached,
report that the job is still incomplete and retain its `job_id`; do not claim it was cancelled
remotely.

## Complete research workflow

When the user explicitly asks for a complete iteration, run `initialise → evaluate → suggest →
evaluate` sequentially. Use only verified business responses from the current calls as inputs to
the next step. If the user asks only for initial candidates or evaluation of supplied SMILES, do
not expand the task into a full loop.
