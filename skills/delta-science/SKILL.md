---
name: delta-science
description: "The unified entry point for the company's online Science capabilities; all calls go through Delta CLI. Use this Skill for compound, CID, SMILES or molecular-property lookup; batch PubChem and RDKit enrichment; molecular descriptors or similarity; crystal, CIF or space-group parsing; cloud XRD phase identification or refinement; materials-table modelling or candidate recommendations; Quantum ESPRESSO/QE DFT; LAMMPS; Bayesian optimisation from experimental data; reaction-condition optimisation; and any LDM/discovery-model, KRAS G12D small-molecule generation and optimisation, fixed-pool/PDF2Dock trajectory, or antibody CDRH3 optimisation task. Do not use the retired large-discovery-model Skill, legacy gateway scripts, web search or local scientific libraries to bypass Delta CLI. Return text directly for ordinary lookups, comparisons or checks by default; do not add JSON/CSV, report, image or chart steps unless the user explicitly asks to save, export, plot or generate a file."
metadata:
  requires:
    bins: ["delta-cli"]
  cliHelp: "delta-cli science --help"
---

# Delta Science

Turn natural-language research tasks into the smallest number of verifiable Delta CLI Science
calls. Expose only this Skill; select tools and operations, set parameters, hand off between tools,
and validate results within this Skill.

## Service-call boundary

- Route all online Science operations through Delta CLI: use `delta-cli science invoke` for
  read-only or JSON-compatible endpoints, `delta-cli science task` for calls with a persistent
  lifecycle, and `delta-cli science file` for raw files or multipart requests.
- Use the CLI's standard authentication and the Science service address derived from `base_url`
  (`{base_url}/science_tool`). Do not rewrite service routing through environment variables,
  command arguments or business URLs.
- Do not use `curl`, `requests`, `httpx`, a browser or PowerShell web commands to access company
  gateways or business-service URLs directly.
- Do not present local RDKit, pymatgen, LAMMPS, BO, regression or sandbox results as Science
  results. Local tools may be used for format conversion, file parsing or display, but state their
  source clearly and keep them separate from CLI results.
- Read the relevant reference before execution and use it to select the operation and request
  fields. If the reference is missing, outdated or inconsistent with the current catalogue, you
  may query the live catalogue. Never invent fields or enum values from memory.
- `tools.name` and `tool_endpoints.name` are the sole authoritative call names. The tool and
  endpoint passed to the CLI must exactly match the current database catalogue. The CLI does not
  map aliases, strip prefixes, infer profiles or retry under a different name after `not_found`.
  If a reference and the catalogue disagree, stop and report a configuration issue.
- Report a call as successful only when the CLI subprocess exits with code 0 and the top-level
  JSON `ok` is `true`. The CLI's top-level `data` contains the service response. Read fields only
  according to the envelope and business structure in the relevant reference; do not search
  recursively for plausible values or misreport business results such as `valid:false` as
  transport failures.

Template for JSON-compatible endpoints:

```text
delta-cli science invoke --tool TOOL --endpoint ENDPOINT \
  [--data JSON] [--params JSON] [--path-params JSON] [--headers JSON]
```

If a tool-proxy endpoint declares path parameters, additional upstream headers or file fields, use
`--path-params JSON`, `--headers JSON`, `--file PATH` (or `--file-base64 BASE64`), and the
optional `--content-type MIME`. `--params` means URL query parameters only and cannot replace
`--path-params`. These fields are forwarded as request-body
fields to `/api/v1/tools/invoke`. `science file invoke` is a separate interface for QE/Materials
Design file operations and cannot replace file uploads to tool-proxy endpoints.

Template for persistent tasks:

```text
delta-cli science task submit --tool TOOL --operation OPERATION \
  --input JSON --idempotency-key STABLE_KEY [--wait --timeout SECONDS]
delta-cli science task get TASK_ID
delta-cli science task cancel TASK_ID
delta-cli science task invocations TASK_ID
delta-cli science task artifacts TASK_ID
```

Template for file operations:

```text
delta-cli science file invoke --tool qe --endpoint artifact-upload \
  --file structure.cif --data '{"name":"structure.cif","role":"structure"}'
delta-cli science file invoke --tool materials-design --endpoint job-submit \
  --file train.xlsx --candidate-file candidates.xlsx --data CONFIG_JSON
delta-cli science file download --tool qe --endpoint artifact-content \
  --params '{"artifact_id":"sha256:<digest>"}' --output result.bin
```

Use `--params JSON` only when the reference explicitly defines fields as query parameters. Do not
concatenate JSON into command code; pass it as a single JSON argument using the calling
environment's safe argument-passing mechanism.

