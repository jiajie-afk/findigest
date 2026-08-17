#!/usr/bin/env python3
"""
FinDigest Daily Data Update Script (Vite version)
Updates: src/data/stock_financials.js, src/data/current_prices.js, src/data/consensus_data.js
Also rebuilds dist/data/ for production.
"""
import json, re, os, time, sys
from datetime import datetime, timedelta
import akshare as ak
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DATA = os.path.join(BASE_DIR, "src", "data")
DIST_DATA = os.path.join(BASE_DIR, "dist", "data")
STATE_PATH = os.path.join(BASE_DIR, "update_state.json")

def load_state():
    if os.path.exists(STATE_PATH):
        with open(STATE_PATH, 'r') as f:
            return json.load(f)
    return {"consensus": {}, "last_update": None, "prices_date": None,
            "consensus_cursor": 0, "fin_data_date": None}

def save_state(state):
    with open(STATE_PATH, 'w') as f:
        json.dump(state, f, ensure_ascii=False)

def read_js_var(filepath, var_name):
    """Read a JS variable from file, return as dict."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    m = re.search(rf'export const {var_name} = (\{{.*?\}});', content, re.DOTALL)
    if not m:
        return {}
    try:
        return json.loads(m.group(1))
    except:
        return {}

def write_js_var(filepath, var_name, data):
    """Write a JS variable to file."""
    json_str = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    content = f"export const {var_name} = {json_str};\n"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def read_js_prices(filepath):
    """Read current prices JS file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    m = re.search(r'export const CURRENT_PRICES = (\{.*?\});', content, re.DOTALL)
    if not m:
        return {}
    try:
        return json.loads(m.group(1))
    except:
        return {}

def write_js_prices(filepath, prices):
    """Write current prices JS file."""
    lines = ["export const CURRENT_PRICES = {"]
    items = sorted(prices.items())
    for i, (code, price) in enumerate(items):
        comma = "," if i < len(items)-1 else ""
        lines.append(f'  "{code}": {price}{comma}')
    lines.append("};\n")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

def fetch_prices_tencent(all_codes):
    """Fetch current prices from Tencent API."""
    import urllib.request
    prices = {}

    def tencent_sym(code):
        if len(code) == 5: return f'hk{code}'
        if code.startswith('6') or code.startswith('9'): return f'sh{code}'
        return f'sz{code}'

    for i in range(0, len(all_codes), 50):
        batch = all_codes[i:i+50]
        syms = ','.join([tencent_sym(c) for c in batch])
        url = f'http://qt.gtimg.cn/q={syms}'
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = resp.read().decode('gbk','ignore')
            for line in raw.split(';'):
                line = line.strip()
                if not line or 'pv_none' in line: continue
                m = re.search(r'v_\w+="([^"]+)"', line)
                if not m: continue
                fields = m.group(1).split('~')
                if len(fields) < 46: continue
                code = fields[2]
                price = float(fields[3]) if fields[3] else 0
                pe = float(fields[39]) if fields[39] else 0
                total_mv = float(fields[45]) if fields[45] else 0
                pb = 0.0
                roe = 0.0
                try:
                    if len(fields) > 58 and fields[58]:
                        pb = float(fields[58])
                except Exception:
                    pb = 0.0
                try:
                    if len(fields) > 51 and fields[51]:
                        roe_v = float(fields[51])
                        if -50 <= roe_v <= 60:
                            roe = roe_v
                except Exception:
                    roe = 0.0
                if price > 0:
                    row = {'price': round(price,2), 'pe': round(pe,2),
                                    'total_mv': round(total_mv,2)}
                    if pb > 0:
                        row['pb'] = round(pb, 2)
                        row['bvps'] = round(price / pb, 4)
                    if roe != 0:
                        row['roe'] = round(roe, 1)
                    prices[code] = row
        except: pass
        time.sleep(0.1)
    return prices

