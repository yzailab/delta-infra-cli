#!/usr/bin/env python3
"""Invoke one Delta Science operation strictly through delta-cli."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from typing import Any
from urllib.parse import urlsplit

from generated_catalog import LEGACY_ENDPOINTS, LEGACY_TOOL_ALIASES


SKILL_DIR = Path(__file__).resolve().parents[1]


def _json_object(raw: str | None, flag: str) -> dict[str, Any] | None:
    if raw is None:
        return None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{flag} is not valid JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{flag} must decode to a JSON object")
    return value


def _runtime_config() -> dict[str, Any]:
    path = SKILL_DIR / "runtime.local.json"
    if not path.is_file():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def _resolve_cli(explicit: str | None, runtime: dict[str, Any]) -> str:
    candidates: list[str | None] = [
        explicit,
        os.environ.get("DELTA_CLI_PATH"),
        runtime.get("cli_path"),
        shutil.which("delta-cli"),
        shutil.which("delta-cli.exe"),
    ]
    package_root = SKILL_DIR.parents[1]
    exe_name = "delta-cli.exe" if os.name == "nt" else "delta-cli"
    candidates.append(str(package_root / "bin" / exe_name))
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(Path(candidate).resolve())
    raise FileNotFoundError(
        "delta-cli not found; install @delta-infra/cli, set DELTA_CLI_PATH, "
        "or add cli_path to delta-science/runtime.local.json"
    )


def _cli_science_base_url(cli: str, env: dict[str, str], timeout: float) -> str:
    explicit = env.get("DELTA_INFRA_SCIENCE_BASE_URL", "").strip()
    if explicit:
        return explicit
    completed = subprocess.run(
        [cli, "config", "show"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        timeout=min(timeout, 15.0),
        check=False,
    )
    if completed.returncode != 0:
        return ""
    try:
        root = json.loads(completed.stdout)
        value = root.get("data", {}).get("science_base_url", "")
    except (AttributeError, json.JSONDecodeError):
        return ""
    return str(value).strip()


def _catalog_profile(base_url: str, requested: str) -> str:
    if requested != "auto":
        return requested
    try:
        path = urlsplit(base_url).path.rstrip("/").lower()
    except ValueError:
        path = ""
    return "legacy" if path.endswith("/science_tool") else "canonical"


def _resolve_catalog_names(tool: str, endpoint: str, profile: str) -> tuple[str, str]:
    if profile == "canonical":
        return tool, endpoint
    canonical_tool = tool.removesuffix("-service") if tool in {"antbo-service", "synbo-service"} else tool
    resolved_tool = LEGACY_TOOL_ALIASES.get(canonical_tool, canonical_tool)
    if endpoint.startswith(("chem_", "biology_")):
        return resolved_tool, endpoint
    resolved_endpoint = LEGACY_ENDPOINTS.get(canonical_tool, {}).get(endpoint)
    if not resolved_endpoint:
        raise ValueError(
            f"no legacy science_tool mapping for {canonical_tool}/{endpoint}"
        )
    return resolved_tool, resolved_endpoint


def _unwrap(stdout: str) -> tuple[Any, int]:
    try:
        root = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"CLI stdout is not JSON: {exc}") from exc
    if not isinstance(root, dict):
        raise RuntimeError("CLI stdout root is not an object")
    if root.get("ok") is not True:
        raise RuntimeError(json.dumps(root.get("error", root), ensure_ascii=False))
    if "data" not in root:
        raise RuntimeError("CLI success envelope is missing data")

    value: Any = root["data"]
    depth = 0
    while isinstance(value, dict):
        if "status_code" in value and "data" in value:
            status_code = value.get("status_code")
            if not isinstance(status_code, int) or not 200 <= status_code < 300:
                raise RuntimeError(json.dumps(value, ensure_ascii=False))
            value = value["data"]
        elif (
            "code" in value
            and "data" in value
            and set(value).intersection({"message", "msg"})
        ):
            code = value.get("code")
            if code not in (0, "0", None):
                raise RuntimeError(json.dumps(value, ensure_ascii=False))
            value = value["data"]
        else:
            break
        depth += 1
        if depth > 4:
            raise RuntimeError("too many nested service envelopes")
    if isinstance(value, dict) and value.get("valid") is False:
        raise RuntimeError(json.dumps({
            "valid": False,
            "error": value.get("error"),
            "warnings": value.get("warnings"),
        }, ensure_ascii=False))
    return value, depth


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tool", required=True)
    parser.add_argument("--endpoint", required=True)
    body = parser.add_mutually_exclusive_group()
    body.add_argument("--data-json")
    body.add_argument("--params-json")
    parser.add_argument("--cli")
    parser.add_argument("--science-base-url")
    parser.add_argument(
        "--catalog-profile",
        choices=("auto", "canonical", "legacy"),
        default="auto",
    )
    parser.add_argument("--timeout", type=float, default=120.0)
    return parser


def main() -> int:
    args = _parser().parse_args()
    started = time.perf_counter()
    stage = "arguments"
    profile = "unknown"
    resolved_tool = args.tool
    resolved_endpoint = args.endpoint
    try:
        data = _json_object(args.data_json, "--data-json")
        params = _json_object(args.params_json, "--params-json")
        runtime = _runtime_config()
        stage = "cli-resolution"
        cli = _resolve_cli(args.cli, runtime)

        env = os.environ.copy()
        base_url = args.science_base_url or runtime.get("science_base_url")
        if base_url:
            env["DELTA_INFRA_SCIENCE_BASE_URL"] = str(base_url)
        configured_base_url = _cli_science_base_url(cli, env, args.timeout)
        requested_profile = str(runtime.get("catalog_profile", args.catalog_profile))
        if requested_profile not in {"auto", "canonical", "legacy"}:
            raise ValueError("catalog_profile must be auto, canonical, or legacy")
        profile = _catalog_profile(configured_base_url, requested_profile)
        resolved_tool, resolved_endpoint = _resolve_catalog_names(
            args.tool, args.endpoint, profile
        )

        command = [
            cli, "science", "invoke",
            "--tool", resolved_tool,
            "--endpoint", resolved_endpoint,
        ]
        if data is not None:
            command.extend(["--data", json.dumps(data, ensure_ascii=False, separators=(",", ":"))])
        if params is not None:
            command.extend(["--params", json.dumps(params, ensure_ascii=False, separators=(",", ":"))])

        stage = "delta-cli"
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
            detail = completed.stderr.strip() or completed.stdout.strip()
            raise RuntimeError(f"exit_code={completed.returncode}: {detail}")
        stage = "response-validation"
        native, depth = _unwrap(completed.stdout)
        result = {
            "ok": True,
            "transport": "delta-cli",
            "tool": args.tool,
            "endpoint": args.endpoint,
            "resolved_tool": resolved_tool,
            "resolved_endpoint": resolved_endpoint,
            "catalog_profile": profile,
            "elapsed_seconds": round(time.perf_counter() - started, 3),
            "envelope_depth": depth,
            "native": native,
        }
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except subprocess.TimeoutExpired:
        error = f"timeout after {args.timeout}s"
    except (OSError, ValueError, RuntimeError) as exc:
        error = str(exc)
    print(json.dumps({
        "ok": False,
        "transport": "delta-cli",
        "tool": args.tool,
        "endpoint": args.endpoint,
        "resolved_tool": resolved_tool,
        "resolved_endpoint": resolved_endpoint,
        "catalog_profile": profile,
        "stage": stage,
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "error": error[:2000],
    }, ensure_ascii=False))
    return 1


if __name__ == "__main__":
    sys.exit(main())
