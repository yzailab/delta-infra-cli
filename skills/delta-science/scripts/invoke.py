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

SKILL_DIR = Path(__file__).resolve().parents[1]
_CLI_ERROR_TYPES = {
    2: "validation",
    3: "auth",
    4: "permission",
    5: "not_found",
    6: "network",
    7: "api",
    10: "internal",
}


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


def _normalize_synbo_payload(
    tool: str,
    endpoint: str,
    data: dict[str, Any] | None,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Normalize SynBO's discrete condition contract before any remote request."""
    canonical_tool = tool.removesuffix("-service")
    if canonical_tool != "synbo" or endpoint not in {"initialize", "optimize"}:
        return data, None
    if data is None:
        raise ValueError(f"synbo/{endpoint} requires --data-json")

    condition_dict = data.get("condition_dict")
    if not isinstance(condition_dict, dict) or not condition_dict:
        raise ValueError("SynBO condition_dict must be a non-empty object")

    normalized_conditions: dict[str, list[str]] = {}
    for name, raw_values in condition_dict.items():
        if not isinstance(raw_values, list) or not raw_values:
            raise ValueError(
                f"SynBO condition_dict.{name} must be a non-empty explicit list; "
                "range objects are not supported"
            )
        values = [str(value) for value in raw_values]
        if any(value == "" for value in values):
            raise ValueError(f"SynBO condition_dict.{name} contains an empty value")
        if len(set(values)) != len(values):
            raise ValueError(
                f"SynBO condition_dict.{name} contains duplicate values after "
                "string normalization"
            )
        normalized_conditions[str(name)] = values

    normalized = dict(data)
    normalized["condition_dict"] = normalized_conditions
    normalization = {
        "condition_values": "strings",
        "condition_space_size": _condition_space_size(normalized_conditions),
    }

    if endpoint == "initialize":
        return normalized, normalization

    metrics = normalized.get("opt_metrics")
    if not isinstance(metrics, list) or not metrics:
        raise ValueError("SynBO optimize requires a non-empty opt_metrics list")
    metric_names = [str(metric) for metric in metrics]
    normalized["opt_metrics"] = metric_names

    previous_results = normalized.get("previous_results")
    if not isinstance(previous_results, list) or not previous_results:
        raise ValueError("SynBO optimize requires non-empty previous_results")

    normalized_rows: list[dict[str, Any]] = []
    for index, raw_row in enumerate(previous_results):
        if not isinstance(raw_row, dict):
            raise ValueError(f"SynBO previous_results[{index}] must be an object")
        row = dict(raw_row)
        for condition_name, allowed_values in normalized_conditions.items():
            if condition_name not in row:
                raise ValueError(
                    f"SynBO previous_results[{index}] is missing condition "
                    f"{condition_name!r}"
                )
            value = str(row[condition_name])
            if value not in allowed_values:
                raise ValueError(
                    f"SynBO previous_results[{index}].{condition_name}={value!r} "
                    "is not present in condition_dict"
                )
            row[condition_name] = value
        for metric_name in metric_names:
            metric_value = row.get(metric_name)
            if (
                metric_name not in row
                or isinstance(metric_value, bool)
                or not isinstance(metric_value, (int, float))
            ):
                raise ValueError(
                    f"SynBO previous_results[{index}].{metric_name} must be numeric"
                )
        normalized_rows.append(row)

    normalized["previous_results"] = normalized_rows
    normalized.setdefault("accuracy", "tiny")
    normalized.setdefault("device", "cpu")
    normalized.setdefault("surrogate_model", "RF")
    normalized.setdefault("acq_func", "UCB")
    normalization["defaults"] = {
        key: normalized[key]
        for key in ("accuracy", "device", "surrogate_model", "acq_func")
    }
    return normalized, normalization


def _condition_space_size(condition_dict: dict[str, list[str]]) -> int:
    size = 1
    for values in condition_dict.values():
        size *= len(values)
    return size


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


def _validate_native(tool: str, endpoint: str, native: Any) -> None:
    canonical_tool = tool.removesuffix("-service")
    if canonical_tool == "synbo" and endpoint == "optimize":
        if not isinstance(native, dict):
            raise RuntimeError("SynBO optimize returned a non-object result")
        recommendations = native.get("recommendations")
        if not isinstance(recommendations, list) or not recommendations:
            raise RuntimeError("SynBO optimize returned no recommendations")


def _parse_cli_error(completed: subprocess.CompletedProcess[str]) -> tuple[str, str]:
    detail = completed.stderr.strip() or completed.stdout.strip()
    error_type = _CLI_ERROR_TYPES.get(completed.returncode, "cli")
    try:
        envelope = json.loads(detail)
        error = envelope.get("error", {}) if isinstance(envelope, dict) else {}
        if isinstance(error, dict):
            error_type = str(error.get("type") or error_type)
            message = error.get("message")
            if message:
                detail = str(message)
    except (AttributeError, json.JSONDecodeError):
        pass
    return error_type, detail


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tool", required=True)
    parser.add_argument("--endpoint", required=True)
    body = parser.add_mutually_exclusive_group()
    body.add_argument("--data-json")
    body.add_argument("--params-json")
    parser.add_argument("--cli")
    parser.add_argument("--science-base-url")
    parser.add_argument("--timeout", type=float, default=120.0)
    return parser


def main() -> int:
    args = _parser().parse_args()
    started = time.perf_counter()
    stage = "arguments"
    cli_exit_code: int | None = None
    error_type = "unknown"
    normalization: dict[str, Any] | None = None
    try:
        data = _json_object(args.data_json, "--data-json")
        params = _json_object(args.params_json, "--params-json")
        data, normalization = _normalize_synbo_payload(
            args.tool, args.endpoint, data
        )
        runtime = _runtime_config()
        stage = "cli-resolution"
        cli = _resolve_cli(args.cli, runtime)

        env = os.environ.copy()
        base_url = args.science_base_url or runtime.get("science_base_url")
        if base_url:
            env["DELTA_INFRA_SCIENCE_BASE_URL"] = str(base_url)

        command = [
            cli, "science", "invoke",
            "--tool", args.tool,
            "--endpoint", args.endpoint,
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
            cli_exit_code = completed.returncode
            error_type, detail = _parse_cli_error(completed)
            raise RuntimeError(f"exit_code={completed.returncode}: {detail}")
        stage = "response-validation"
        native, depth = _unwrap(completed.stdout)
        _validate_native(args.tool, args.endpoint, native)
        result = {
            "ok": True,
            "transport": "delta-cli",
            "tool": args.tool,
            "endpoint": args.endpoint,
            "elapsed_seconds": round(time.perf_counter() - started, 3),
            "envelope_depth": depth,
            "native": native,
        }
        if normalization is not None:
            result["request_normalization"] = normalization
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except subprocess.TimeoutExpired:
        error_type = "timeout"
        error = f"timeout after {args.timeout}s"
    except ValueError as exc:
        error_type = "validation"
        error = str(exc)
    except OSError as exc:
        error_type = "cli_resolution"
        error = str(exc)
    except RuntimeError as exc:
        if error_type == "unknown":
            error_type = "response_validation"
        error = str(exc)
    print(json.dumps({
        "ok": False,
        "transport": "delta-cli",
        "tool": args.tool,
        "endpoint": args.endpoint,
        "stage": stage,
        "error_type": error_type,
        "cli_exit_code": cli_exit_code,
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "error": error[:2000],
    }, ensure_ascii=False))
    return 1


if __name__ == "__main__":
    sys.exit(main())
