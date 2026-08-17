#!/usr/bin/env python3
"""
P1 data spine: fill HK bvps/pb/roe via Tencent quotes + A-share OCF/FCF via akshare.
Usage: python scripts/enrich_valuation_data.py
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.request
from typing import Any

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIN_PATH = os.path.join(BASE, "src", "data", "stock_financials.js")
DIST_PATH = os.path.join(BASE, "dist", "data", "stock_financials.js")


def is_hk(code: str) -> bool:
    return len(code) == 5


def safe_float(v: Any, default: float = 0.0) -> float:
    if v is None or v == "-" or v == "":
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def read_js_var(path: str, var_name: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    m = re.search(rf"export const {var_name} = (\{{.*?\}});", content, re.DOTALL)
    if not m:
        raise RuntimeError(f"Cannot parse {var_name} from {path}")
    return json.loads(m.group(1))


def write_js_var(path: str, var_name: str, data: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json_str = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"export const {var_name} = {json_str};\n")


def tencent_sym(code: str) -> str:
    if is_hk(code):
        return f"hk{code}"
    if code.startswith("6") or code.startswith("9"):
        return f"sh{code}"
    return f"sz{code}"


def fetch_tencent_fundamentals(codes: list[str]) -> dict[str, dict]:
    """
    Tencent qt.gtimg.cn:
      ~3 price, ~39 PE, ~45 total_mv(亿), ~51 ROE(approx), ~58 PB
    """
    results: dict[str, dict] = {}
    for i in range(0, len(codes), 40):
        batch = codes[i : i + 40]
        syms = ",".join(tencent_sym(c) for c in batch)
        url = f"http://qt.gtimg.cn/q={syms}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read().decode("gbk", "ignore")
            for line in raw.split(";"):
                line = line.strip()
                if not line or "pv_none" in line or '="' not in line:
                    continue
                inner = line.split('="', 1)[1]
                if inner.endswith('";'):
                    inner = inner[:-2]
                elif inner.endswith('"'):
                    inner = inner[:-1]
                fields = inner.split("~")
                if len(fields) < 59:
                    continue
                code = fields[2]
                price = safe_float(fields[3])
                pe = safe_float(fields[39])
                total_mv = safe_float(fields[45])
                roe = safe_float(fields[51])
                pb = safe_float(fields[58])
                if not code:
                    continue
                row: dict[str, Any] = {}
                if price > 0:
                    row["price"] = round(price, 2)
                if pe > 0:
                    row["pe_ttm"] = round(pe, 2)
                    if price > 0:
                        row["eps"] = round(price / pe, 4)
                if pb > 0:
                    row["pb"] = round(pb, 2)
                    if price > 0:
                        row["bvps"] = round(price / pb, 4)
                if roe != 0:
                    # Tencent sometimes returns absurd ROE; clamp to sane band
                    if -50 <= roe <= 60:
                        row["roe"] = round(roe, 1)
                if total_mv > 0:
                    row["total_mv"] = round(total_mv, 2)
                if row:
                    results[code] = row
        except Exception as e:
            print(f"  tencent batch fail @ {i}: {e}", flush=True)
        print(f"  tencent {min(i + 40, len(codes))}/{len(codes)}", flush=True)
        time.sleep(0.12)
    return results


def fetch_em_delay_pb(codes: list[str]) -> dict[str, dict]:
    """Fallback: push2delay East Money (fltt=2) for leftover sparse names."""
    results: dict[str, dict] = {}
    for i, code in enumerate(codes):
        secid = f"116.{code}" if is_hk(code) else (
            f"1.{code}" if code.startswith(("6", "9")) else f"0.{code}"
        )
        url = (
            "https://push2delay.eastmoney.com/api/qt/stock/get?"
            f"fltt=2&invt=2&secid={secid}&fields=f57,f43,f162,f167,f183,f116"
        )
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0",
                    "Referer": "https://quote.eastmoney.com",
                },
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            item = (data or {}).get("data") or {}
            price = safe_float(item.get("f43"))
            pe = safe_float(item.get("f162"))
            pb = safe_float(item.get("f167"))
            roe = safe_float(item.get("f183"))
            mv = safe_float(item.get("f116"))
            row: dict[str, Any] = {}
            if price > 0:
                row["price"] = round(price, 2)
            if pe > 0:
                row["pe_ttm"] = round(pe, 2)
                row["eps"] = round(price / pe, 4) if price > 0 else 0
            if pb > 0:
                row["pb"] = round(pb, 2)
                row["bvps"] = round(price / pb, 4) if price > 0 else 0
            if -50 <= roe <= 60 and roe != 0:
                row["roe"] = round(roe, 1)
            if mv > 0:
                row["total_mv"] = round(mv / 1e8, 2)
            if row:
                results[code] = row
        except Exception:
            pass
        if (i + 1) % 30 == 0:
            print(f"  em-delay {i + 1}/{len(codes)}", flush=True)
        time.sleep(0.08)
    return results


def enrich_cashflow_akshare(fins: dict, limit: int = 120) -> int:
    try:
        import akshare as ak
    except ImportError:
        print("  akshare missing — skip cashflow", flush=True)
        return 0

    a_codes = [
        c
        for c, f in fins.items()
        if not is_hk(c) and not (f.get("fcfPerShare") or f.get("ownerEarnings"))
    ]
    a_codes = sorted(a_codes, key=lambda c: -(fins[c].get("total_mv") or 0))[:limit]
    updated = 0
    for i, code in enumerate(a_codes):
        market = "SH" if code.startswith(("6", "9")) else "SZ"
        symbol = f"{market}{code}"
        try:
            df = ak.stock_cash_flow_sheet_by_report_em(symbol=symbol)
            if df is None or getattr(df, "empty", True):
                continue

            def pick_row():
                if "REPORT_DATE_TYPE" in df.columns:
                    annual = df[df["REPORT_DATE_TYPE"].astype(str).str.contains("年", na=False)]
                    if not annual.empty:
                        return annual.iloc[0]
                return df.iloc[0]

            row = pick_row()

            def col(*names):
                for n in names:
                    if n in df.columns:
                        v = row[n]
                        try:
                            if v is None or (isinstance(v, float) and v != v):
                                continue
                            return float(v)
                        except (TypeError, ValueError):
                            continue
                return None

            ocf = col("NETCASH_OPERATE", "经营性现金流净额")
            capex_raw = col("CONSTRUCT_LONG_ASSET", "购建固定资产、无形资产和其他长期资产支付的现金")
            capex = abs(capex_raw) if capex_raw is not None else None
            fcf = None
            if ocf is not None and capex is not None:
                fcf = ocf - capex
            elif ocf is not None:
                fcf = ocf * 0.75

            if ocf is None and fcf is None:
                continue

            fin = fins[code]
            if ocf is not None:
                fin["ocf"] = round(ocf / 1e8, 2)
            if capex is not None:
                fin["capex"] = round(capex / 1e8, 2)
            if fcf is not None:
                fin["fcf"] = round(fcf / 1e8, 2)
            price = float(fin.get("price") or 0)
            mv = float(fin.get("total_mv") or 0)
            if price > 0 and mv > 0 and fcf is not None:
                shares_yi = mv / price
                if shares_yi > 0:
                    fps = round((fcf / 1e8) / shares_yi, 4)
                    fin["fcfPerShare"] = fps
                    fin["ownerEarnings"] = fps
            updated += 1
        except Exception:
            pass
        if (i + 1) % 20 == 0:
            print(f"  cashflow {i + 1}/{len(a_codes)} ok={updated}", flush=True)
        time.sleep(0.15)
    return updated


def apply_quote(dst: dict, src: dict) -> None:
    for k, v in src.items():
        if v is None:
            continue
        if isinstance(v, (int, float)) and v == 0 and k not in ("roe",):
            continue
        dst[k] = v


def main() -> int:
    print("=== enrich_valuation_data (tencent-first) ===")
    fins = read_js_var(FIN_PATH, "STOCK_FINANCIALS")
    print(f"loaded {len(fins)}")

    hk_codes = [c for c in fins if is_hk(c)]
    a_sparse = [
        c
        for c, f in fins.items()
        if not is_hk(c) and not (f.get("pb") or 0) and (f.get("price") or 0) > 0
    ]

    print(f"\n[1] Tencent fundamentals HK={len(hk_codes)} A-sparse={len(a_sparse)}")
    hk_before = sum(1 for c in hk_codes if (fins[c].get("pb") or 0) > 0)
    quotes = fetch_tencent_fundamentals(hk_codes + a_sparse)
    for code, payload in quotes.items():
        if code in fins:
            apply_quote(fins[code], payload)
    hk_mid = sum(1 for c in hk_codes if (fins[c].get("pb") or 0) > 0)
    print(f"  HK pb after tencent: {hk_before} → {hk_mid}/{len(hk_codes)}")

    still = [c for c in hk_codes if not (fins[c].get("pb") or 0)]
    if still:
        print(f"\n[1b] EM delay fallback ({len(still)})")
        for code, payload in fetch_em_delay_pb(still).items():
            if code in fins:
                apply_quote(fins[code], payload)
    hk_after = sum(1 for c in hk_codes if (fins[c].get("pb") or 0) > 0)
    print(f"  HK pb final: {hk_after}/{len(hk_codes)}")

    print("\n[2] A-share cashflow (top MV, capped 120)")
    cf_n = enrich_cashflow_akshare(fins, limit=120)
    print(f"  cashflow updated: {cf_n}")

    print("\n[3] write")
    write_js_var(FIN_PATH, "STOCK_FINANCIALS", fins)
    if os.path.isdir(os.path.dirname(DIST_PATH)):
        write_js_var(DIST_PATH, "STOCK_FINANCIALS", fins)

    fcf_n = sum(1 for f in fins.values() if f.get("fcfPerShare") or f.get("ownerEarnings"))
    print(f"done hk_pb={hk_after}/{len(hk_codes)} fcfPerShare={fcf_n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