Controlled CLI adapters are available for Materials Design training-table multipart uploads,
QE raw artifact/custom PP uploads, and `Idempotency-Key`. Pass files through a `science file` file
flag, and pass idempotency keys through `science task submit --idempotency-key` or the dedicated
flag for the file operation. Do not disguise local paths, base64 or headers as ordinary `--data`
fields, and do not connect directly to the preflight Gateway.

Call only the operations needed to meet the goal. Run cross-tool tasks in dependency order within
the same Skill execution; downstream calls may use only verified business fields from the
previous step. For a known tool, do not add health, schema, catalogue, render, descriptor or file
calls by default. Make the minimum number of read-only calls only when the user requests them,
diagnosis requires them, or the reference disagrees with the live catalogue.

## Choose a tool

| Research goal | tool | Reference |
| --- | --- | --- |
| Compound identity, CID, synonyms, public properties, name-to-SMILES conversion | `pubchem` | [pubchem.md](references/pubchem.md) |
| SMILES/InChI, descriptors, fingerprints, similarity, rendering, substructure | `rdkit` | [rdkit.md](references/rdkit.md) |
| Inorganic formulae, CIF/POSCAR, crystal structures, space groups | `pymatgen` | [pymatgen.md](references/pymatgen.md) |
| Cloud XRD phase identification, XQueryer/XMatcher/XDecomposer, CIF simulation, MP500, artifacts and refinement jobs | `xrd` | [xrd.md](references/xrd.md) |
| Direct GSAS-II simulation or refinement | `gsasii` | [gsasii.md](references/gsasii.md) |
| Molecular dynamics, minimisation, thermo and output files | `lammps` | [lammps.md](references/lammps.md) |
| General optimisation of numeric, integer or categorical experimental variables | `delta-bo` | [delta-bo.md](references/delta-bo.md) |
| Materials-table surrogates, candidate spaces, EI/PI/UCB and asynchronous recommendation jobs | `materials-design` | [materials-design.md](references/materials-design.md) |
| Quantum ESPRESSO/QE PP, asynchronous DFT jobs, logs and artifacts | `qe` | [qe.md](references/qe.md) |
| Fixed-pool next-SMILES, PDF2Dock and molecular BO trajectories | `ldm-bo` | [ldm-bo.md](references/ldm-bo.md) |
| KRAS G12D small-molecule generation and iterative multi-objective Vina/activity optimisation | `strbo` | [strbo.md](references/strbo.md) |
| Reaction-condition initialisation and next-batch recommendations based on measured yields | `synbo` | [synbo.md](references/synbo.md) |
| Antibody CDRH3 generation/evaluation and AntBO job management | `antbo` | [antbo.md](references/antbo.md) |

When the user describes a complete research workflow using terms such as “LDM”, “discovery
model”, “small-molecule drug LDM” or “antibody LDM”, first select the actual backend tool based on
the task goal, then read only the reference for that backend. `ldm-bo` is a callable tool; `LDM`
itself is not a `--tool` value. For “batch molecular enrichment” or similar requests, use the
actual tools in sequence: resolve names/identifiers with `pubchem`, then standardise structures
or calculate molecular properties with `rdkit`.

When the tool is clear, read its reference directly; it already includes the operations, parameters
and minimal scenarios. Do not read documentation for other tools. Split cross-tool tasks using
this Skill's routing rules and read only the references for tools actually involved. Do not rely
on separate routing, service, workflow or catalogue documents.

This table lists research tools with maintained references; it is not a static server catalogue.
If the user names a new tool absent from the table, or a reference is missing, outdated or
inconsistent with CLI output, run `delta-cli science list`, then run
`delta-cli science endpoints list <tool>` once using the exact tool name returned by the catalogue.
Both commands must exit with code 0 and return top-level `ok:true`. Do not probe with an empty
body, invalid parameters, source code or direct HTTP. If live endpoint metadata does not provide
enough request-field contract to construct a safe request, say “The catalogue lists the tool, but
the server has not provided a schema that can be used to construct a safe request.” Do not guess
the body, fuzzy-match or transform names. A new tool therefore does not require a CLI change; add
a single-tool reference only after confirming that it is a distinct real tool and needs automatic
natural-language routing or parameter construction.

## Routing boundaries

- Use PubChem first for an ordinary compound name. Pass a successfully returned SMILES to RDKit
  only when structural calculations are needed.
- Prefer pymatgen for inorganic formulae, composition and formula weight; do not calculate these
  with PubChem or a local element table.
