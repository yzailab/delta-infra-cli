---
name: delta-protein
description: "The unified entry point for the company's Huada protein/bioinformatics online analysis capabilities — all calls go through the Delta CLI. Any zero-shot or multi-site mutation prediction, structure prediction (Protenix/ESMFold2), sequence extraction (PDB/FASTA/Foldseek), MSA computation, optimal-pH and solubility prediction for proteins/mutants, enzyme kinetic parameters (kcat/Km), consensus mutation and EVcouplings coevolutionary analysis, protein design (MPNN/RFdiffusion3), molecular docking and Vina scoring, pocket prediction, surface charge, flexible sites, tunnel analysis, PLIP/PISA interactions, active sites, InterPro/ConSurf annotations, single-site mutation primer design, and PubMed/PubChem/UniProt/ProTrek retrieval — all protein analysis tasks must use this Skill; call the huada_protein_tools endpoint via delta-cli, and never bypass the Delta CLI through local MCP servers, legacy gateway scripts, or web search. Simple queries, comparisons or verifications return concise text directly; analysis/multi-step/design/mutation/evaluation tasks produce one structured Markdown report (skeleton and per-task-type chapter structure in SKILL.md) after all endpoints complete. By default, do not create additional JSON/CSV, image or chart files unless the user explicitly asks."
metadata:
  requires:
    bins: ["delta-cli"]
  cliHelp: "delta-cli science --help"
---

# Delta Protein

Convert natural-language protein research tasks into the minimal set of verifiable
Delta CLI Science calls. Expose only this Skill; endpoint selection, parameters,
cross-endpoint handoffs and result validation are all handled inside this Skill. All
endpoints belong to the single tool `huada_protein_tools`, and each registered
endpoint is a single tool call (no workflow endpoints exist).

## Service Call Boundary

- All online protein/bioinformatics operations ultimately go through the Delta CLI:
  JSON-compatible endpoints use
  `delta-cli science invoke --tool huada_protein_tools --endpoint <name> --data JSON`;
  file/binary artifacts use `delta-cli science file download`.
- Use the CLI's standard authentication and the Science service address derived from
  `base_url` (`{base_url}/science_tool`). Never override the service route via
  environment variables, command-line arguments or business URLs.
- It is forbidden to access Huada, the Gateway, or any business service URL directly
  with `curl`, `requests`, `httpx`, a browser, or PowerShell web commands; do not
  assemble/attach a local MCP tool server.
- Local tools (RDKit/pymatgen/self-run algorithms, etc.) may be used for format
  conversion, file parsing or display, but their origin must be made explicit and kept
  separate from CLI results; they must never be passed off as Science results.
- Before executing, read the corresponding reference and combine required fields and
  request parameters per that reference; when a reference is missing, stale, or
  inconsistent with the live catalog, query the real-time catalog with
  `delta-cli science list` and `delta-cli science endpoints list huada_protein_tools`.
  Never create fields, enum values or branches beyond the required combinations from memory.
- Endpoint names are the single authoritative invocation names. The endpoint passed to
  the CLI must match the catalog exactly; do not alias-map (the `protein_dock` tool's
  endpoint in the catalog is `dock`), trim prefixes, or rename-and-retry after a
  `not_found`. When inconsistent with the catalog, terminate and report the
  configuration problem.
- A call may only be reported as successful when the CLI subprocess exits 0 AND the
  top-level `ok` in its JSON output is `true`. The CLI top-level `data` holds the
  service response; read the server-side return contract per the corresponding
  reference — do not recursively search for plausible-looking values, and do not
  misreport business results such as `status:error` as transport failures.
- Fields marked as "default" in a reference or ToolSpec are fill-in conveniences for
  the backend agent orchestration layer; they are NOT omissible when calling the CLI
  directly. As long as the server validates a field as required, it must be passed
  explicitly (e.g. `DB` for `consurf_predict`); when validation reports a missing
  field, supply it per the server error and write the live-verified value back into
  the reference.
- JSON-bearing arguments must follow the shell rules of the calling environment;
  never use bare POSIX single quotes on Windows.

### Cross-platform JSON Passing Convention (Mandatory)

