#!/usr/bin/env python3
"""
FinDigest 数据源全面升级脚本
- 用东方财富API获取全部1398只股票的完整财务数据
- 字段：EPS, BVPS, ROE, 毛利率, 净利率, 负债率, 营收增速, 利润增速, 股息率, 总市值
- 输出：更新后的 STOCK_FINANCIALS JS变量 + 扩展的 CONSENSUS_DATA
"""
import json, re, os, time, sys, urllib.request

HTML_PATH = "/sessions/youthful-wizardly-turing/mnt/FINANCIAL INFORMATION COLLECTION/FinDigest/index.html"
OUTPUT_DIR = "/sessions/youthful-wizardly-turing/mnt/outputs/findigest_upgrade"

def load_html():
    with open(HTML_PATH, 'r', encoding='utf-8') as f:
        return f.read()

def extract_db(html):
    m = re.search(r"var DB=\{(.*?)\}", html, re.DOTALL)
    if not m: return {}
    return dict(re.findall(r"'(\d+)':'([^']+)'", m.group(1)))

def extract_consensus_codes(html):
    m = re.search(r"var CONSENSUS_DATA = \{(.*?)\n\};", html, re.DOTALL)
    if not m: return set()
    return set(re.findall(r"'(\d+)':\{", m.group(1)))

def is_hk(code):
    """5-digit or starts with 0 + 4 digits = HK"""
    return len(code) == 5 or (len(code) == 4 and code[0] == '0')

def eastmoney_secid(code):
    """Convert stock code to East Money secid format"""
    if is_hk(code):
        return f"116.{code}"
    if code.startswith('6') or code.startswith('9'):
        return f"1.{code}"
    return f"0.{code}"

def fetch_eastmoney_financial_batch(codes, batch_size=50):
    """Fetch financial data from East Money API in batches"""
    results = {}
    total = len(codes)

    for i in range(0, total, batch_size):
        batch = codes[i:i+batch_size]
        secids = ','.join([eastmoney_secid(c) for c in batch])

        # Fields:
        # f57=code, f58=name, f43=price, f162=PE_TTM, f163=PE_static,
        # f167=PB, f116=total_mv, f117=circ_mv,
        # f183=ROE, f184=gross_margin, f185=net_margin, f186=debt_ratio,
        # f187=revenue, f188=profit, f185=net_margin,
        # f164=div_yield, f170=change_pct, f173=profit_growth, f191=revenue_growth
        url = (f"https://push2.eastmoney.com/api/qt/ulist.np/get?"
               f"fltt=2&invt=2&fields=f57,f58,f43,f162,f163,f167,f116,f117,"
               f"f183,f184,f185,f186,f187,f188,f164,f170,f173,f191"
               f"&secids={secids}")

        try:
            req = urllib.request.Request(url)
            req.add_header('User-Agent', 'Mozilla/5.0')
            req.add_header('Referer', 'https://quote.eastmoney.com')
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            if data and data.get('data') and data['data'].get('diff'):
                for item in data['data']['diff']:
                    code = str(item.get('f57', ''))
                    if not code:
                        continue
                    price = item.get('f43', 0)
                    if isinstance(price, str) and price == '-':
                        price = 0
                    price = float(price) if price else 0

                    # Some fields return '-' for unavailable data
                    def safe_float(v, default=0):
                        if v is None or v == '-' or v == '': return default
                        try: return float(v)
                        except: return default

                    pe_ttm = safe_float(item.get('f162'))
                    pb = safe_float(item.get('f167'))
                    roe = safe_float(item.get('f183'))
                    gross_margin = safe_float(item.get('f184'))
                    net_margin = safe_float(item.get('f185'))
                    debt_ratio = safe_float(item.get('f186'))
                    revenue = safe_float(item.get('f187'))
                    profit = safe_float(item.get('f188'))
                    div_yield = safe_float(item.get('f164'))
                    profit_growth = safe_float(item.get('f173'))
                    revenue_growth = safe_float(item.get('f191'))
                    total_mv = safe_float(item.get('f116'))  # 总市值(元)

                    # Calculate EPS and BVPS from PE/PB
                    eps = round(price / pe_ttm, 4) if pe_ttm > 0 and price > 0 else 0
                    bvps = round(price / pb, 4) if pb > 0 and price > 0 else 0

                    results[code] = {
                        'price': round(price, 2),
                        'pe_ttm': round(pe_ttm, 2),
                        'pb': round(pb, 2),
                        'eps': eps,
                        'bvps': bvps,
                        'roe': round(roe, 1),
                        'grossMargin': round(gross_margin, 1),
                        'netMargin': round(net_margin, 1),
                        'debtRatio': round(debt_ratio, 1),
                        'revenue': round(revenue / 1e8, 1) if revenue else 0,  # 亿
                        'profit': round(profit / 1e8, 1) if profit else 0,      # 亿
                        'revenueGrowth': round(revenue_growth, 1),
                        'profitGrowth': round(profit_growth, 1),
                        'dividendYield': round(div_yield, 2),
                        'total_mv': round(total_mv / 1e8, 1) if total_mv else 0  # 亿
                    }

            progress = min(i + batch_size, total)
            pct = round(progress / total * 100)
            print(f"  进度: {progress}/{total} ({pct}%)", flush=True)

        except Exception as e:
            print(f"  批次 {i//batch_size+1} 失败: {e}", flush=True)

        time.sleep(0.3)  # Rate limiting

    return results

