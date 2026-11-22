# File Size Probe (`protein_tools` / `read_text_length`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

Probe a text file, `file://` URL or `http(s)://` URL and report its character count, line count
and readability (used to judge file scale before reading).
- `file_url` (required): local file path / `file://` URL / `http(s)` URL

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint read_text_length --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `file_url` | Local file path / `file://` URL / `http(s)` URL | - |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`;
  the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`
  and `download_url`. `resultjson` may be a single object or an array — read only the keys
  documented in this file, do not recursively search.
- `resultjson` holds the character count, line count and readability; no `download_url`.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Character count, line count and readability of a file or URL
- Presentation form: Short text (counts + readability)
- Downstream reuse: use before read_text to size a file and choose the read range
## Output Template

- Title: **File size probe result**
- Lead with the conclusion: character count, line count, readability
- Present as short natural-language text; do not invent content

## Boundaries & Failure Modes

- File-type parameters (`structure_file`/`sequence_file`/`file_url`/`source` etc.) take
  server-accessible URL/path strings, not local upload paths; a `download_url` or
  `pdb_url` returned by an upstream endpoint can be backfilled directly as downstream input.
- Make only the minimal calls needed to complete the task; `--data` carries only the fields
  declared by this endpoint. Do not invent enum values or branches beyond the required combinations.
- Do not pass off local tool (RDKit/pymatgen/LAMMPS/self-attached MCP) results as this endpoint's results;
  do not connect directly to Huada or gateway URLs.
- On failure, report a short summary of the CLI's raw error; do not blindly retry after remote computation
  timeouts (the outcome may be unknown because the task may already have happened).