def update_consensus_batch(a_codes, hk_codes, consensus, batch_size_a=15, batch_size_hk=10):
    """Update a small batch of consensus data."""
    updated = 0
    for code in a_codes:
        if updated >= batch_size_a: break
        try:
            df = ak.stock_profit_forecast_ths(symbol=code, indicator="预测年报每股收益")
            if df is not None and len(df) > 0:
                fy1_row = df[df['年度']==2026]
                if len(fy1_row) > 0:
                    fy1 = float(fy1_row.iloc[0]['均值'])
                    fy2_row = df[df['年度']==2027]
                    fy2 = float(fy2_row.iloc[0]['均值']) if len(fy2_row)>0 else None
                    consensus[code] = {
                        'fy1': round(fy1,4), 'fy2': round(fy2,4) if fy2 else None,
                        'analysts': int(fy1_row.iloc[0]['预测机构数']),
                        'updated': datetime.now().isoformat()
                    }
                    updated += 1
        except: pass
        time.sleep(0.2)

    hk_updated = 0
    for code in hk_codes:
        if hk_updated >= batch_size_hk: break
        try:
            df = ak.stock_hk_profit_forecast_et(symbol=code)
            if df is not None and len(df) > 0:
                grouped = df.groupby('财政年度')['每股盈利'].mean()
                fy1 = float(grouped.iloc[0])/100
                fy2 = float(grouped.iloc[1])/100 if len(grouped)>1 else None
                a = len(df[df['财政年度']==sorted(grouped.index)[0]])
                if abs(fy1) > 0.001:
                    consensus[code] = {
                        'fy1': round(fy1,4), 'fy2': round(fy2,4) if fy2 else None,
                        'analysts': a, 'updated': datetime.now().isoformat()
                    }
                    updated += 1; hk_updated += 1
        except: pass
        time.sleep(0.3)
    return updated

def update_financial_data():
    """Fetch latest financial data from akshare.

    CRITICAL: 业绩快报里一季报 EPS 是阶段性数字，不能覆盖年报/TTM。
    优先顺序：最近年报(12-31) > 半年报/三季报按比例年化仅作缺口填充。
    """
    print("  Fetching earnings data (yjbb)...", flush=True)
    frames = []
    # Prefer full-year first in the list so concat keep='first' keeps annual when both exist
    for label, date in [
        ('annual', '20241231'),
        ('annual_prev', '20231231'),
        ('q3', '20240930'),
        ('h1', '20240630'),
        ('q1', '20250331'),
    ]:
        try:
            df = ak.stock_yjbb_em(date=date)
            if df is not None and len(df) > 0:
                df = df.copy()
                df['_period'] = label
                df['_report_date'] = date
                frames.append(df)
                print(f"    {label}({date}): {len(df)} rows", flush=True)
        except Exception as e:
            print(f"    skip {label}: {e}", flush=True)

    if not frames:
        return {}

    # Annual periods first → drop_duplicates keep first retains annual EPS
    priority = {'annual': 0, 'annual_prev': 1, 'q3': 2, 'h1': 3, 'q1': 4}
    df_yjbb = pd.concat(frames, ignore_index=True)
    df_yjbb['_prio'] = df_yjbb['_period'].map(priority).fillna(9)
    df_yjbb = df_yjbb.sort_values('_prio')
    df_yjbb = df_yjbb.drop_duplicates(subset='股票代码', keep='first')

    fin = {}
    for _, row in df_yjbb.iterrows():
        code = str(row['股票代码']).zfill(6)
        eps = float(row['每股收益']) if pd.notna(row['每股收益']) else 0
        period = row.get('_period', 'unknown')
        # Partial-year EPS must not be treated as annual; annualize as last resort
        if period == 'q1' and eps:
            eps = eps * 4
            eps_period = 'q1_annualized'
        elif period == 'h1' and eps:
            eps = eps * 2
            eps_period = 'h1_annualized'
        elif period == 'q3' and eps:
            eps = eps * (4 / 3)
            eps_period = 'q3_annualized'
        else:
            eps_period = 'annual' if str(period).startswith('annual') else str(period)

        bvps = float(row['每股净资产']) if pd.notna(row['每股净资产']) else 0
        roe = float(row['净资产收益率']) if pd.notna(row['净资产收益率']) else 0
        gm = float(row['销售毛利率']) if pd.notna(row['销售毛利率']) else 0
        rg = float(row['营业总收入-同比增长']) if pd.notna(row['营业总收入-同比增长']) else 0
        pg = float(row['净利润-同比增长']) if pd.notna(row['净利润-同比增长']) else 0
        profit = float(row['净利润-净利润']) if pd.notna(row['净利润-净利润']) else 0
        revenue = float(row['营业总收入-营业总收入']) if pd.notna(row['营业总收入-营业总收入']) else 0
        fin[code] = {
            'eps': round(eps, 4),
            'epsPeriod': eps_period,
            'bvps': round(bvps, 2),
            'roe': round(roe, 2),
            'grossMargin': round(gm, 2),
            'revenueGrowth': round(rg, 2),
            'profitGrowth': round(pg, 2),
            'profit': round(profit / 1e8, 2) if profit else 0,
            'revenue': round(revenue / 1e8, 2) if revenue else 0,
        }
    print(f"  yjbb: {len(fin)} stocks (annual preferred)", flush=True)

    # Balance sheet — prefer annual
    print("  Fetching balance sheet...", flush=True)
    df_bs = None
    for date in ('20241231', '20250331'):
        try:
            df_bs = ak.stock_zcfz_em(date=date)
            if df_bs is not None:
                break
        except Exception:
            pass
    if df_bs is not None:
        for _, row in df_bs.iterrows():
            code = str(row['股票代码']).zfill(6)
            if code in fin:
                dr = float(row['资产负债率']) if '资产负债率' in row and str(row['资产负债率']) not in ['nan', 'NaN', ''] else 0
                fin[code]['debtRatio'] = round(dr, 2)

    # Income statement — prefer annual
    print("  Fetching income statement...", flush=True)
    df_is = None
    for date in ('20241231', '20250331'):
        try:
            df_is = ak.stock_lrb_em(date=date)
            if df_is is not None:
                break
        except Exception:
            pass
    if df_is is not None:
        for _, row in df_is.iterrows():
            code = str(row['股票代码']).zfill(6)
            if code in fin:
                rev = float(row['营业总收入']) if '营业总收入' in row and str(row['营业总收入']) not in ['nan', 'NaN', ''] else 0
                np_val = float(row['净利润']) if '净利润' in row and str(row['净利润']) not in ['nan', 'NaN', ''] else 0
                if rev > 0:
                    fin[code]['netMargin'] = round(np_val / rev * 100, 2)

    return fin


