#!/usr/bin/env python3
"""Extract data blobs from index.legacy.html into src/data modules."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.legacy.html").read_text(encoding="utf-8")
OUT_JSON = ROOT / "public" / "data"
OUT_JS = ROOT / "src" / "data"
OUT_JSON.mkdir(parents=True, exist_ok=True)
OUT_JS.mkdir(parents=True, exist_ok=True)


def extract_balanced(src: str, start: int) -> str:
    """Extract {...} or [...] starting at start (must be { or [)."""
    open_ch = src[start]
    close_ch = "}" if open_ch == "{" else "]"
    depth = 0
    i = start
    in_str = None
    escape = False
    while i < len(src):
        c = src[i]
        if in_str:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == in_str:
                in_str = None
        else:
            if c in ("'", '"'):
                in_str = c
            elif c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    return src[start : i + 1]
        i += 1
    raise ValueError(f"Unbalanced from {start}")


def find_var(name: str) -> str:
    m = re.search(rf"var\s+{name}\s*=\s*([\[{{])", HTML)
    if not m:
        raise KeyError(name)
    return extract_balanced(HTML, m.start(1))


def js_object_to_json(raw: str) -> object:
    """Best-effort convert simple JS object/array literal to JSON."""
    j = raw
    j = re.sub(r"([{\[,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:", r'\1"\2":', j)
    j = j.replace("'", '"')
    j = re.sub(r",\s*([}\]])", r"\1", j)
    return json.loads(j)


def write_js_module(name: str, raw: str) -> None:
    path = OUT_JS / f"{name.lower()}.js"
    path.write_text(f"export const {name} = {raw}\n", encoding="utf-8")
    print(f"JS  {name}: {len(raw):,} chars -> {path.relative_to(ROOT)}")


def main() -> None:
    # Simple arrays as JSON
    for name, fname in [
        ("PORTFOLIOS", "portfolios.json"),
        ("AUTO_EVENTS", "auto_events.json"),
        ("MANUAL_EVENTS", "manual_events.json"),
        ("NOTIFICATIONS", "notifications.json"),
        ("REPORTS", "reports.json"),
    ]:
        raw = find_var(name)
        try:
            data = js_object_to_json(raw)
            (OUT_JSON / fname).write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            print(f"JSON {name}: {len(data)} items")
        except Exception as e:
            print(f"JSON {name} failed ({e}), writing JS fallback")
            write_js_module(name, raw)

    # DB map
    m = re.search(r"var DB=\{(.*?)\}", HTML, re.S)
    if m:
        pairs = re.findall(r"'(\d+)':'([^']+)'", m.group(1))
        db = dict(pairs)
        (OUT_JSON / "db.json").write_text(
            json.dumps(db, ensure_ascii=False), encoding="utf-8"
        )
        print(f"JSON DB: {len(db)} stocks")

    # Large objects as JS modules (keep original literal)
    for name in [
        "INDUSTRY_MODELS",
        "STOCK_FINANCIALS",
        "CONSENSUS_DATA",
        "CURRENT_PRICES",
        "TRAILING_DATA",
        "PE_RANGES",
        "ANALYSIS_DIMS",
    ]:
        try:
            write_js_module(name, find_var(name))
        except Exception as e:
            print(f"FAIL {name}: {e}")

    print("done")


if __name__ == "__main__":
    main()