| Platform / execution environment | Authoritative way to pass `--data` / `--params` JSON |
|---|---|
| Linux / macOS (sh/bash) | `--data '{"k":"v"}'` (POSIX single quotes, verbatim) |
| Windows cmd.exe | `--data "{\"k\":\"v\"}"` (cmd double quotes + `\"` escaping) |
| Windows PowerShell 5.1 / opencode(win32) | always parse via cmd: `cmd /c '... --data "{\"k\":\"v\"}"'` (outer PowerShell uses single quotes verbatim, inner layer uses cmd `\"` escaping), or write the full command to a `.bat`/`.cmd` file and run it |

Rules:

- Do not let PowerShell parse `\"` or bare JSON double quotes: PS 5.1 strips embedded
  double quotes from arguments when invoking native binaries (`{"k":"v"}` → `{k:v}`,
  reporting `invalid character 'k'`) or breaks apart the outer quoted string.
- On win32, opencode's Bash tool is PowerShell: every `delta-cli` call carrying JSON
  must be wrapped with `cmd /c '<cmd syntax>'` or a `.bat` file, with all `--data`
  JSON keys/values escaped as `\"`.
- On Linux/macOS do not switch to `\"` for Windows compatibility; standard POSIX
  single quotes are fine; documentation examples are host-neutral and actual execution
  follows this table.

Call template:

```text
delta-cli science invoke --tool huada_protein_tools --endpoint ENDPOINT --data JSON
```

File artifact download template (when `download_url` points to raw files such as
PDB/XLSX/FASTA/ZIP):

```text
delta-cli science file download --tool huada_protein_tools --endpoint ENDPOINT \
  --params '{"...":"..."}' --output <path>
```

Only call the endpoints needed to achieve the goal. File-type parameters
(`structure_file`/`sequence_file`/`msa_file`/`mutant_list_file` etc.) take
server-accessible URL/path strings, not local upload paths; when a genuine local
upload is needed, first derive a `download_url` via endpoints such as
generate_msa/foldseek/structure_to_sequence and backfill it.

## Choosing an Endpoint