def fetch_hk_financial(codes):
    """Fetch HK stock financial data from East Money HK API"""
    results = {}
    total = len(codes)

    for i, code in enumerate(codes):
        url = (f"https://push2.eastmoney.com/api/qt/stock/get?"
               f"secid=116.{code}&fields=f57,f58,f43,f162,f167,f116,"
               f"f183,f184,f185,f186,f187,f188,f164,f173,f191")
        try:
            req = urllib.request.Request(url)
            req.add_header('User-Agent', 'Mozilla/5.0')
            req.add_header('Referer', 'https://quote.eastmoney.com')
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            if data and data.get('data'):
                item = data['data']
                def safe_float(v, default=0):
                    if v is None or v == '-' or v == '': return default
                    try: return float(v)
                    except: return default

                price = safe_float(item.get('f43'))
                pe_ttm = safe_float(item.get('f162'))
                pb = safe_float(item.get('f167'))
                roe = safe_float(item.get('f183'))
                gross_margin = safe_float(item.get('f184'))
                net_margin = safe_float(item.get('f185'))
                debt_ratio = safe_float(item.get('f186'))
                revenue = safe_float(item.get('f187'))
                profit = safe_float(item.get('f188'))
                div_yield = safe_float(item.get('f164'))
                profit_growth = safe_float(item.get('f173'))
                revenue_growth = safe_float(item.get('f191'))
                total_mv = safe_float(item.get('f116'))

                eps = round(price / pe_ttm, 4) if pe_ttm > 0 and price > 0 else 0
                bvps = round(price / pb, 4) if pb > 0 and price > 0 else 0

                results[code] = {
                    'price': round(price, 2),
                    'pe_ttm': round(pe_ttm, 2),
                    'pb': round(pb, 2),
                    'eps': eps,
                    'bvps': bvps,
                    'roe': round(roe, 1),
                    'grossMargin': round(gross_margin, 1),
                    'netMargin': round(net_margin, 1),
                    'debtRatio': round(debt_ratio, 1),
                    'revenue': round(revenue / 1e8, 1) if revenue else 0,
                    'profit': round(profit / 1e8, 1) if profit else 0,
                    'revenueGrowth': round(revenue_growth, 1),
                    'profitGrowth': round(profit_growth, 1),
                    'dividendYield': round(div_yield, 2),
                    'total_mv': round(total_mv / 1e8, 1) if total_mv else 0
                }
        except Exception as e:
            pass  # Skip failed HK stocks silently

        if (i + 1) % 50 == 0:
            print(f"  港股进度: {i+1}/{total}", flush=True)
        time.sleep(0.2)

    return results