def sanitize_eps_against_pe(stock_fin, consensus_data=None):
    """Runtime/offline guard: if stored EPS disagrees with PE-implied TTM, correct it.

    Returns count of corrected rows.
    """
    consensus_data = consensus_data or {}
    fixed = 0
    for code, row in stock_fin.items():
        price = float(row.get('price') or 0)
        pe = float(row.get('pe_ttm') or 0)
        stored = float(row.get('eps') or 0)
        if price <= 0 or pe <= 0:
            continue
        pe_implied = price / pe
        if pe_implied <= 0:
            continue

        ratio = (stored / pe_implied) if stored > 0 else 0
        if 0.5 <= ratio <= 1.5:
            row['epsQuality'] = 'ok'
            continue

        fy1 = None
        c = consensus_data.get(code)
        if c and c.get('fy1') and float(c['fy1']) > 0:
            fy1 = float(c['fy1'])

        row['epsReported'] = round(stored, 4) if stored else 0
        if fy1 and abs(fy1 - pe_implied) / pe_implied <= 0.35:
            row['eps'] = round(fy1, 4)
            row['epsSource'] = 'consensus_fy1'
        else:
            row['eps'] = round(pe_implied, 4)
            row['epsSource'] = 'pe_implied'
        row['epsQuality'] = 'corrected'
        fixed += 1
    return fixed