| Protein task | endpoint | Detailed rules |
| --- | --- | --- |
| Zero-shot single-site mutant candidates (no experimental data) | `zero_shot_mutant_candidates` | [zero_shot_mutant_candidates.md](references/zero_shot_mutant_candidates.md) |
| n-site/multi-site mutation activity regression (data available, explicit n) | `protein_evolution` | [protein_evolution.md](references/protein_evolution.md) |
| Multi-site combinatorial mutation activity (training data, n unspecified) | `multievolve` | [multievolve.md](references/multievolve.md) |
| Consensus mutation analysis (aligned MSA) | `consensus_mutation` | [consensus_mutation.md](references/consensus_mutation.md) |
| EVcouplings coevolutionary mutation scoring | `evcouplings_mutation` | [evcouplings_mutation.md](references/evcouplings_mutation.md) |
| Multi-model mutation result summary (final chain step) | `summarize_result` | [summarize_result.md](references/summarize_result.md) |
| Single-site mutation primer design (REAP Step 7) | `reap_design_primer` | [reap_design_primer.md](references/reap_design_primer.md) |
| Crop a protein sequence by regions | `crop_sequence` | [crop_sequence.md](references/crop_sequence.md) |
| Pure protein structure prediction | `protenix` | [protenix.md](references/protenix.md) |
| Protein/DNA/RNA/ligand complex structure prediction | `esmfold2_predict` | [esmfold2_predict.md](references/esmfold2_predict.md) |
| Extract protein sequence from PDB/CIF | `structure_to_sequence` | [structure_to_sequence.md](references/structure_to_sequence.md) |
| Extract protein sequence from FASTA | `fasta_to_sequence` | [fasta_to_sequence.md](references/fasta_to_sequence.md) |
| Extract Foldseek/SaProt sequence from structure | `foldseek` | [foldseek.md](references/foldseek.md) |
| Compute homolog MSA (MMseqs2, uniref100) | `generate_msa` | [generate_msa.md](references/generate_msa.md) |
| Protein optimal pH prediction | `ephod_predict_protein` | [ephod_predict_protein.md](references/ephod_predict_protein.md) |
| Mutant optimal pH prediction | `ephod_predict_mutation` | [ephod_predict_mutation.md](references/ephod_predict_mutation.md) |
| Protein solubility and isoelectric point prediction | `protein_sol_predict_protein` | [protein_sol_predict_protein.md](references/protein_sol_predict_protein.md) |
| Mutant solubility prediction | `protein_sol_predict_mutation` | [protein_sol_predict_mutation.md](references/protein_sol_predict_mutation.md) |
| Enzyme kinetic parameter prediction (CataPro) | `catapro_predict` | [catapro_predict.md](references/catapro_predict.md) |
| Enzyme kinetic parameter prediction (CatPred) | `catpred_predict` | [catpred_predict.md](references/catpred_predict.md) |
| De novo protein design (RFdiffusion3+MPNN) | `protein_design` | [protein_design.md](references/protein_design.md) |
| Protein scaffold design (RFdiffusion3) | `rfd3_design` | [rfd3_design.md](references/rfd3_design.md) |
| MPNN sequence design (given structure) | `mpnn_design_sequence` | [mpnn_design_sequence.md](references/mpnn_design_sequence.md) |
| Protein-ligand molecular docking | `dock` | [dock.md](references/dock.md) |
| Single-pose scoring of a complex (Vina score_only) | `dock_score` | [dock_score.md](references/dock_score.md) |
| Pocket prediction (p2rank) | `pocket_prediction` | [pocket_prediction.md](references/pocket_prediction.md) |
| Surface residue charge analysis (ProCaliper+APBS) | `surface_charge` | [surface_charge.md](references/surface_charge.md) |
| Flexible-site analysis (B-factor) | `bfitter` | [bfitter.md](references/bfitter.md) |
| Tunnel/channel analysis (CAVER) | `caver_tunnel_analyze` | [caver_tunnel_analyze.md](references/caver_tunnel_analyze.md) |
| Protein-ligand interaction analysis | `plip_analyze` | [plip_analyze.md](references/plip_analyze.md) |
| Protein interface analysis (PDBePISA) | `pisa_query` | [pisa_query.md](references/pisa_query.md) |
| Residue conservation analysis (ConSurf) | `consurf_predict` | [consurf_predict.md](references/consurf_predict.md) |
| Enzyme active-site prediction (EasIFA) | `easifa_predict_active_site` | [easifa_predict_active_site.md](references/easifa_predict_active_site.md) |
| Domain/GO annotation (InterProScan) | `interpro_analyze` | [interpro_analyze.md](references/interpro_analyze.md) |
| Open-ended protein retrieval (text/sequence/structure) | `protrek_search` | [protrek_search.md](references/protrek_search.md) |
| Known protein metadata query | `uniprot_query` | [uniprot_query.md](references/uniprot_query.md) |
| Batch protein metadata query | `uniprot_batch_query` | [uniprot_batch_query.md](references/uniprot_batch_query.md) |
| PubMed literature search | `pubmed_search` | [pubmed_search.md](references/pubmed_search.md) |
| PubChem compound search | `pubchem_search` | [pubchem_search.md](references/pubchem_search.md) |

When the tool is clear, read the selected endpoint's reference directly — it already
contains the required combinations, request fields, defaults and outputs; do not read
other endpoint docs. Multi-step tasks are decomposed by this Skill's routing rules,
reading only the references of the endpoints actually involved in each step.

## Routing Boundaries

- Use `protenix` for pure protein structure prediction; use `esmfold2_predict` for
  complexes involving DNA/RNA/ligands; never mix them.
- `ephod_predict_protein`/`protein_sol_predict_protein` accept
  `protein_list`/`protein_list_file` (sequence-file URLs); the `..._mutation`
  variants accept mutation lists; protein-level and mutation-level inputs cannot be
  swapped.
- `uniprot_query` is for exact metadata queries on known accession/gene/protein
  names; open-ended functional/reaction/family retrieval uses `protrek_search`; the
  two are not interchangeable.
- Both `catpred_predict` and `catapro_predict` predict kcat, Km and kcat/Km; call each per
  its reference's required fields and constraints — the results are not
  interchangeable in meaning.
- Without experimental data use `zero_shot_mutant_candidates`; with mutation activity
  data and an explicit n-site/multi-site mutation specification use
  `protein_evolution`; when the number of sites is unspecified but training data is
  provided, use `multievolve`.

This Skill has no workflow endpoints. For multi-step chains, call multiple endpoints
in dependency order, and for downstream `structure_file`/`msa_file`/box parameters
only use business fields verified in the previous step:

- `generate_msa`'s output `download_url` becomes the `msa_file` of
  `consensus_mutation`/`evcouplings_mutation`/`zero_shot_mutant_candidates`;
