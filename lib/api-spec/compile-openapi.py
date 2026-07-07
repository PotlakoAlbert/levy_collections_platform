#!/usr/bin/env python3
"""Merge openapi.yaml + openapi-extra.yaml into openapi.bundle.json for Swagger UI."""

from __future__ import annotations

import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent


def load_yaml(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def merge_path_items(main_paths: dict, extra_paths: dict) -> dict:
    merged_paths = dict(main_paths)
    for path, extra_item in extra_paths.items():
        if path not in merged_paths:
            merged_paths[path] = extra_item
            continue
        main_item = merged_paths[path]
        if not isinstance(main_item, dict) or not isinstance(extra_item, dict):
            merged_paths[path] = extra_item
            continue
        combined = dict(main_item)
        for method, operation in extra_item.items():
            if method in combined:
                continue
            combined[method] = operation
        merged_paths[path] = combined
    return merged_paths


def merge_specs(main: dict, extra: dict) -> dict:
    merged = dict(main)
    merged["paths"] = merge_path_items(main.get("paths") or {}, extra.get("paths") or {})

    main_tags = main.get("tags") or []
    extra_tags = extra.get("tags") or []
    seen = {t["name"] for t in main_tags if isinstance(t, dict) and "name" in t}
    merged["tags"] = main_tags + [
        t for t in extra_tags if isinstance(t, dict) and t.get("name") not in seen
    ]

    main_components = main.get("components") or {}
    extra_components = extra.get("components") or {}
    merged["components"] = {
        **main_components,
        "schemas": {
            **(main_components.get("schemas") or {}),
            **(extra_components.get("schemas") or {}),
        },
        "securitySchemes": {
            "bearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": "JWT from POST /auth/login — use format: Bearer <token>",
            },
            **(extra_components.get("securitySchemes") or {}),
        },
    }
    return merged


def main() -> None:
    main_spec = load_yaml(ROOT / "openapi.yaml")
    extra_path = ROOT / "openapi-extra.yaml"
    extra_spec = load_yaml(extra_path) if extra_path.exists() else {}
    merged = merge_specs(main_spec, extra_spec)

    out = ROOT / "openapi.bundle.json"
    with out.open("w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2)
        f.write("\n")

    path_count = len(merged.get("paths") or {})
    print(f"Wrote {out} ({path_count} paths)")


if __name__ == "__main__":
    main()
