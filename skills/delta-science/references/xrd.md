# XRD Cloud Compute API Reference

The OpenAPI contract version is `1.2.0`. Business requests and responses use
`schema_version: 1`.

This reference covers endpoints, artifact identities, request parameters, call
sequences, refinement jobs, quality assessment, and error handling. Replace
`art_<...>`, `<sha256>`, and `refjob_<...>` placeholders with values returned by
the service in the same workflow.

## 1. Tool and endpoints

The registered tool is `xrd`, tool ID `30`. The
[tool record](http://8.141.101.94:8001/api/v1/tools/30) and
[endpoint catalogue](http://8.141.101.94:8001/api/v1/tools/30/endpoints)
identify 27 registered endpoints, all enabled. The catalogue server is a tool
registry and invocation proxy; it is not the compute service base URL.

Catalogue APIs, relative to `http://8.141.101.94:8001`:

| Method and path | Purpose |
| --- | --- |
| `GET /api/v1/tools/30` | Tool identity and configuration |
| `GET /api/v1/tools/30/endpoints` | All registered XRD endpoints |
| `GET /api/v1/tools/30/endpoints?status=true` | Enabled XRD endpoints |
| `GET /api/v1/tools/name/xrd/endpoints` | Endpoint lookup by tool name |

Catalogue responses use `code`, `message`, and `data`; `code=0` indicates success.
Endpoint records include `id`, `tool_id`, `name`, `path`, `method`, `price`,
`featurekey`, and `status`. Registration and enabled status do not establish
backend readiness. Recheck availability and prices before execution:

```text
delta-cli science list
delta-cli science endpoints list xrd
```

Use endpoint names exactly as registered. HTTP paths below are relative to the
registered upstream compute service. Price values are the catalogue's `price`
field; they do not specify a currency. All listed records have `status=true`.

| Endpoint ID | CLI endpoint | HTTP method and path | Purpose / response | Price |
| --- | --- | --- | --- | --- |
| 128 | `healthz` | `GET /healthz` | Process liveness, JSON | 0 |
| 129 | `readyz` | `GET /readyz` | Service readiness, JSON | 0 |
| 130 | `capabilities` | `GET /v1/capabilities` | Components, versions, verification, modes, and limits | 0 |
| 131 | `xqueryer-predictions` | `POST /v1/xqueryer/predictions` | Single-phase model predictions | 3 |
| 132 | `xmatcher-detect-peaks` | `POST /v1/xmatcher/detect-peaks` | Observed peak detection | 4 |
| 133 | `xmatcher-match` | `POST /v1/xmatcher/match` | Single-phase matching | 4 |
| 134 | `xmatcher-multiphase-match` | `POST /v1/xmatcher/multiphase-match` | Multiphase candidate matching | 4 |
| 135 | `xmatcher-cif-xrd` | `POST /v1/xmatcher/cif-xrd` | Theoretical XRD simulation from CIFs | 4 |
| 136 | `xmatcher-pdf-peaks-xlsx` | `POST /v1/xmatcher/pdf-peaks-xlsx` | Theoretical peak tables, binary XLSX | 8 |
| 137 | `xmatcher-status` | `GET /v1/xmatcher/status` | XMatcher database status | 0 |
| 138 | `xdecomposer-predictions` | `POST /v1/xdecomposer/predictions` | Multiphase model decomposition | 2 |
| 139 | `xmatcher-refinement-patterns` | `POST /v1/xmatcher/refinement-patterns` | Corrected pattern and provenance manifest | 0 |
| 140 | `mp500-cif-exports` | `POST /v1/mp500/cif-exports` | Export a CIF by database identity | 0 |
| 141 | `xmatcher-artifacts` | `POST /v1/artifacts` | Upload file bytes and return an artifact reference | 0 |
| 143 | `xmatcher-artifact` | `GET /v1/artifacts/{artifact_id}` | Artifact metadata | 0 |
| 144 | `xmatcher-artifact-content` | `GET /v1/artifacts/{artifact_id}/content` | Artifact content, binary | 0 |
| 145 | `refinement-job` | `GET /v1/refinement-jobs/{job_id}` | Job status and results | 0 |
| 146 | `refinement-job-cancel` | `POST /v1/refinement-jobs/{job_id}/cancel` | Request cancellation | 0 |
| 147 | `refinement-job-events` | `GET /v1/refinement-jobs/{job_id}/events` | Paginated job events | 0 |
| 148 | `refinement-job-artifacts` | `GET /v1/refinement-jobs/{job_id}/artifacts` | Public job artifacts | 0 |
| 149 | `refinement-fullprof` | `POST /v1/refinement-jobs` | Submit a FullProf job, HTTP 202 | 15 |
| 150 | `refinement-gsasii` | `POST /v1/refinement-jobs` | Submit a GSAS-II job, HTTP 202 | 12 |
| 151 | `refinement-wpem` | `POST /v1/refinement-jobs` | Submit a PyXplore/WPEM job, HTTP 202 | 10 |
| 160 | `simulation-cif-parse` | `POST /v1/simulation/cif-parse` | Parse CIF data blocks | 1 |
| 161 | `simulation-cif-peaks` | `POST /v1/simulation/cif-peaks` | Simulate reflections for a selected block and wavelength | 1 |
| 162 | `pdfreporter-analyses` | `POST /v1/pdfreporter/analyses` | Multiphase peak assignments and charts | 8 |
| 163 | `pdfreporter-assignments` | `POST /v1/pdfreporter/analyses/assignments` | Recompute analysis with manual assignments | 8 |

The three refinement CLI endpoints select backend and billing entries in the
proxy. The compute service exposes one job submission route. HTTP `backends`
values are `pyxplore`, `fullprof`, and `gsasii`; `refinement-wpem` corresponds to
PyXplore/WPEM. Match the CLI endpoint and requested backends to the proxy configuration.

### Chemistry gateway

The Chemistry gateway prefix is `/api/v1/chem/xrd`. Allowed business routes are
exposed as `/api/v1/chem/xrd/v1/...`. The gateway injects an upstream service token,
rewrites `Location`, `content_url`, and job `links`, and preserves business HTTP
status codes and download headers.

- `GET /api/v1/chem/xrd/health` calls compute `/readyz`.
  This aggregate health endpoint uses the gateway's `BaseResponse` envelope.
- The gateway allowlist excludes `/v1/xdecomposer/predictions`, both
  `/v1/simulation/...` routes, and both `/v1/pdfreporter/...` routes. Requests to
  these paths through this Chemistry gateway return 404. They are implemented by
  the compute service; access through other proxies depends on their configuration.
- `/v1/identification/predictions`, `/v1/structures/cif-exports`, and
  `/v1/identification-jobs/...` appear in the gateway allowlist but have no
  corresponding routes in this compute service implementation.

## 2. Request conventions and CLI argument mapping

Compute `/v1/...` endpoints require `Authorization: Bearer <token>`, except in
explicitly configured isolated environments with authentication disabled.
`/healthz` and `/readyz` have no Bearer dependency.

JSON requests use `Content-Type: application/json`. File uploads use
`Content-Type: application/octet-stream` with raw file bytes in the body.
Uploads are not multipart requests.

The optional `X-Request-ID` header accepts 1–128 characters from letters, digits,
and `._:-`. Responses also return this header. Business request models reject
unknown fields.

| CLI argument | Upstream meaning |
| --- | --- |
| `--data` | JSON request body |
| `--params` | URL query parameters, including upload metadata and event pagination |
| `--path-params` | Replace `{artifact_id}` and `{job_id}` in paths |
| `--headers` | Additional headers, such as `Idempotency-Key` and `X-Content-SHA256` |
| `--file` | Upload a local file through the tool proxy |
| `--content-type` | Upload body Content-Type; use `application/octet-stream` |

`--params` cannot replace `--path-params`. Keep local paths, base64 content, and
idempotency keys out of business JSON. Use `science invoke --file` for XRD uploads.
The `media_type` query parameter describes the stored file format separately
from the upload body Content-Type.

The registry proxy exposes `POST /api/v1/tools/invoke` with required
`tool_name` and `endpoint_name` fields. Optional fields are `data`, `params`,
`path_params`, `headers`, `file_base64`, and `content_type`. A supplied
file_base64 is decoded and forwarded as raw bytes, taking precedence over data;
content_type defaults to application/octet-stream. Delta CLI maps its invocation
arguments to these proxy fields. Tool ID 30 is used for catalogue lookup;
invocation selects `tool_name="xrd"` and a registered endpoint name.

## 3. Call sequence

1. Inspect the CLI catalogue and check readiness and required capabilities.
2. Upload observed patterns, model inputs, CIFs, or instrument files. Save the
   returned `artifact_id` and `sha256` together.
3. Use XMatcher or XDecomposer for observed data. XQueryer requires a prepared
   `model_input_pattern`.
4. Export candidate CIFs by identity or upload CIF files. Run theoretical
   simulations and PDF Reporter peak assignments as needed.
5. Generate a corrected pattern and manifest for basic refinement. GSAS report
   mode uses an observed pattern uploaded with its original bytes preserved.
6. Submit a job with an idempotency key, query its status and events, and verify
   downloaded artifact hashes.
7. Report job status, backend execution status, fit quality, physical validity,
   and scientific acceptance separately.

## 4. Readiness and capabilities

```text
delta-cli science invoke --tool xrd --endpoint healthz
delta-cli science invoke --tool xrd --endpoint readyz
delta-cli science invoke --tool xrd --endpoint capabilities
```

`GET /healthz` returns `200 {"ok":true}` for process liveness.
`GET /readyz` checks authentication configuration and required components;
an unready service returns `503 {"ok":false}`.

`GET /v1/capabilities` returns `components.<name>.available`, component `details`,
`limits`, and build information. Check the components required for the workflow,
checksums, asset release approval, and mode availability. Report GPU use only when
the returned device or backend explicitly supports that conclusion.

For GSAS report mode, check both:

```text
components.gsasii.available
components.gsasii.details.workflow_modes["gsas-report-initial-v1"].available
```

Mode fields include `max_phases`, `defaults`, `policy_version`, `official_score`,
and `accepts_recipe`. The common request model accepts 1–3 phases, while a backend
mode may impose a lower limit. GSAS report mode supports up to two phases as
described in its detailed contract; consult the deployed capability for its limit.

## 5. Artifact upload, identity, and download

### Upload

`POST /v1/artifacts` returns HTTP 201, an `ArtifactRef`, and a metadata query
URL in the `Location` header.

| Parameter | Location | Requirement |
| --- | --- | --- |
| `filename` | Query | Required; 1–255 characters; no `/` or `\` |
| `kind` | Query | Required; accepted kinds are listed below |
| `media_type` | Query | Required; 1–255 characters; no line breaks |
| `preserve_source` | Query | Default false; preserve original observed text pattern bytes |
| `X-Content-SHA256` | Header | Optional; 64 lowercase hexadecimal characters, hashing the upload bytes |

| Accepted upload kind | File and processing rules |
| --- | --- |
| `observed_pattern`, `model_input_pattern` | `.csv/.xy/.xye/.dat/.txt/.xrdml/.raw`; normalization to headerless two-column CSV is attempted by default |
| `background_prepared_pattern`, `background_curve` | Same pattern extensions; stored verbatim for PyXplore prepared mode |
| `cif` | `.cif/.mcif`; stored verbatim |
| `instrument_parameters` | `.instprm`; stored verbatim |
| `pcr`, `irf_profile` | Stored verbatim; upload has no extension restriction |

Pattern uploads are limited to the smaller of the configured upload limit and
20,000,000 bytes. Instrument uploads are limited to the smaller of that limit
and 2,000,000 bytes. Other files use `max_upload_bytes`. Empty bodies are rejected.

Text patterns that fail conversion may be stored as received and rejected at
compute time. Vendor-format parsing failures are rejected during upload.

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-artifacts `
  --file observed.csv `
  --params '{"filename":"observed.csv","kind":"observed_pattern","media_type":"text/csv"}' `
  --content-type application/octet-stream
```

For GSAS report mode, add `"preserve_source":true` to `--params`. This requires
`kind=observed_pattern` and a `.csv/.xy/.xye/.dat/.txt` filename. It preserves
original bytes, line endings, and sigma values, and returns
`metadata.source_preserved=true`.

The upload response includes `artifact_id`, `kind`, `filename`, `media_type`,
`size_bytes`, `sha256`, `created_at`, `content_url`, `metadata`, and `producer`.
For normalized patterns, the returned digest identifies the converted artifact
and may differ from the local upload digest.

### Downstream references

An input artifact reference contains exactly two fields:

```json
{"artifact_id":"art_<returned-id>","sha256":"<sha256>"}
```

Artifact IDs contain `art_` followed by 32 lowercase hexadecimal characters.
SHA-256 values contain 64 lowercase hexadecimal characters. Pass only these
fields to `ArtifactInput`; fields such as `filename` and `content_url` are rejected.

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-artifact `
  --path-params '{"artifact_id":"art_<returned-id>"}'

delta-cli science invoke --tool xrd --endpoint xmatcher-artifact-content `
  --path-params '{"artifact_id":"art_<returned-id>"}'
```

The HTTP content response contains file bytes with `ETag` and
`X-Artifact-SHA256` headers. A CLI proxy may wrap binary data with `data._binary`,
`content_base64`, `media_type`, and `content_length`. Verify saved content against
the returned SHA-256, and determine its format from the media type and content.

## 6. Phase identification and matching

### XQueryer: `POST /v1/xqueryer/predictions`

`pattern` must reference a `model_input_pattern` containing exactly 3,500 points
on a uniform 10–90° 2theta grid. Maximum grid error is `1e-6`. Intensities must be
nonnegative within `1e-8` tolerance and normalized to a maximum of 100 within
`1e-6` tolerance. Upload format conversion does not guarantee these constraints.

```text
delta-cli science invoke --tool xrd --endpoint xqueryer-predictions `
  --data '{"schema_version":1,"pattern":{"artifact_id":"art_<model>","sha256":"<sha256>"},"top_k":10,"elements":["Mn","O"],"radiation_profile":"CuKa"}'
```

`top_k` defaults to 50 and accepts 1–5000. `elements` defaults to an empty array,
accepts up to 16 entries, and supports H through U. `radiation_profile` is `CuKa`.
Optional `expected_versions` can pin checkpoint, MP500 database, and XMatcher
database digests.

The response includes `backend`, `status`, `duration_ms`, `candidates`,
`provenance`, and `request_id`. Candidates include rank, class_id, entry_id,
mp_id, formula, score, and available structure information. The score is a
softmax probability.

### Peak detection and single-phase XMatcher

`POST /v1/xmatcher/detect-peaks` accepts `schema_version`, `pattern`, `params`,
and optional `expected_xmatcher_database_sha256`. XMatcher accepts
`observed_pattern` or `model_input_pattern` artifacts.

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-detect-peaks `
  --data '{"schema_version":1,"pattern":{"artifact_id":"art_<observed>","sha256":"<sha256>"},"params":{"n_peaks":8}}'

delta-cli science invoke --tool xrd --endpoint xmatcher-match `
  --data '{"schema_version":1,"pattern":{"artifact_id":"art_<observed>","sha256":"<sha256>"},"top_n":10,"elements":["Mn","O"],"element_filter_mode":"contains","formula":"Mn2O3"}'
```

Single-phase `top_n` defaults to 10 and accepts 1–5000. Element filtering uses
`contains` by default, allowing additional elements; `exact` requires a matching
element set. Optional `formula` must be nonempty and at most 128 characters.

XMatcher matching responses include `status=ok`, `results`, `detected_peaks`,
`processed_spectrum`, `params`, `ranking`, and `calibration`. The runtime adds
duration, request_id, and provenance. Candidates retain native score or
peak_match_score values and include calibration_adjusted_score. Interpret ranks
using `ranking` and `effective_settings`. Learned mode explicitly reports
`score_is_probability=false`; do not average these scores with XQueryer probabilities.

### Multiphase XMatcher: `POST /v1/xmatcher/multiphase-match`

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-multiphase-match `
  --data '{"schema_version":1,"pattern":{"artifact_id":"art_<observed>","sha256":"<sha256>"},"top_n":10,"max_phases":3,"candidate_pool":20,"prefer_multiphase":false}'
```

| Parameter | Default / range |
| --- | --- |
| `top_n` | 10; 1–50 |
| `max_phases` | 3; 1–3 |
| `candidate_pool` | 20; 2–30 |
| `elements`, `element_filter_mode` | Empty array, contains; up to 16 elements |
| `known_phase_elements`, `known_phase_formulas`, `known_phase_mpids` | Optional string or array of strings |
| `prefer_multiphase` | false |
| `params` | XMatcher parameter object |
| `expected_xmatcher_database_sha256` | Optional database digest pin |

### XMatcher `params`

These are request model defaults. The runtime forwards explicitly set values
using `exclude_unset`; use returned evidence and the deployed adapter to determine
effective settings.

| Parameter | Model default | Constraint |
| --- | --- | --- |
| `min_peak_height` / `min_peak_prominence` | 3.0 / 2.0 | >0 / ≥0 |
| `min_peak_distance` / `smooth_window` | 0.1 / 7 | >0 / integer 1–255 |
| `baseline_window_fraction` | 0.05 | (0,1] |
| `n_peaks` / `min_matched_peaks` | 8 / 4 | 1–100 / 1–50 |
| `position_tolerance` | 0.2 | (0,2] |
| `intensity_weight` / `position_weight` | 0.15 / 0.85 | Both ≥0; sum >0 |
| `scoring_method` | hybrid | hybrid / weighted / fom / combined |
| `max_shift` / `shift_step` | 0.5 / 0.02 | (0,5] / (0,1] |
| `shift_warning_fraction` / `shift_penalty_max_fraction` | 0.60 / 0.20 | (0,1] / [0,1] |
| `fixed_zero_shift` / `specimen_displacement` | 0 / 0 | Finite numbers |
| `multiphase_n_peaks` | 20 | null or integer 1–80 |
| `learned_ranking` / `learned_candidate_pool` | true / 24 | Boolean / 1–30 |
| `learned_missing_peak_weight` / `learned_phase_penalty` | 0.15 / 3.0 | ≥0 |
| `learned_minimum_contribution` / `learned_evidence_weight` | 3.0 / 4.0 | [0,100) / ≥0 |
| `multiphase_diversify_candidates` | true | Boolean |
| `multiphase_missing_peak_weight` / `multiphase_phase_penalty` | 0.5 / 3.0 | ≥0 |
| `multiphase_minimum_phase_contribution_percent` | 8.0 | [0,100) |

### XDecomposer: `POST /v1/xdecomposer/predictions`

```text
delta-cli science invoke --tool xrd --endpoint xdecomposer-predictions `
  --data '{"schema_version":1,"pattern":{"artifact_id":"art_<observed>","sha256":"<sha256>"},"top_k":5,"radiation_profile":"CuKa"}'
```

`pattern` must reference an `observed_pattern`. `top_k` defaults to 5 and accepts
1–20. The response includes `phases`, `provenance`, duration, and request ID.
Each phase includes `phase_index`, `active`, `activity_probability`, `mp_id`,
`match_score`, `row_id`, and `alternatives`. Phase indices may start at 0 here;
map them to unique indices in 1–3 when constructing refinement requests.

## 7. CIFs, theoretical patterns, and peak tables

### XMatcher simulation and XLSX export

`POST /v1/xmatcher/cif-xrd` and `/v1/xmatcher/pdf-peaks-xlsx` share a request model.

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-cif-xrd `
  --data '{"schema_version":1,"cifs":[{"artifact":{"artifact_id":"art_<cif>","sha256":"<sha256>"},"name":"phase","weight":1.0}],"two_theta_range":[5.0,90.0],"wavelength":"CuKa","fwhm":0.12,"step":0.02,"normalize":true}'
```

`cifs` contains 1–5 entries, each with an `artifact`, optional name, and
nonnegative weight defaulting to 1. `two_theta_range` must be finite and
increasing. `min_intensity` defaults to 0 and must be nonnegative; fwhm and step
must be positive. `wavelength` is a string, separate from the numeric `lambda`
field in the simulation API below. `expected_xmatcher_database_sha256` is optional.

The peak-table endpoint returns XLSX bytes with media type
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

### MP500, RRUFF, and OPXRD CIF export

`POST /v1/mp500/cif-exports` requires both the candidate entry_id and its identity:

```text
delta-cli science invoke --tool xrd --endpoint mp500-cif-exports `
  --data '{"schema_version":1,"entry_id":1235,"expected_mp_id":"mp-<candidate-id>"}'
```

`entry_id` is a positive integer. `expected_mp_id` comes from the selected
candidate and accepts up to 128 characters. Entries above 100315 use the local
RRUFF/OPXRD namespace, where expected_mp_id identifies a cryst_id such as
`RRUFF:...` or `OPXRD:...`.

Optional `expected_database_sha256` must identify the database being queried.
The response includes `entry_id`, `mp_id`, `structure`, and `cif_artifact`.
Use the returned CIF artifact identity downstream. Identity mismatches produce
MP500 or RRUFF mismatch errors; do not substitute guessed identifiers.

### CIF block parsing and reflection simulation

CLI endpoint: `simulation-cif-parse`. Request for `POST /v1/simulation/cif-parse`:

```json
{"schema_version":1,"cif":{"artifact_id":"art_<cif>","sha256":"<sha256>"}}
```

```text
delta-cli science invoke --tool xrd --endpoint simulation-cif-parse `
  --data '{"schema_version":1,"cif":{"artifact_id":"art_<cif>","sha256":"<sha256>"}}'
```

The response contains `blocks[]`. Successful blocks include block_index,
block_name, formula, cell, volume, site_count, spacegroup, and warnings. Failed
blocks include block_index and error. Inspect individual blocks even when HTTP
status is 200.

CLI endpoint: `simulation-cif-peaks`. Request for `POST /v1/simulation/cif-peaks`:

```json
{"schema_version":1,"cif":{"artifact_id":"art_<cif>","sha256":"<sha256>"},"block":0,"lambda":1.5406,"min_angle":5.0,"max_angle":90.0}
```

```text
delta-cli science invoke --tool xrd --endpoint simulation-cif-peaks `
  --data '{"schema_version":1,"cif":{"artifact_id":"art_<cif>","sha256":"<sha256>"},"block":0,"lambda":1.5406,"min_angle":5.0,"max_angle":90.0}'
```

`block` selects a block index or name. It may be omitted only when exactly one
structure block was parsed successfully. `lambda` is the required JSON field
name, accepting (0,5] Å. min_angle accepts [0.1,174], and max_angle accepts
[0.2,175]; calculation also validates the angle range.
The response identifies the selected block and contains `peaks[]`.
Neither simulation endpoint depends on XMatcher search assets.

## 8. PDF Reporter peak assignments

CLI endpoint: `pdfreporter-analyses`. Request for `POST /v1/pdfreporter/analyses`:

```json
{
  "schema_version":1,
  "observed_pattern":{"artifact_id":"art_<observed>","sha256":"<sha256>"},
  "phases":[{"cif":{"artifact_id":"art_<cif>","sha256":"<sha256>"},"name":"phase","color":"#226ba0","visible":true}],
  "wavelength_angstrom":1.5406,
  "tolerance":0.20,
  "intensity_threshold_percent":10,
  "min_peak_distance":0.08,
  "min_prominence_percent":0,
  "render":true
}
```

```text
delta-cli science invoke --tool xrd --endpoint pdfreporter-analyses `
  --data '{"schema_version":1,"observed_pattern":{"artifact_id":"art_<observed>","sha256":"<sha256>"},"phases":[{"cif":{"artifact_id":"art_<cif>","sha256":"<sha256>"},"name":"phase","color":"#226ba0","visible":true}],"wavelength_angstrom":1.5406,"tolerance":0.20,"intensity_threshold_percent":10,"min_peak_distance":0.08,"min_prominence_percent":0,"render":true}'
```

The request accepts 1–8 phases. Phase name and color are optional; color is a
six-digit hexadecimal color, and visible defaults to true. The observed artifact
may be observed_pattern or model_input_pattern. Each pattern or CIF is limited
to 4,000,000 bytes, and observed patterns to 500,000 points.

Wavelength accepts (0,5] Å; tolerance accepts (0,2]°; both percentage parameters
accept [0,100]; min_peak_distance must be nonnegative.

The response includes per-phase theory tables in `phases`, flattened theory in
`th`, observed peaks in `pk`, `peaks_csv`, `theory_csv`, `chart.svg`, and optional
`chart.png`. Charts are downloadable artifact references. PNG is null when
rasterization dependencies are unavailable.
Peak statuses are `unmatched`, `unique`, `ambiguous`, and `manual`.

CLI endpoint: `pdfreporter-assignments`. For
`POST /v1/pdfreporter/analyses/assignments`, resubmit the complete analysis input
and add this field:

```json
{"selections":{"38.45|0":"0:0","30.05|0":"none"}}
```

```text
delta-cli science invoke --tool xrd --endpoint pdfreporter-assignments `
  --data '{"schema_version":1,"observed_pattern":{"artifact_id":"art_<observed>","sha256":"<sha256>"},"phases":[{"cif":{"artifact_id":"art_<cif>","sha256":"<sha256>"},"name":"phase","color":"#226ba0","visible":true}],"wavelength_angstrom":1.5406,"tolerance":0.20,"intensity_threshold_percent":10,"min_peak_distance":0.08,"min_prominence_percent":0,"render":true,"selections":{"38.45|0":"0:0","30.05|0":"none"}}'
```

This is a field fragment, not a complete request. Keys have the form
`<observed-2theta>|<phase-id>`, with zero-based phase IDs. Values are a returned
matches[].key, `none` to exclude a phase, or `auto` to restore automatic assignment.
The endpoint recomputes statelessly; it does not update an analysis by analysis_id.
Theory uses a simplified Z scattering approximation. Results support preliminary
assignments and do not establish phase confirmation or weight fractions.

## 9. Asynchronous refinement

### Basic input preparation

```text
delta-cli science invoke --tool xrd --endpoint xmatcher-refinement-patterns `
  --data '{"schema_version":1,"source_pattern":{"artifact_id":"art_<observed>","sha256":"<sha256>"}}'
```

The response includes `refinement_pattern_id`, `cache_hit`, `artifact`,
`manifest_artifact`, and `manifest`. Use artifact for corrected_pattern and
manifest_artifact for provenance_manifest.
This endpoint accepts schema_version, source_pattern, and optional expected_versions.
`normalize=false`, `remove_baseline=true`, and `smooth=false` are fixed internal
processing settings, not additional request fields.

### Basic job submission

`POST /v1/refinement-jobs` requires `Idempotency-Key` with 8–200 characters:

```text
delta-cli science invoke --tool xrd --endpoint refinement-gsasii `
  --data '{"schema_version":1,"radiation_profile":"CuKa","refinement_pattern":{"observed_pattern":{"artifact_id":"art_<observed>","sha256":"<observed-sha>"},"corrected_pattern":{"artifact_id":"art_<corrected>","sha256":"<corrected-sha>"},"provenance_manifest":{"artifact_id":"art_<manifest>","sha256":"<manifest-sha>"}},"phases":[{"phase_index":1,"name":"phase","cif":{"artifact_id":"art_<cif>","sha256":"<cif-sha>"}}],"wavelengths_angstrom":[1.540593,1.544414],"backends":["gsasii"],"options":{"timeout_seconds":900,"gsasii":{"workflow_mode":"basic-v1"}}}' `
  --headers '{"Idempotency-Key":"<stable-unique-key>"}'
```

| Common field | Rule |
| --- | --- |
| `schema_version` | Required; 1 |
| `radiation_profile` | Default and enum CuKa; actual wavelengths are specified separately |
| `refinement_pattern` | Required; basic mode uses observed, corrected, and a valid manifest |
| `phases` | Required; 1–3 phases; unique phase_index values in 1–3; name and cif required; mp_id and entry_id optional |
| `wavelengths_angstrom` | Required; 1–2 finite positive numbers in Å; single line or doublet, preserving order |
| `backends` | 1–3 unique values; defaults to all three backends; explicit selection is recommended |
| `options.timeout_seconds` | Default 900; integer 1–3600 |
| `expected_versions` | Optional asset digest pins |

Basic mode verifies manifest source/output hashes, point counts, a shared 2theta
grid, and the fixed preprocessing policy. Basic doublet intensity ratio is 0.5.
GSAS instrument files must match requested wavelengths.

### Backend options

| Backend | Field | Default / constraint |
| --- | --- | --- |
| PyXplore | `iterations` | 10; integer 1–200 |
| PyXplore | `initialization_epoch` | 2; strict integer ≥0; rejects Boolean, float, string, and null |
| PyXplore | `peak_generation_range` | null or two finite increasing angles; explicit endpoints must be at least 5° inside the observed range |
| PyXplore | `structure_solve` | false; true runs per-phase presolving against the full observed pattern |
| PyXplore | `low_bound` / `up_bound` | Optional; effective defaults 20 / 70; separate from peak generation range |
| PyXplore | `background` | Overrides LFctg, lowAngleRange, poly_n, bac_split, bac_num, window_length, and polyorder |
| FullProf | `cycles` / `continuations` | 12 / 2; integer 1–100 / 0–5 |
| FullProf | `stages` | Empty by default, using backend defaults; supports explicit staged actions |
| FullProf | `start_from_pcr` | Optional pcr reference; continuation requires explicit stages |
| FullProf | `raw_pattern` | false; true requires FullProf only and bypasses XMatcher lineage |
| GSAS basic | `workflow_mode` | basic-v1 |
| GSAS basic | `cycles` | 8; integer 1–100 |
| GSAS basic | `refine_zero` / `refine_profile` / `refine_cell` | true / true / true |
| GSAS basic | `refine_atoms` | false only |
| GSAS | `instrument_artifact` / `instrument_calibrated` | null / false; calibration requires server-verified records |

FullProf stage group values are scale, background, zero, cell, profile_w,
displacement, coordinates, adp, and occupancy. background_terms accepts 1–5;
cycles and continuations may be overridden per stage. Structure groups support
atoms and adp_link values site/species. A script cannot release both zero and
displacement. In raw_pattern mode, corrected_pattern is still required and must
reference observed_pattern or model_input_pattern.

PyXplore `background.prepared=true` requires a PyXplore-only job. corrected_pattern
must be background_prepared_pattern, and background.background_curve must be
background_curve; the manifest may be omitted. The service verifies all three
grids and identities and skips BackgroundFit. Caller settings are not reported
as server-measured execution evidence.

Basic PyXplore BackgroundFit operates on the observed pattern. The theoretical
peak generation range does not crop the original fitting or assessment pattern.
Execution configuration, iteration metrics, and download evidence are available
in `summary.wpem_evidence`.

### GSAS report mode

`options.gsasii.workflow_mode="gsas-report-initial-v1"` requires
`backends=["gsasii"]`. Upload the original observed text pattern with
preserve_source=true. This mode prohibits corrected_pattern,
provenance_manifest, and basic-mode cycles/refine switches.

Request for `POST /v1/refinement-jobs`, with an idempotency header:

```json
{
  "schema_version":1,
  "radiation_profile":"CuKa",
  "refinement_pattern":{"observed_pattern":{"artifact_id":"art_<original>","sha256":"<sha256>"}},
  "phases":[{"phase_index":1,"name":"phase","cif":{"artifact_id":"art_<cif>","sha256":"<sha256>"}}],
  "wavelengths_angstrom":[1.540593,1.544414],
  "backends":["gsasii"],
  "options":{"timeout_seconds":900,"gsasii":{"workflow_mode":"gsas-report-initial-v1"}}
}
```

Optional `recipe` controls single-phase baseline/candidates, multiphase baseline,
physical bounds, selection rules, and residual peak definitions. Omission uses
the backend default recipe. Complete recipe types are defined in OpenAPI and
the GSAS reference. The official scoring implementation is pinned by version
and module SHA-256; callers cannot replace it.

Report mode accepts a finite nonnegative `ka2_ka1_intensity_ratio` for doublets.
This field is prohibited for a single wavelength. When omitted, a generic
doublet instrument uses 0.5 and a custom instrument uses its actual ratio.

`summary.evidence` records the selected checkpoint, input hashes, actual
wavelengths, fitting range, native Rwp, full-pattern relative L2, original-sigma
Rwp, official score, and execution stages. Two-column inputs use unit numerical
weights and report `sigma_is_measured=false`; three-column original inputs
contain measured sigma.

Published GPX files require native reopen verification. Downloaded byte hashes
must match evidence. Complete execution and publication require channel success,
`workflow_complete=true`, and `publication_complete=true`. Inspect
`structure_consistency` and diagnostics as well. Artifacts marked
`diagnostic_only=true` are for failure review and are not accepted final structures.
Uncalibrated instrument results remain provisional; uploading a file does not
establish calibration.

### Acceptance, queries, and cancellation

Successful submission returns HTTP 202 with schema_version, job_id,
status=queued, submitted_at, and links.self/events/artifacts. Location points
to the job query route.

The same idempotency key and canonical request reuse the original job.
The same key with a different request returns 409 IDEMPOTENCY_CONFLICT.
Use a new key for an intentional new calculation. After a timeout or disconnect,
retain the original key and investigate whether a job exists before resubmitting.

```text
delta-cli science invoke --tool xrd --endpoint refinement-job `
  --path-params '{"job_id":"refjob_<returned-id>"}'

delta-cli science invoke --tool xrd --endpoint refinement-job-events `
  --path-params '{"job_id":"refjob_<returned-id>"}' `
  --params '{"after_seq":0,"limit":100}'

delta-cli science invoke --tool xrd --endpoint refinement-job-artifacts `
  --path-params '{"job_id":"refjob_<returned-id>"}'

delta-cli science invoke --tool xrd --endpoint refinement-job-cancel `
  --path-params '{"job_id":"refjob_<returned-id>"}'
```

Job IDs contain `refjob_` followed by 32 lowercase hexadecimal characters.
Event after_seq defaults to 0 and must be nonnegative; limit defaults to 100
and accepts 1–500. Pass response next_after_seq for the next page.
Artifact lists are deduplicated by artifact_id; download through the content API.

Cancellation returns the job's current state. Continue querying until a terminal
state is reached. Cancelling completed or failed jobs returns JOB_STATE_CONFLICT.

| Layer | Status / interpretation |
| --- | --- |
| Job `status` | queued / running / cancelling / completed / failed / cancelled |
| Pipeline `result.status` | success / partial / failed / skipped |
| Channel `result.results.<backend>.status` | success / failed / skipped / cancelled |
| `quality`, `scientific_status`, `diagnostics` | Inspect fit quality, scientific state, physical validity, and evidence completeness separately |

`completed` means the scheduling workflow finished; individual backends may
have failed. Channel success alone does not establish convergence, physical
validity, or scientific acceptance. Preserve null or unknown values for unavailable metrics.

## 10. Responses and errors

Compute endpoints generally return business JSON directly, without a common
top-level `ok` or `data` success envelope. Health probes, CLI responses, and
gateway aggregate health endpoints each use their own response conventions.

A successful Delta CLI invocation requires exit code 0 and top-level ok=true;
business results are in data. Decode binary responses according to Content-Type.

Compute error response:

```json
{
  "schema_version":1,
  "error":{"code":"VALIDATION_ERROR","message":"Request validation failed.","retryable":false,"details":[{"field":"body.pattern","reason":"missing"}]},
  "request_id":"req_example"
}
```

Gateway-generated errors include error and request_id but may omit schema_version.

| Common error | Meaning / action |
| --- | --- |
| AUTHENTICATION_REQUIRED / SERVICE_MISCONFIGURED | Missing authentication or unconfigured service authentication |
| VALIDATION_ERROR / UNSUPPORTED_MEDIA_TYPE / PAYLOAD_TOO_LARGE | Invalid fields, media type, or upload size |
| ARTIFACT_NOT_FOUND / ARTIFACT_HASH_MISMATCH / PATTERN_KIND_MISMATCH | Verify artifact ID, SHA-256, and required kind |
| PATTERN_INVALID / MODEL_INPUT_SHAPE_INVALID / CIF_INVALID / XMATCHER_INVALID | Invalid pattern, model grid, CIF, or matching input |
| CAPABILITY_UNAVAILABLE / CAPABILITY_VERSION_MISMATCH | Unavailable component or mismatched asset version |
| MP500_IDENTITY_MISMATCH / RRUFF_IDENTITY_MISMATCH | entry_id does not match the expected candidate identity |
| REFINEMENT_LINEAGE_INVALID / INSTRUMENT_INVALID | Invalid provenance, source preservation, or instrument data |
| IDEMPOTENCY_CONFLICT / JOB_NOT_FOUND / JOB_STATE_CONFLICT | Conflicting key, missing job, or operation incompatible with job state |
| REDIS_UNAVAILABLE / XMATCHER_TIMEOUT | Queue unavailable or matching wait timeout |
| UPSTREAM_UNAVAILABLE / NOT_FOUND | Chemistry gateway connection failure or route not exposed |

HTTP 429 responses may include Retry-After. Proxy errors such as Endpoint is
disabled and TIER_CONCURRENCY_EXCEEDED are separate from native compute errors.
Preserve returned code, message, details, warnings, and request_id. Do not switch
endpoints, guess parameters, or replace failed business results with local algorithms.

## 11. Contracts and references

- [Registered XRD tool](http://8.141.101.94:8001/api/v1/tools/30)
- [Registered XRD endpoint catalogue](http://8.141.101.94:8001/api/v1/tools/30/endpoints)
- [Registry proxy OpenAPI](http://8.141.101.94:8001/openapi.json)
- [Compute OpenAPI](xrd-cloud-compute-handoff/contracts/openapi.yaml)
- [Compute routes](xrd-cloud-compute-handoff/src/xrd_cloud_compute/api.py)
- [Compute request and response models](xrd-cloud-compute-handoff/src/xrd_cloud_compute/models.py)
- [Compute runtime and input validation](xrd-cloud-compute-handoff/src/xrd_cloud_compute/runtime.py)
- [Chemistry gateway allowlist](delta-sandbox-server/api_server/api/chem_xrd.py) and [forwarding implementation](delta-sandbox-server/api_server/server/xrd_service_client.py)
- [GSAS-II reference](xrd-cloud-compute-handoff/docs/GSASII_REFINEMENT_API_20261012.md)
- [PyXplore reference](xrd-cloud-compute-handoff/docs/PYXPLORE_API_20261010.md)