- `pocket_prediction`'s output `download_url` (cropped pocket PDB) becomes the
  `structure_file` of `rfd3_design`;
- `dock`'s rank-1 `pdb_url` (clean complex PDB) becomes the `structure_file` of
  `plip_analyze`;
- structure-prediction/sequence-extraction outputs feed downstream
  mutation/design/property endpoints; validate success before transitioning.
- `summarize_result` consumes only a URL list of multiple prediction-result files and
  is the final step of a mutation-prediction chain.

By default, do not make extra health, catalog or file-operation calls beyond known
endpoints; the minimal set of read-only calls is acceptable when the user requests it,
diagnostics require it, or a reference is inconsistent with the live catalog.

## Input Handling

- Parameter source priority: (1) provided verbatim by the user, (2) fields already
  confirmed in the session (protein sequence/structure/mutation list), (3)
  `resultjson`/`download_url`/`pdb_url` verified from upstream endpoints. Fabricating
  missing parameters is forbidden.
- In-session reuse: each step of a multi-step task may only use business fields
  verified in the previous step of the current task; do not pull historical workspace
  results from other sessions to complete the current task. For concrete backfill
  chains of upstream artifacts see "Downstream reuse" in each reference's Output
  Projection; parameter-level examples are in "Routing Boundaries".
- Defaults vs server-required: fields marked as "default" in a reference or ToolSpec
  are fill-in conveniences for the backend agent orchestration layer; they are NOT
  omissible when calling the CLI directly. As long as the server validates a field as
  required, it must be passed explicitly (e.g. `DB` for `consurf_predict`). When
  validation reports a missing field, supply it per the server error and write the
  live-verified value back into the reference.
- File-type parameters (`structure_file`/`sequence_file`/`fasta_file`/`msa_file`/
  `mutant_list_file`/`training_dataset`/`result_files` etc.) take server-accessible
  URL/path strings, not local upload paths; when a genuine local upload is needed,
  first derive a `download_url` via generate_msa/foldseek/structure_to_sequence and
  backfill it.
- Pass multi-valued parameters per the type in the corresponding reference: string
  lists (`model_name`/`cofactors`/`target_columns`), numbers
  (`topk`/`rfd3_n`/`max_results`), booleans (`fix`/`use_msa`), region lists
  (`regions` of `crop_sequence`). Enum values (`input_type`/`query_type`/`DB`/
  `sampling_method` etc.) may only take the values listed in the reference.

## Safety, Retry & Artifacts

- Remote tasks such as submission, docking, and design require explicit user
  authorization. Do not retry when the outcome is unknown, timed out, or
  disconnected — the remote computation may already have happened; do not retry
  `status:error` or empty results with different parameters.
- For catalog and clearly read-only, idempotent queries, network-class 502/504 or
  timeout may be retried at most once with identical parameters.
- After a failed CLI call, return a short summary of the raw error. When the user
  explicitly asks for troubleshooting, run read-only `delta-cli auth status`,
  `delta-cli config show` or `delta-cli ... --help`; never log in yourself, modify
  config or environment variables, forge a UID, token or API key, or retry by
  changing the endpoint, parameters or call chain.
- `X-User-Uid`, login, quota or permission errors are terminal authentication errors;
  forward only the raw error and the login hint. The Skill never logs in by itself,
  checks credentials, guesses user identity, or attempts to circumvent quota.
- Heavy calls run serially. A client timeout does not mean the remote computation was
  cancelled.
- Do not create CSV, images or reports unless the user asks for files; after
  downloading binary artifacts, verify them by filename/MIME.
- Never fabricate protein sequences, structures, mutations, activities, pH,
  solubility, energies, or infer their mechanisms; prediction results must not be
  described as measured results; do not present model variance or scores as
  experimental error.
- Paths, JSON, charts or reports auto-attached by the outer planner are not equivalent
  to an explicit user request. If the task is essentially just a query, comparison or
  verification, return the minimal text result directly.
- When the user explicitly asks for public background material or literature, web
  search is allowed, but it must not be presented as a Science service call or
  substitute for CLI results; label sources separately.

## Output

Compose the final answer from the business response in the current CLI `data` as
defined by the corresponding reference; preserve strings, numbers, warnings and
provenance verbatim. Do not add units, mechanisms, citations, links, predicted values
or memorized knowledge the service did not return. Re-running the CLI to sort, lay
out, tabulate or summarize is forbidden, as is hand-copying results into new data
literals; simple filtering, comparison and text organization happen directly in the
final answer.

