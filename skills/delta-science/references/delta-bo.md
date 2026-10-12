# Delta-BO reference

Make all online calls with `delta-cli science invoke`; the tool is always `delta-bo`. The current
CLI catalogue exposes only `commands` and `generate`. Do not infer operations from old HTTP
documentation or call the stateful command API directly.

## commands

Use case: The user asks which Delta-BO commands are supported by the current deployment.

```text
delta-cli science invoke --tool delta-bo --endpoint commands
```

No request body. Report only the command list in the current business response; do not fill it in from historical documentation.

## generate

Use case: Generate random-search or Bayesian-optimisation suggestions for numeric, integer or categorical experimental variables.

When there is no real history, or fewer than five historical observations and the user has not explicitly requested BO, use bounded random search:

```json
{
  "params": [
    {"name": "x", "type": "numeric", "low": 0.0, "high": 1.0}
  ],
  "num_suggestions": 3,
  "algorithm": "random-search",
  "seed": 42
}
```

When real history is available and the user explicitly requests BO, you may use:

```json
{
  "params": [
    {"name": "temperature", "type": "numeric", "low": 20.0, "high": 120.0},
    {"name": "catalyst", "type": "categorical", "choices": ["A", "B", "C"]}
  ],
  "objectives": [{"name": "yield", "minimize": false}],
  "num_suggestions": 2,
  "algorithm": "bo",
  "model": {"name": "gp", "min_samples": 2, "train_steps": 50},
  "acq_target": {"name": "ucb", "beta": 2.0},
  "solver": {"name": "ga", "pop_size": 40, "n_gen": 10},
  "histories": {
    "decisions": [
      {"temperature": 40.0, "catalyst": "A"},
      {"temperature": 80.0, "catalyst": "B"}
    ],
    "observations": [
      {"yield": 0.42},
      {"yield": 0.61}
    ]
  },
  "seed": 7
}
```

Supported parameter types are `numeric`, `integer` and `categorical`. Prefer object-form history
to avoid ambiguity about the order of array columns. Do not invent observations, objective values
or purported optima.

Optional deduplication and constraints:

```json
{
  "diversity": {
    "deduplicate": true,
    "min_numeric_distance": {"temperature": 5.0},
    "prefer_unique_categories": true
  },
  "constraints": [
    {"type": "unique_batch"},
    {"type": "avoid_seen_decisions"}
  ]
}
```

Report only fields actually present in the business response: `suggestions`,
`suggestion_metadata`, `warnings`, `generated_candidate_count` and `diversity`. Do not replace
empty suggestions or a failure with local GP, UCB or random-number results.

## Known legacy capabilities that are not exposed

The old service included stateful commands such as session, space, objective, policy, suggest,
observe, loop, status and best, but they are not current Delta CLI operations. This Skill records
only that capability boundary: it includes no URL or curl examples and does not run those
operations. To extend the interface, first expose the operation and request schema through Science
Server, then update this reference.
