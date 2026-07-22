# Delta-BO API Endpoint Reference

All paths are relative to `http://111.2.199.31:52317/api/v1`.

This reference is for using the exposed HTTP API. It is not a demo runner.

## Health And Command Discovery

`GET /chem/delta-bo/health`

`GET /chem/delta-bo/commands`

`/commands` returns the native route list exposed by the deployed service.

For a formatted catalog with gateway URLs against the deployed service, run the
bundled skill-local script (no local `delta_bo` package required):

```bash
python3 scripts/remote_list_eng_cmds.py --format markdown
python3 scripts/remote_list_eng_cmds.py --format json
```

For complete local route metadata including parameters, the offline equivalent
`list_eng_cmds.py` (requires a Delta-BO dev environment with dependencies
installed, not bundled) walks the same command registry used by the service
dispatcher and is the source of truth for possible native API usage.

## Stateless Generate

`POST /chem/delta-bo/generate`

Random search:

```json
{
  "params": [{"name": "x", "type": "numeric", "low": 0.0, "high": 1.0}],
  "num_suggestions": 3,
  "algorithm": "random-search",
  "seed": 42
}
```

BO with history:

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
    "decisions": [[40.0, "A"], [80.0, "B"], [100.0, "C"]],
    "observations": [0.42, 0.61, 0.53]
  },
  "seed": 7
}
```

Parameter types: `numeric`, `integer`, `categorical`.

Histories may also use object-form rows, which are safer for agents:

```json
{
  "histories": {
    "decisions": [
      {"temperature": 40.0, "catalyst": "A"},
      {"temperature": 80.0, "catalyst": "B"}
    ],
    "observations": [
      {"yield": 0.42},
      {"yield": 0.61}
    ]
  }
}
```

Optional diversity controls:

```json
{
  "diversity": {
    "deduplicate": true,
    "min_numeric_distance": {"temperature": 5.0},
    "prefer_unique_categories": true
  },
  "constraints": [
    {"type": "unique_batch"},
    {"type": "avoid_seen_decisions"},
    {
      "type": "max_temperature_for_category",
      "category_param": "solvent",
      "temperature_param": "temperature",
      "category": "dichloromethane",
      "max": 40
    }
  ]
}
```

Response fields include:

```json
{
  "suggestions": [[{"name": "temperature", "value": 72.0}]],
  "suggestion_metadata": [
    {
      "acquisition_value": null,
      "nearest_history": {
        "decision": [{"name": "temperature", "value": 80.0}],
        "distance": 0.08
      },
      "rationale": "exploitation"
    }
  ],
  "warnings": [
    "Only 3 observations supplied; GP fit may be weak. Consider random-search or more initial points."
  ],
  "generated_candidate_count": 15,
  "diversity": {
    "requested": true,
    "deduplicated": true,
    "duplicates_removed": 2
  }
}
```

## Native Stateful Command API

Gateway path pattern:

```text
POST /chem/delta-bo/v1/{command_path}
```

Native route `/v1/session/new` maps to gateway route:

```text
/api/v1/chem/delta-bo/v1/session/new
```

Minimal random-search session:

```bash
curl -s "$DBO/v1/session/new" \
  -H "Content-Type: application/json" \
  -d '{"name":"api_session"}'

curl -s "$DBO/v1/space" \
  -H "Content-Type: application/json" \
  -d '{"decision_expression":"Joint({\"x\": Num(-5, 10), \"y\": Num(0, 15)})"}'

curl -s "$DBO/v1/objective" \
  -H "Content-Type: application/json" \
  -d '{"source":"objectives/branin_simple.py","minimize":true}'

curl -s "$DBO/v1/policy/random-search" \
  -H "Content-Type: application/json" \
  -d '{"policy_id":"random_init","replace":true}'

curl -s "$DBO/v1/suggest" \
  -H "Content-Type: application/json" \
  -d '{"num":3,"policy_id":"random_init"}'
```

Common native commands:

```text
session/new
session/save
space
objective
policy/random-search
policy/bo
policy/bo.model/gp
policy/bo.target/ucb
policy/bo.target/ei
policy/bo.solver/ga
policy/flags
suggest
observe
loop
status
best
plot/best-so-far
```

Use `GET /chem/delta-bo/commands` for the deployed list; run the bundled
`scripts/remote_list_eng_cmds.py --format markdown/json` for a formatted catalog
against the deployed service, or the offline `list_eng_cmds.py` (local Delta-BO
dev environment, not bundled) for full parameter schemas.

## Native BO Policy Setup

A typical stateful BO configuration is:

```bash
curl -s "$DBO/v1/policy/bo" \
  -H "Content-Type: application/json" \
  -d '{"replace":true}'

curl -s "$DBO/v1/policy/bo.model/gp" \
  -H "Content-Type: application/json" \
  -d '{"train_steps":50,"min_samples":2}'

curl -s "$DBO/v1/policy/bo.target/ucb" \
  -H "Content-Type: application/json" \
  -d '{"beta":2.0}'

curl -s "$DBO/v1/policy/bo.solver/ga" \
  -H "Content-Type: application/json" \
  -d '{"pop_size":40,"n_gen":10}'
```

For random initialization policy creation:

```bash
curl -s "$DBO/v1/policy/random-search" \
  -H "Content-Type: application/json" \
  -d '{"policy_id":"random_init","replace":true}'
```

Then run an optimization loop:

```bash
curl -s "$DBO/v1/loop" \
  -H "Content-Type: application/json" \
  -d '{"iterations":5,"batch_size":1,"policy_id":"main","timeout":300}'
```

Response shape is nested:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "ok": true,
    "result": {
      "data": {},
      "summary": "...",
      "meta": {"command_path": "/v1/..."}
    }
  }
}
```

## Retry Safety

Setup/configuration requests such as `space`, `objective`, `policy/bo`, and
`policy/random-search` can be repeated with the same payload. Use
`{"replace": true}` for policy creation so repeated setup calls remain
idempotent.

Do not blindly retry state-changing optimization commands such as `loop`,
`suggest`, `observe`, `session/new`, or `session/save`, because a retry may
advance or duplicate remote experiment state.
