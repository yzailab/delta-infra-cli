# XRD Cloud Compute reference

`xrd` is a real tool for accessing XRD cloud compute through the Science tool proxy. Route every
call through `delta-cli`; do not bypass the CLI with broker URLs, `curl`, `requests`, `httpx`, a
browser or local XRD libraries. This is a tool reference for `delta-science`, not a second HTTP
client.

## Tool and endpoints

Before execution, use the live catalogue to confirm the canonical names and enabled status in the
current environment:

```text
delta-cli science list
delta-cli science endpoints list xrd
```

Copy `xrd` endpoint names exactly from the output of the second command. This reference covers
the following stable contracts:

| endpoint | Method/purpose | Request type |
| --- | --- | --- |
| `healthz`, `readyz`, `capabilities`, `xmatcher-status` | Readiness, capabilities and database status | Read-only JSON |
| `xmatcher-artifacts` | Upload an observed pattern, model input, CIF or instrument parameters | `invoke --file` |
| `xmatcher-artifact`, `xmatcher-artifact-content` | Query/read an artifact | `invoke --path-params` |
| `xqueryer-predictions` | XQueryer single-phase candidate prediction | JSON |
| `xmatcher-detect-peaks`, `xmatcher-match` | Peak detection and single-phase matching | JSON |
| `xmatcher-multiphase-match`, `xdecomposer-predictions` | Multiphase matching and phase decomposition | JSON |
| `xmatcher-cif-xrd`, `xmatcher-pdf-peaks-xlsx` | CIF simulation and PDF peak-table export | JSON/binary |
| `xmatcher-refinement-patterns` | Generate refinement inputs and a provenance manifest | JSON |
| `refinement-fullprof`, `refinement-gsasii`, `refinement-wpem` | Submit a refinement job to the corresponding backend | JSON + header |
| `refinement-job`, `refinement-job-events`, `refinement-job-artifacts` | Query a refinement job | `invoke --path-params` |
| `refinement-job-cancel` | Request refinement-job cancellation | `invoke --path-params` |
| `mp500-cif-exports` | Export an MP500 structure as CIF | JSON |

The live catalogue is authoritative. If an endpoint is absent from it, stop and report a
configuration issue; do not retry under a different name.

## CLI argument mapping

```text
--data          Upstream JSON body
--params        Upstream URL query parameters
--path-params   Replace {artifact_id}/{job_id} in the endpoint path
--headers       Additional upstream headers, such as Idempotency-Key
--file          Send a local file to the tool proxy via file_base64
--content-type  The file's original MIME type
```

`--params` cannot replace `--path-params`. Do not put local paths, base64, path parameters or
idempotency keys in ordinary business `--data`. `science file` is a separate file interface for
tools such as QE and Materials Design. XRD's `xmatcher-artifacts` is a tool-proxy endpoint; use
`science invoke --file` for it.

## Call sequence

1. When the user explicitly asks for a diagnosis or execution, read `healthz` first; read
   `capabilities` only when you need to select a backend.
2. Upload real files through `xmatcher-artifacts` and save the returned `artifact_id` and `sha256`.
3. Use `xmatcher-match`, `xmatcher-multiphase-match` or `xdecomposer-predictions` for observed
   data; XQueryer uses `model_input_pattern`.
4. Use `xmatcher-cif-xrd` for CIF simulation. For refinement, call
   `xmatcher-refinement-patterns` first, then choose a refinement endpoint matching
   `data.backends`.
5. After submitting a refinement job, read its status and artifacts with `refinement-job`,
   `refinement-job-events` and `refinement-job-artifacts`.

Do not present a returned `queued` state, scheduler completion or backend success as a scientific
conclusion. For refinement, report the transport/job final state, backend execution state and
scientific acceptance state separately.

## Readiness checks

```text
delta-cli science invoke --tool xrd --endpoint healthz
delta-cli science invoke --tool xrd --endpoint capabilities
```

Call readiness/status additionally only when diagnosis requires it or the user explicitly asks.
Every required component in the capabilities result must have `available` status. For production
jobs, also check `asset_release_approved`, checksum fields and warnings. `auto` does not prove GPU
use; report GPU use only when the result explicitly returns a GPU backend.

## Artifact upload and identity

Upload an observed pattern:

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-artifacts `
  --file observed.csv `
  --params '{"filename":"observed.csv","kind":"observed_pattern","media_type":"text/csv"}' `
  --content-type application/octet-stream
```

Allowed `kind` values are `observed_pattern`, `model_input_pattern`, `cif` and
`instrument_parameters`. Save the successful response's `artifact_id` and `sha256` together and
pass them to downstream calls unchanged. Pattern files are normalised by the server, so the
returned digest identifies the normalised artifact and may differ from the digest of the local
upload bytes.

