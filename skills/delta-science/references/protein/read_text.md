# File Line-Range Read (`protein_tools` / `read_text`)
This endpoint is a real endpoint of the `protein_tools` tool. It can only be
called via `delta-cli science invoke`; the business response described below lives
under the CLI top-level `data` — read fields as documented in this file, do not
recursively search. This file only documents the endpoint schema; it does not
authorize direct HTTP. Endpoint names are authoritative as returned by
`delta-cli science endpoints list protein_tools`; use them verbatim — never
guess, truncate, or alias.
## Overview

Read a text file, `file://` URL or `http(s)://` URL by a half-open line range `[start, end)` (0-based).
- `file_url` (required): local file path / `file://` URL / `http(s)` URL
- `start` (int, default 0): start line (inclusive)
- `end` (int, default 1): end line (exclusive)
- Use `read_text_length` first when the file size/line count is unknown.

## Invocation

```text
delta-cli science invoke --tool protein_tools --endpoint read_text --data JSON
```

Request fields:

| Field | Description | Default |
|---|---|---|
| `file_url` | Local file path / `file://` URL / `http(s)` URL | - |
| `start` | Start line (inclusive), 0-based | 0 |
| `end` | End line (exclusive), 0-based | 1 |

## Response

- CLI top-level envelope: a call succeeds only when the exit code is 0 AND `ok` is `true`;
  the service response lives under `data`.
- Server-side contract: `status` (success/error/partial), `message`, `tool_type`, `resultjson`
  and `download_url`. `resultjson` may be a single object or an array — read only the keys
  documented in this file, do not recursively search.
- `resultjson` holds the requested text lines; this endpoint returns no `download_url`.

## Output Projection

> Verification status: derived from ToolSpec/agent templates; pending live calibration

- Projection content: Requested line-range text content [start, end) from a file or URL
- Presentation form: Verbatim inline text of the returned lines
- Downstream reuse: pair with read_text_length to size the file before reading
## Output Template

- Title: **File read result**
- Lead with the requested line range; show the returned lines verbatim as inline text
- Do not summarize or invent content not present in the returned lines

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
