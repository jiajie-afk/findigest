#!/usr/bin/env python3
"""Extract key functions from index.legacy.html into src/services/_raw/."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.legacy.html").read_text(encoding="utf-8")
OUT = ROOT / "src" / "services" / "_raw"
OUT.mkdir(parents=True, exist_ok=True)

FUNCS = [
    "getIndustry",
    "calculateValuation",
    "calculatePosition",
    "getValuationRange",
    "assessDataQuality",
    "analyze",
    "fetchFinancials",
    "fetchFinancialIndicators",
    "fetchAllFinancials",
    "fetchAllDeep",
    "sc",
    "dc",
    "isRecent",
    "categorizeNews",
    "extractFutureEvents",
    "parseDates",
    "classifyCertainty",
    "sentimentDot",
]


def extract_fn(name: str) -> str | None:
    m = re.search(rf"function {name}\s*\(", HTML)
    if not m:
        print("missing", name)
        return None
    start = m.start()
    brace = HTML.find("{", m.end() - 1)
    depth = 0
    i = brace
    in_str = None
    escape = False
    while i < len(HTML):
        c = HTML[i]
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
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return HTML[start : i + 1]
        i += 1
    print("unbalanced", name)
    return None


def main() -> None:
    for name in FUNCS:
        body = extract_fn(name)
        if not body:
            continue
        (OUT / f"{name}.js").write_text(body + "\n", encoding="utf-8")
        print(f"{name}: {len(body):,} chars")
    print("done")


if __name__ == "__main__":
    main()