Use path parameters to query an artifact:

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-artifact `
  --path-params '{"artifact_id":"art_<returned-id>"}'
```

Binary-content responses may return `data._binary=true`, `content_base64`, `media_type` and
`content_length`. Decode only when the user asks to save the content or the workflow requires it,
and verify it against the SHA-256 returned by the service. Do not infer the format from the filename.

## Phase identification and matching

XQueryer's `model_input_pattern` must contain exactly 3,500 samples over 10 to 90 degrees 2theta,
with intensities within the service's capability limits:

```text
delta-cli science invoke --tool xrd --endpoint xqueryer-predictions `
  --data '{"schema_version":1,"pattern":{"artifact_id":"art_<model>","sha256":"<sha>"},"top_k":10,"radiation_profile":"CuKa"}'
```

XMatcher observed pattern:

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-match `
  --data '{"schema_version":1,"pattern":{"artifact_id":"art_<observed>","sha256":"<sha>"},"top_n":10,"element_filter_mode":"contains"}'
```

Multiphase matching:

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-multiphase-match `
  --data '{"schema_version":1,"pattern":{"artifact_id":"art_<observed>","sha256":"<sha>"},"max_phases":3,"candidate_pool":8}'
```

The `score` from `xqueryer-predictions` is a softmax probability; the XMatcher `score` is
`raw_score / 100`. Do not average them directly or treat them as the same calibrated probability.

## CIF simulation and peak tables

Each artifact in `cifs` must provide both `artifact_id` and `sha256`:

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-cif-xrd `
  --data '{"schema_version":1,"cifs":[{"artifact":{"artifact_id":"art_<cif>","sha256":"<sha>"},"name":"phase"}],"two_theta_range":[5.0,90.0],"wavelength":"CuKa"}'
```

`xmatcher-pdf-peaks-xlsx` returns a binary XLSX file; read and save it only when the user asks for an export.

## Refinement jobs

First generate the corrected pattern and provenance manifest:

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-refinement-patterns `
  --data '{"schema_version":1,"source_pattern":{"artifact_id":"art_<observed>","sha256":"<sha>"}}'
```

Then use the endpoint matching `data.backends`. The example below shows the structure; every
artifact identity must come from the current call chain:

```text
delta-cli science invoke --tool xrd --endpoint refinement-gsasii `
  --data '{"schema_version":1,"radiation_profile":"CuKa","refinement_pattern":{"observed_pattern":{"artifact_id":"art_<obs>","sha256":"<sha>"},"corrected_pattern":{"artifact_id":"art_<corrected>","sha256":"<sha>"},"provenance_manifest":{"artifact_id":"art_<manifest>","sha256":"<sha>"}},"phases":[{"phase_index":0,"name":"phase","cif":{"artifact_id":"art_<cif>","sha256":"<sha>"}}],"wavelengths_angstrom":[1.540593,1.544414],"backends":["gsasii"]}' `
  --headers '{"Idempotency-Key":"<stable-unique-key>"}'
```

`refinement-fullprof`, `refinement-gsasii` and `refinement-wpem` select the billing/backend
entry point. Do not interchange endpoint names or `backends` merely because they map to the same
path. Submission, cancellation, retry and review are remote mutations and require the user's
explicit authorisation. After a timeout or disconnection, do not retry blindly; first check
whether a job has already been created.

To query a job:

```text
delta-cli science invoke --tool xrd --endpoint refinement-job `
  --path-params '{"job_id":"refjob_<returned-id>"}'

delta-cli science invoke --tool xrd --endpoint refinement-job-events `
  --path-params '{"job_id":"refjob_<returned-id>"}'
```

## Results and errors

- A call succeeds only when the CLI exits with code 0 and the top-level JSON `ok` is `true`.
- Preserve the returned `data`, warnings, error detail and stable error codes exactly as returned.
- `202`, `queued` and `running` describe job acceptance/execution state only; they do not mean the solver converged or the result was scientifically accepted.
- `TIER_CONCURRENCY_EXCEEDED`, `Endpoint is disabled`, `ARTIFACT_MISSING`,
  `MP500_IDENTITY_MISMATCH` and similar errors should stop the current call chain; report the
  original detail and do not switch endpoints, rename them, guess parameters or substitute a
  local algorithm.
- Use the live catalogue as the authority for paid endpoint prices and availability; before execution, confirm that the user actually requested the business call.

Evidence boundary: business results in the current Delta CLI `data` only.
Call chain: `delta-cli`.
Do not add information absent from the response: yes.