### Output Modes (two-mode decision)

- **Report mode (default)**: whenever the task produces prediction/analysis/design
  results, output a report even for a single endpoint: property predictions
  (ephod/protein_sol/catpred/catapro), structure prediction and sequence extraction,
  mutation prediction and design, docking/scoring/pocket/charge/tunnel/conservation/
  active-site/annotation, primer design, etc. Also report mode when the user
  explicitly asks for a "report/detailed/summary", or when multiple endpoints/
  reviews/comparisons are involved. **The whole task produces exactly one report**:
  no matter how many endpoints are called, run all endpoints in sequence first
  (validate only `ok:true` at each step and stash key fields), then generate the
  report once at the end.
- **Concise mode (value-lookup only)**: use it only when the goal is to "look up a
  ready-made value" — answer in the most minimal text directly, without the report
  skeleton — e.g. `pubchem_search` for a single compound's molecular weight/formula,
  `uniprot_query` for a single entry's sequence/metadata,
  `protrek_search`/`pubmed_search` as pure information retrieval display. **Whenever
  prediction/analysis endpoints such as `ephod_predict_*` are called — even just
  once — report mode is mandatory**; do not downgrade to concise mode because of a
  "single return".

### Report Mode: one report for the whole task (skeleton)

The report follows fixed numbered sections; numbering is consecutive and never skips.
If a section genuinely has no content, write "No relevant results in this section"
and state why; never delete the heading. Generic skeleton:

- `## 1. Analysis Overview`: analysis goal / endpoints & methods used / input data
  sources.
- `## 2. Core Results`: `### 2.1 Key findings` (key numbers **bold**); `### 2.2
  Detailed data` (one paragraph per endpoint, see "Tool result snippets"; tables go in
  the relevant subsection, preceded by an intro sentence).
- `## 3. Data & Downloads`: all `download_url`/`pdb_url`/`zip_download_url` listed as
  `[name](full URL)` with type/use noted; when there are none, write "This analysis
  generated no downloadable files".
- `## 4. Notes & Recommendations`: prediction limitations, model differences,
  experimental validation suggestions.

When intent is clear, replace the skeleton with the matched intent-based section
structure; for mixed types arrange per "Mixed types / others".

### Report Mode: tool result snippets

Under `### 2.2 Detailed data` (or the matching subsection of an intent-based
section), one paragraph per endpoint, formatted as:

- `### Tool result: <endpoint display name> (step N)` + `**Status**: succeeded /
  failed (with error summary)`.
- Data presented per that endpoint's reference "Output template";
  `summarize_result` gives the full overview table (≤100 rows, prompt download
  beyond); `pubmed_search` uses a paper table; key numbers bolded.
- Structure files (`.pdb`/`.cif`/`.ent`) are presented as plain Markdown links
  `[structure result (.pdb)](full URL)` in "Data & Downloads"; **do not use
  `:::structure` custom blocks** (backend/frontend-only; the TUI on
  Windows/Linux/macOS does not render them and shows raw text).
- A failed tool states the failure reason in its paragraph; never fabricate results;
  endpoints not executed do not appear in the report.

### Intent-based report sections (by task type)

