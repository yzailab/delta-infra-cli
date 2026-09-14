#!/usr/bin/env python3
"""Read the authoritative Delta Science catalog through delta-cli."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time

from invoke import _parse_cli_error, _resolve_cli, _runtime_config


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--tools", action="store_true")
    action.add_argument("--endpoints", metavar="TOOL")
    parser.add_argument("--cli")
    parser.add_argument("--science-base-url")
    parser.add_argument("--timeout", type=float, default=30.0)
    return parser


def main() -> int:
    args = _parser().parse_args()
    started = time.perf_counter()
    kind = "tools" if args.tools else "endpoints"
    try:
        runtime = _runtime_config()
        cli = _resolve_cli(args.cli, runtime)
        env = os.environ.copy()
        base_url = args.science_base_url or runtime.get("science_base_url")
        if base_url:
            env["DELTA_INFRA_SCIENCE_BASE_URL"] = str(base_url)

        command = [cli, "science", "list"]
        if args.endpoints:
            command = [cli, "science", "endpoints", "list", args.endpoints]
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
            timeout=args.timeout,
            check=False,
        )
        if completed.returncode != 0:
            error_type, detail = _parse_cli_error(completed)
            raise RuntimeError(f"{error_type}: {detail}")
        root = json.loads(completed.stdout)
        if not isinstance(root, dict) or root.get("ok") is not True:
            raise RuntimeError(json.dumps(root, ensure_ascii=False))
        if "data" not in root:
            raise RuntimeError("CLI success envelope is missing data")
        print(json.dumps({
            "ok": True,
            "transport": "delta-cli",
            "catalog": kind,
            "tool": args.endpoints,
            "elapsed_seconds": round(time.perf_counter() - started, 3),
            "native": root["data"],
        }, ensure_ascii=False))
        return 0
    except subprocess.TimeoutExpired:
        error_type = "timeout"
        error = f"timeout after {args.timeout}s"
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        error_type = "catalog"
        error = str(exc)
    except RuntimeError as exc:
        error_type = "cli"
        error = str(exc)

    print(json.dumps({
        "ok": False,
        "transport": "delta-cli",
        "catalog": kind,
        "tool": args.endpoints,
        "error_type": error_type,
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "error": error[:2000],
    }, ensure_ascii=False))
    return 1


if __name__ == "__main__":
    sys.exit(main())