def generate_js_var(name, data, indent=0):
    """Generate a JS variable assignment from a dict"""
    prefix = ' ' * indent
    lines = [f"{prefix}var {name} = {{"]
    entries = list(data.items())
    for i, (code, val) in enumerate(entries):
        comma = ',' if i < len(entries) - 1 else ''
        if isinstance(val, dict):
            fields = ','.join(f'"{k}":{json.dumps(v, ensure_ascii=False) if isinstance(v, str) else v}' for k, v in val.items())
            lines.append(f'{prefix}"{code}":{{{fields}}}{comma}')
        else:
            lines.append(f'{prefix}"{code}":{json.dumps(val, ensure_ascii=False)}{comma}')
    lines.append(f"{prefix}}};")
    return '\n'.join(lines)

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("=" * 50)
    print("FinDigest 数据源全面升级")
    print("=" * 50)

    # 1. Load HTML and extract DB
    print("\n[1/4] 加载数据库...")
    html = load_html()
    db = extract_db(html)
    consensus_codes = extract_consensus_codes(html)
    all_codes = list(db.keys())
    print(f"  总股票数: {len(all_codes)}")
    print(f"  已有分析师覆盖: {len(consensus_codes)}")

    a_codes = [c for c in all_codes if not is_hk(c)]
    hk_codes = [c for c in all_codes if is_hk(c)]
    print(f"  A股: {len(a_codes)}, 港股: {len(hk_codes)}")

    # 2. Fetch A-share financial data
    print(f"\n[2/4] 获取A股财务数据 ({len(a_codes)}只)...")
    a_data = fetch_eastmoney_financial_batch(a_codes, batch_size=80)
    print(f"  A股获取成功: {len(a_data)}只")

    # 3. Fetch HK financial data
    print(f"\n[3/4] 获取港股财务数据 ({len(hk_codes)}只)...")
    hk_data = fetch_hk_financial(hk_codes)
    print(f"  港股获取成功: {len(hk_data)}只")

    # Merge
    all_data = {}
    all_data.update(a_data)
    all_data.update(hk_data)
    print(f"\n  合计获取: {len(all_data)}只")

    # Stats
    has_eps = sum(1 for d in all_data.values() if d.get('eps', 0) > 0)
    has_roe = sum(1 for d in all_data.values() if d.get('roe', 0) > 0)
    has_mv = sum(1 for d in all_data.values() if d.get('total_mv', 0) > 0)
    print(f"  有EPS: {has_eps}, 有ROE: {has_roe}, 有市值: {has_mv}")

    # 4. Save outputs
    print(f"\n[4/4] 保存数据...")

    # Save full financial data as JSON
    json_path = os.path.join(OUTPUT_DIR, 'full_financial_data.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    print(f"  JSON: {json_path}")

    # Save as JS variable (for STOCK_FINANCIALS replacement)
    js_path = os.path.join(OUTPUT_DIR, 'stock_financials_js.txt')
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(generate_js_var('STOCK_FINANCIALS', all_data))
    print(f"  JS变量: {js_path}")

    # Save stats
    stats = {
        'total': len(all_data),
        'a_shares': len(a_data),
        'hk_shares': len(hk_data),
        'with_eps': has_eps,
        'with_roe': has_roe,
        'with_mv': has_mv,
        'coverage_pct': round(len(all_data) / len(all_codes) * 100, 1)
    }
    stats_path = os.path.join(OUTPUT_DIR, 'upgrade_stats.json')
    with open(stats_path, 'w', encoding='utf-8') as f:
        json.dump(stats, f, indent=2)

    print(f"\n{'=' * 50}")
    print(f"升级完成！")
    print(f"  覆盖率: {stats['coverage_pct']}% ({stats['total']}/{len(all_codes)})")
    print(f"  A股: {stats['a_shares']}, 港股: {stats['hk_shares']}")
    print(f"  有EPS: {stats['with_eps']}, 有ROE: {stats['with_roe']}")
    print(f"{'=' * 50}")

if __name__ == '__main__':
    main()
