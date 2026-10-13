#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
delta-protein reference generator / checker.

Self-contained (stdlib only). Reads scripts/output_metadata.json and, for every
endpoint, idempotently inserts/updates the `## Output Projection` and
`## Output Template` sections in references/<endpoint>.md. Run it again after
metadata changes to regenerate cleanly.

Usage:
  python scripts/gen_references.py                  # regenerate Output Projection/Template sections
  python scripts/gen_references.py --check          # validate all references + SKILL links
  python scripts/gen_references.py --sync <dir>     # copy references + SKILL.md to an install dir
"""
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # skills/delta-protein
REFS = os.path.join(BASE, "references")
SKILL = os.path.join(BASE, "SKILL.md")
META = os.path.join(BASE, "scripts", "output_metadata.json")

EXPECTED_SECTIONS = ["## Overview", "## Invocation", "## Response", "## Output Projection", "## Output Template", "## Boundaries & Failure Modes"]

DEFAULT_TEMPLATE = (
    "- Title: `**{tool_display_name} analysis result**`\n"
    "- Lead with the conclusion: summarize key results from resultjson and what they mean for the user's question; present data in natural language or friendly table column names, not raw JSON key names.\n"
    "- Downloads: when a `download_url` is present, give `[name](full URL)` in the \"Result files & downloads\" section."
)


def load_meta():
    with open(META, encoding="utf-8") as f:
        return json.load(f)


def build_projection(meta):
    prov = "verified by a real `delta-cli` invocation" if meta["provenance"] == "tested" else "derived from ToolSpec/agent templates; pending live calibration"
    return "\n".join([
        "## Output Projection",
        "",
        f"> Verification status: {prov}",
        "",
        f"- Projection content: {meta['project']}",
        f"- Presentation form: {meta['form']}",
        f"- Downstream reuse: {meta['downstream']}",
        "",
    ])


def build_template(meta):
    tpl = meta.get("output_template")
    if not tpl:
        tpl = DEFAULT_TEMPLATE.replace("{tool_display_name}", meta.get("display_name", "Endpoint"))
    tpl = tpl.strip()
    return "## Output Template\n\n" + tpl + "\n\n"


def upsert_projection(lines, block):
    idx = next((i for i, l in enumerate(lines) if l.strip() == "## Output Projection"), None)
    if idx is None:
        idx = next((i for i, l in enumerate(lines) if l.strip() == "## Output Template"), None)
    if idx is not None:
        # Walk from the generated-block heading and cut at the first heading that
        # does NOT belong to the generated block (## Output Projection /
        # ## Output Template). This keeps regeneration idempotent: the whole
        # generated region is replaced instead of leaving a stale duplicate.
        end = next(
            (i for i in range(idx + 1, len(lines))
             if lines[i].startswith("## ") and lines[i].strip() not in ("## Output Projection", "## Output Template")),
            len(lines),
        )
        return lines[:idx] + block.splitlines(True) + lines[end:]
    insert_at = next((i for i, l in enumerate(lines) if l.startswith("## Boundaries & Failure Modes")), len(lines))
    return lines[:insert_at] + block.splitlines(True) + lines[insert_at:]


def regen():
    meta = load_meta()
    n = 0
    for ep, m in sorted(meta.items()):
        path = os.path.join(REFS, ep + ".md")
        if not os.path.exists(path):
            print(f"MISSING reference: {ep}.md", file=sys.stderr)
            continue
        with open(path, encoding="utf-8") as f:
            text = f.read()
        lines = upsert_projection(text.splitlines(True), build_projection(m) + build_template(m))
        if "".join(lines) != text:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write("".join(lines))
            n += 1
    print(f"regenerated {n} of {len(meta)} references")


def check():
    meta = load_meta()
    errors = []

    for ep, m in sorted(meta.items()):
        path = os.path.join(REFS, ep + ".md")
        if not os.path.exists(path):
            errors.append(f"missing reference {ep}.md")
            continue
        text = open(path, encoding="utf-8").read()
        lines = [l.strip() for l in text.splitlines()]
        for sec in EXPECTED_SECTIONS:
            if sec not in lines:
                errors.append(f"{ep}.md missing section {sec}")
        for sec in ("## Output Projection", "## Output Template"):
            if lines.count(sec) != 1:
                errors.append(f"{ep}.md section {sec} appears {lines.count(sec)} times (expected exactly once)")
        first = lines[0] if lines else ""
        if ep not in first:
            errors.append(f"{ep}.md title does not contain endpoint {ep}")
        if "Verification status:" not in text:
            errors.append(f"{ep}.md missing verification-status marker")
        prov = "verified by a real `delta-cli` invocation" if m["provenance"] == "tested" else "derived from ToolSpec/agent templates; pending live calibration"
        if prov not in text:
            errors.append(f"{ep}.md provenance marker mismatch ({prov})")

    extras = [f for f in os.listdir(REFS) if f.endswith(".md") and f[:-3] not in meta]
    for e in extras:
        errors.append(f"reference not in metadata: {e}")

    if os.path.exists(SKILL):
        skill = open(SKILL, encoding="utf-8").read()
        for mref in re.findall(r"references/([a-z0-9_]+\.md)", skill):
            if not os.path.exists(os.path.join(REFS, os.path.basename(mref))):
                errors.append(f"SKILL.md broken link: {mref}")

    if errors:
        print("CHECK FAILED:")
        for e in errors:
            print("  - " + e)
        return 1
    print(f"CHECK OK: {len(meta)} references, sections + provenance + links valid")
    return 0


def sync(target):
    for ep in load_meta():
        src = os.path.join(REFS, ep + ".md")
        if os.path.exists(src):
            shutil_copy(src, os.path.join(target, "references", ep + ".md"))
    if os.path.exists(SKILL):
        shutil_copy(SKILL, os.path.join(target, "SKILL.md"))
    print(f"synced references + SKILL.md -> {target}")


def shutil_copy(src, dst):
    import shutil
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)


if __name__ == "__main__":
    args = sys.argv[1:]
    if "--check" in args:
        sys.exit(check())
    if "--sync" in args:
        sync(args[args.index("--sync") + 1])
        sys.exit(0)
    regen()