def main():
    t0 = time.time()
    print(f"=== FinDigest Update: {datetime.now().strftime('%Y-%m-%d %H:%M')} ===")

    state = load_state()
    consensus = state.get('consensus', {})

    # Step 1: Read current data
    print("Step 1: Reading current data...")
    sf_path = os.path.join(SRC_DATA, "stock_financials.js")
    cp_path = os.path.join(SRC_DATA, "current_prices.js")
    cd_path = os.path.join(SRC_DATA, "consensus_data.js")

    stock_fin = read_js_var(sf_path, "STOCK_FINANCIALS")
    prices_data = read_js_prices(cp_path)
    consensus_data = read_js_var(cd_path, "CONSENSUS_DATA")

    all_codes = list(stock_fin.keys())
    print(f"  Loaded {len(all_codes)} stocks, {len(consensus_data)} consensus")

    # Step 2: Fetch prices from Tencent
    print("Step 2: Fetching prices (Tencent)...")
    tencent_prices = fetch_prices_tencent(all_codes)
    print(f"  Tencent: {len(tencent_prices)} stocks ({time.time()-t0:.0f}s)")

    # Step 3: Update STOCK_FINANCIALS with prices (+ PB/BVPS/ROE when Tencent provides)
    updated_prices = 0
    for code, data in tencent_prices.items():
        if code in stock_fin:
            stock_fin[code]['price'] = data['price']
            if data['pe'] > 0:
                stock_fin[code]['pe_ttm'] = data['pe']
            if data['total_mv'] > 0:
                stock_fin[code]['total_mv'] = data['total_mv']
            if data.get('pb'):
                stock_fin[code]['pb'] = data['pb']
            if data.get('bvps'):
                stock_fin[code]['bvps'] = data['bvps']
            if data.get('roe'):
                stock_fin[code]['roe'] = data['roe']
            updated_prices += 1

    # Update CURRENT_PRICES
    for code, data in tencent_prices.items():
        prices_data[code] = data['price']

    print(f"Step 3: Updated {updated_prices} prices")

    # Step 3b: Sanitize EPS vs PE (fixes historical Q1-overwrite corruption)
    fixed_eps = sanitize_eps_against_pe(stock_fin, consensus_data)
    print(f"Step 3b: Sanitized EPS on {fixed_eps} stocks (PE/consensus guard)")

    # Step 4: Weekly financial data refresh (Mondays only)
    today = datetime.now()
    last_fin = state.get('fin_data_date')
    should_update_fin = (today.weekday() == 0 and
                         (not last_fin or (today - datetime.fromisoformat(last_fin)).days >= 5))
    if should_update_fin:
        print("Step 4: Weekly financial data refresh...")
        fin_data = update_financial_data()
        if fin_data:
            for code, fd in fin_data.items():
                if code in stock_fin:
                    for k in ['eps','bvps','roe','grossMargin','netMargin','debtRatio',
                              'revenueGrowth','profitGrowth','revenue','profit']:
                        if k in fd and fd[k] != 0:
                            stock_fin[code][k] = fd[k]
                    if stock_fin[code].get('bvps',0) > 0 and stock_fin[code].get('price',0) > 0:
                        stock_fin[code]['pb'] = round(stock_fin[code]['price']/stock_fin[code]['bvps'], 2)
            state['fin_data_date'] = today.isoformat()
            print(f"  Financial data: {len(fin_data)} stocks ({time.time()-t0:.0f}s)")
            fixed_after = sanitize_eps_against_pe(stock_fin, consensus_data)
            print(f"  Re-sanitized EPS after fin refresh: {fixed_after}")
    else:
        print("Step 4: Skipping financial data (not Monday)")

    # Step 5: Rotate consensus update
    a_in_consensus = [c for c in consensus_data if len(c)==6 and c[0] in '036']
    hk_in_consensus = [c for c in consensus_data if len(c) in [4,5]]
    cursor = state.get('consensus_cursor', 0) % max(len(a_in_consensus), 1)
    a_batch = a_in_consensus[cursor:cursor+15]
    hk_cursor = (cursor * 2) % max(len(hk_in_consensus), 1)
    hk_batch = hk_in_consensus[hk_cursor:hk_cursor+10]

    if a_batch or hk_batch:
        print(f"Step 5: Updating consensus (cursor={cursor})...")
        new_count = update_consensus_batch(a_batch, hk_batch, consensus)
        print(f"  Updated {new_count} stocks ({time.time()-t0:.0f}s)")
        state['consensus_cursor'] = cursor + 15

        # Merge new consensus into consensus_data
        for code, data in consensus.items():
            if code in consensus_data:
                consensus_data[code]['fy1'] = data['fy1']
                if data.get('fy2'):
                    consensus_data[code]['fy2'] = data['fy2']
                consensus_data[code]['analysts'] = data['analysts']

    # Step 6: Write files
    print("Step 6: Writing files...")
    write_js_var(sf_path, "STOCK_FINANCIALS", stock_fin)
    write_js_prices(cp_path, prices_data)
    write_js_var(cd_path, "CONSENSUS_DATA", consensus_data)

    # Copy to dist/data/
    import shutil
    for f in ["stock_financials.js", "current_prices.js", "consensus_data.js"]:
        src = os.path.join(SRC_DATA, f)
        dst = os.path.join(DIST_DATA, f)
        if os.path.exists(src):
            shutil.copy2(src, dst)

    # Save state
    state['consensus'] = consensus
    state['last_update'] = datetime.now().isoformat()
    state['prices_date'] = datetime.now().strftime('%Y-%m-%d')
    save_state(state)

    print(f"=== Done in {time.time()-t0:.0f}s ===")
    print(f"  Prices: {len(tencent_prices)}, Consensus: {len(consensus)}")

if __name__ == '__main__':
    main()
