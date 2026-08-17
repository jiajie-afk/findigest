#!/usr/bin/env python3
"""Fill remaining HK stocks missing PB via Tencent + EM delay."""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIN_PATH = os.path.join(BASE, "src", "data", "stock_financials.js")
DIST_PATH = os.path.join(BASE, "dist", "data", "stock_financials.js")


def safe_float(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def read_js(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    m = re.search(r"export const STOCK_FINANCIALS = (\{.*?\});", content, re.DOTALL)
    return json.loads(m.group(1))


def write_js(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(
            "export const STOCK_FINANCIALS = "
            + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
            + ";\n"
        )


def fetch_tencent(codes):
    out = {}
    for i in range(0, len(codes), 40):
        batch = codes[i : i + 40]
        url = "http://qt.gtimg.cn/q=" + ",".join("hk" + c for c in batch)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read().decode("gbk", "ignore")
            for line in raw.split(";"):
                if '="' not in line or "pv_none" in line:
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
                pb = safe_float(fields[58])
                roe = safe_float(fields[51])
                mv = safe_float(fields[45])
                row = {}
                if price > 0:
                    row["price"] = round(price, 2)
                if pe > 0:
                    row["pe_ttm"] = round(pe, 2)
                    row["eps"] = round(price / pe, 4)
                if pb > 0:
                    row["pb"] = round(pb, 2)
                    row["bvps"] = round(price / pb, 4)
                if -50 <= roe <= 60 and roe != 0:
                    row["roe"] = round(roe, 1)
                if mv > 0:
                    row["total_mv"] = round(mv, 2)
                if row:
                    out[code] = row
        except Exception as e:
            print("tencent fail", e)
        print(f"tencent {min(i+40,len(codes))}/{len(codes)}")
        time.sleep(0.1)
    return out


def fetch_em_delay(codes):
    out = {}
    for i, code in enumerate(codes):
        url = (
            "https://push2delay.eastmoney.com/api/qt/stock/get?"
            f"fltt=2&invt=2&secid=116.{code}&fields=f57,f43,f162,f167,f183,f116"
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
            row = {}
            if price > 0:
                row["price"] = round(price, 2)
            if pe > 0:
                row["pe_ttm"] = round(pe, 2)
                row["eps"] = round(price / pe, 4) if price else 0
            if pb > 0:
                row["pb"] = round(pb, 2)
                row["bvps"] = round(price / pb, 4) if price else 0
            if -50 <= roe <= 60 and roe != 0:
                row["roe"] = round(roe, 1)
            if mv > 0:
                row["total_mv"] = round(mv / 1e8, 2)
            if row:
                out[code] = row
        except Exception:
            pass
        if (i + 1) % 25 == 0:
            print(f"em {i+1}/{len(codes)}")
        time.sleep(0.08)
    return out


def main():
    fins = read_js(FIN_PATH)
    missing = [c for c in fins if len(c) == 5 and not (fins[c].get("pb") or 0)]
    print(f"HK missing pb: {len(missing)}")
    if not missing:
        return 0
    q = fetch_tencent(missing)
    still = []
    for code in missing:
        payload = q.get(code)
        if payload and payload.get("pb"):
            fins[code].update({k: v for k, v in payload.items() if v})
        else:
            still.append(code)
    print(f"after tencent still {len(still)}")
    if still:
        for code, payload in fetch_em_delay(still).items():
            if payload.get("pb"):
                fins[code].update({k: v for k, v in payload.items() if v})
    after = sum(1 for c in fins if len(c) == 5 and (fins[c].get("pb") or 0) > 0)
    print(f"HK pb now {after}/317")
    write_js(FIN_PATH, fins)
    if os.path.isdir(os.path.dirname(DIST_PATH)):
        write_js(DIST_PATH, fins)
    return 0


if __name__ == "__main__":
    sys.exit(main())