- Use `xrd` for cloud powder-XRD phase identification, peak matching, phase decomposition,
  CIF/MP500 operations and refinement jobs. Use `gsasii` only when directly requesting the
  GSAS-II tool. Do not conflate their scores, job states or backend semantics.
- Use Materials Design for materials-table modelling and candidate ranking. Keep controllable
  variables, objectives, candidate spaces, cross-validation and uncertainty distinct; treat
  recommendations only as hypotheses to validate.
- Use QE for explicit electronic-structure calculations. First handle the complete element set,
  PP policy/lock and structure artifact, then submit the asynchronous workflow. Do not conflate
  job acceptance, scheduler completion and solver convergence.
- Use Delta-BO for general experimental variables; LDM-BO for an existing fixed SMILES candidate
  pool or PDF2Dock trajectory; STRBO for small-molecule generation and iteration against the
  server-fixed KRAS G12D target; SynBO for coupling reactions, reaction conditions and historical
  yields; and AntBO for antibodies/CDRH3. Do not mix these tools.
- Do not hand online LDM, STRBO, AntBO or LDM-BO tasks to the retired
  `large-discovery-model` Skill, run its gateway scripts or use its built-in service addresses.
  Offline demonstrations are not company Science results. Explain this boundary only when the
  user explicitly asks not to use company resources; this Skill must still not run the retired
  Skill.
- GSAS-II refinement requires real powder data, instrument parameters and a phase CIF. LAMMPS
  requires explicit input/data/force-field files. Never fabricate experimental data, CIFs, force
  fields, historical observations or optimisation results.

## Safety, retries and artifacts

- Require the user's explicit authorisation for remote mutations such as `run-default-job`,
  `run` and `stop`. Do not retry when the outcome is unknown, the request times out or the
  connection drops, because the remote action may already have occurred.
- Treat parameter validation errors, empty recommendations and business-backend failures as
  failures for the current attempt. For `health`, the catalogue and other clearly read-only,
  idempotent operations, network errors such as 502, 504 or timeout may be retried once with the
  same parameters. Make at most one SynBO business call per user task; do not switch models or
  acquisition functions, or substitute a local algorithm.
- After the CLI's first failure, return a short summary of the original error. If the user
  explicitly asks for troubleshooting, you may run read-only `delta-cli auth status`,
  `delta-cli config show` or `delta-cli ... --help`. Do not log in, change configuration or
  environment variables, fabricate a UID, token or API key, or retry with a changed operation,
  parameters or call chain.
- Treat `X-User-Uid`, login, quota and permission errors as terminal authentication errors; relay
  only the original error and login guidance. The Skill must never log in, inspect credentials,
  guess a user identifier or try to bypass quota.
- Run heavy calls serially. A client timeout does not mean the remote computation was cancelled.
- Do not create CSV files, images or reports unless the user asks for a file. Write internal
  hand-off files only to the current `WORKSPACE_ROOT`; do not read another session's workspace or
  historical results to fill in the current task.
- Paths, JSON, charts or reports automatically attached by an outer planner do not count as an
  explicit user request. If the task is essentially a lookup, comparison or check, return the
  minimum text result directly; do not repeat Science calls to satisfy an added artifact request.
- Decode only documented fields from binary artifacts; validate PNG magic bytes.
- If the user explicitly asks for public background information or literature, web searches are
  permitted, but do not present them as Science calls or use them to replace CLI results. Label
  the sources separately.

## Output

Project the business response defined by the relevant reference from the current CLI `data` into
the minimum result the user requested. Preserve strings, numbers, warnings and sources verbatim.
Do not add units, mechanisms, citations, links, predictions or remembered information that the
service did not return. Do not describe predictions as measured results.
Once the last required business result has been obtained successfully, project it directly into
the final reply. Do not call the CLI again to sort, format, make a table or summarise, and do not
manually copy the result into a new data literal. Perform simple filtering, comparison and text
organisation directly in the final reply.

On success, return only bounded plain text derived from the current CLI business result; on
failure, return only a short summary of the original CLI error. Do not recalculate, rewrite or
replace a successful or failed Science result with manual recommendations.

Include the following with every successful result:

```text
Evidence boundary: business results in the current Delta CLI `data` only
Call chain: delta-cli
Do not add information absent from the response: yes
```

## Completion criteria

- Every online operation is supported by evidence that the CLI exited with code 0 and returned
  top-level `ok:true`.
- Every scientific value comes from a business field in the current call's `data`, as defined by
  the reference.
- Downstream inputs come from verified upstream results in the current task.
- Failures are classified accurately as configuration, CLI, parameter, Science Server,
  business-service or timeout failures.
- No direct HTTP, local scientific library, cross-session file or manually substituted result was
  used.