| Task type | Report sections |
|---|---|
| mutation (mutation prediction with data: protein_evolution/multievolve/consensus/EVcouplings/zero-shot + summary) | 1 Analysis Overview / 2 Recommended mutation sites [2.1 Top candidate mutation table (position/wild type/mutation/model/score/predicted effect); 2.2 Conservation reading (if any, annotation only); 2.3 Multi-model comparison (if any)] / 3 Overall recommendation / 4 Data & Downloads / 5 Notes |
| structure (protenix/esmfold2/sequence extraction/MSA) | 1 Analysis Overview / 2 Structure information [2.1 Quality assessment (confidence/trusted regions); 2.2 Key structural features; 2.3 Sequence information] / 3 Structure files & downloads / 4 Analysis recommendations / 5 Notes |
| property (pH/solubility/enzyme kinetics) | 1 Analysis Overview / 2 Prediction results [2.1 Key value summary table (property/predicted value/unit/description); 2.2 Wild type vs mutants, if any] / 3 Result interpretation / 4 Data & Downloads / 5 Notes |
| design (protein_design/rfd3_design/mpnn_design_sequence) | 1 Design overview / 2 Designed sequences [2.1 Representative sequences (monospace); 2.2 Differences from the original sequence, if any] / 3 Design scores (table) / 4 Design strategy analysis / 5 Data & Downloads / 6 Follow-up suggestions |
| search (pubmed/pubchem/uniprot/protrek) | 1 Search overview (keywords/databases/hit count) / 2 Result details (literature grouped by PMID; compound/entry lists) / 3 Key findings & summary / 4 Data & Downloads / 5 Notes |
| analysis (active site/conservation/interface/interaction/pocket/charge/tunnel) | 1 Analysis overview / 2 Active site (table: position/residue/site type/function annotation/confidence) / 3 Conserved residues (table: position/residue/score/rank/conclusion/functional significance) / 4 Functional interpretation / 5 Data & Downloads / 6 Research recommendations |
| Mixed types / others | 1 Analysis flow overview (actual steps & dependencies) / 2 Per-endpoint results (each `### 2.x` per endpoint using its Output template) / 3 Combined analysis / 4 Data & Downloads / 5 Notes & recommendations |

Conservation reading fixed semantics: higher `conserved_score` = less conserved,
lower = more conserved; higher `conserved_rank` = more conserved (1,2,3 are usually
variable residues, 7,8,9 are usually conserved).

### Report Mode: organization rules (aligned with agent content orchestration)

- Multi-endpoint reports are organized by the actual call order, with later results
  citing earlier ones as evidence (note the source field); cross-tool references are
  noted at the end of the relevant subsection rather than repeating the full data;
  only cite fields verified in the current task.
- Tabulate only when the user needs it or the data suits it; column names restated in
  natural language, never exposing raw JSON key names; keep original references
  (mutations as `Y126A/Y206F`, PMIDs in the last table column).

On success, return only bounded text generated from the current CLI business result;
on failure, return only a short summary of the CLI's raw error.

### Keep Execution-layer Details Internal

- Answers present only business results, the necessary interpretation basis,
  download links and evidence boundaries; **do not output execution details**,
  including but not limited to:
  - parameters/defaults/required values (e.g. `DB=UNIREF100`, `chain=A`,
    `max_results`) — include them in the command, don't restate them in prose;
  - invocation details (`cmd /c` wrapping, PowerShell escaping, `.bat`, direct exe
    call);
  - working process (retry counts, 503, temp files, quota/credit consumption).
- Endpoints with defaults/server-required fields still set the parameters when
  executing, but the display only carries business data (e.g. ConSurf output lists
  conserved positions, not "called with `DB=UNIREF100`").
- After a successful result, give the final answer directly; do not proactively offer
  follow-ups such as "want me to re-run verification / generate a new link"
  (re-running the CLI for verification is forbidden) unless the user explicitly asks.

Any URL (`download_url`, `pdb_url`, service-returned links, etc.) must be rendered in
one of the following two **safe forms**; bare text URLs are forbidden in prose (to
prevent Markdown treating `_..._` as italics and stripping underscores, which breaks
links):

- **inline code backticks** wrapping the full URL, e.g.
  `` `https://delta-bucket-public.yangtzeailab.com/toolResultFile/protein-test/protein_00735e8a_20261012_103005.xlsx` ``; or
- **Markdown link** `[name](full URL)` — underscores in the link target are preserved
  from italic handling, e.g.
  `[result file](https://delta-bucket-public.yangtzeailab.com/toolResultFile/protein-test/protein_00735e8a_20261012_103005.xlsx)`.

Also state the file type and use. Whenever a URL is cited, verify it against the raw
JSON returned by the CLI (fields within `data`), not against rendered text.

Keep after every successful result:

```text
Evidence boundary: only business results from the current Delta CLI `data`
Call chain: delta-cli
No supplementation of unreturned content: yes
```

## Completion Criteria

- Every online operation is evidenced by a CLI exit code of 0 and top-level
  `ok:true`;
- Every scientific number comes from a business field in the current call's `data`,
  as defined by the reference;
- Downstream inputs come from upstream results verified in the current task;
- Failures are correctly classified as config, CLI, parameter, Science Server,
  business service or timeout;
- No direct HTTP, local science library, cross-session file or manual result
  substitutes.