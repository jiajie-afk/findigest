/**
 * Stratified Buffett–Munger valuation calibration.
 * Universe: 60 A-shares + 40 HK, ~50% small-cap (by total_mv).
 *
 * Usage: node scripts/calibrate_valuation.mjs
 */
import { STOCK_FINANCIALS } from '../src/data/stock_financials.js'
import { warmStockData } from '../src/data/loader.js'
import { calculateValuation } from '../src/services/valuation.js'
import { getIndustry } from '../src/services/industry.js'
import { getArchetype } from '../src/services/valuationTaxonomy.js'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const NAME_CACHE = join(__dirname, 'calibrate_names.json')

/** @type {Record<string, string>} seed names for reliability when quote API fails */
const SEED_NAMES = {
  '600519': '贵州茅台',
  '000858': '五粮液',
  '000568': '泸州老窖',
  '000596': '古井贡酒',
  '002304': '洋河股份',
  '600887': '伊利股份',
  '000651': '格力电器',
  '000333': '美的集团',
  '601398': '工商银行',
  '601288': '农业银行',
  '601939': '建设银行',
  '601328': '交通银行',
  '600036': '招商银行',
  '601166': '兴业银行',
  '601318': '中国平安',
  '601628': '中国人寿',
  '601601': '中国太保',
  '601336': '新华保险',
  '600030': '中信证券',
  '601688': '华泰证券',
  '000776': '广发证券',
  '601211': '国泰君安',
  '601899': '紫金矿业',
  '601088': '中国神华',
  '600019': '宝钢股份',
  '000983': '山西焦煤',
  '600585': '海螺水泥',
  '600801': '华新水泥',
  '300498': '温氏股份',
  '002714': '牧原股份',
  '601633': '长城汽车',
  '000625': '长安汽车',
  '600104': '上汽集团',
  '600900': '长江电力',
  '601668': '中国建筑',
  '601728': '中国电信',
  '600941': '中国移动',
  '000858': '五粮液',
  '000568': '泸州老窖',
  '000596': '古井贡酒',
  '002304': '洋河股份',
  '603288': '海天味业',
  '000538': '云南白药',
  '000651': '格力电器',
  '000333': '美的集团',
  '02328': '中国人保',
  '02601': '中国太保',
  '01336': '新华保险',
  '06030': '中信证券',
  '01088': '中国神华',
  '02899': '紫金矿业',
  '00386': '中国石油化工股份',
  '00883': '中国海洋石油',
  '00941': '中国移动',
  '000002': '万科A',
  '001979': '招商蛇口',
  '01109': '华润置地',
  '02007': '碧桂园',
  '600048': '保利发展',
  '601225': '陕西煤业',
  '002594': '比亚迪',
  '300750': '宁德时代',
  '601012': '隆基绿能',
  '600276': '恒瑞医药',
  '300015': '爱尔眼科',
  '002415': '海康威视',
  '300059': '东方财富',
  '002352': '顺丰控股',
  '601919': '中远海控',
  '600585': '海螺水泥',
  '000725': '京东方A',
  '002714': '牧原股份',
  '300498': '温氏股份',
  '002027': '分众传媒',
  '002475': '立讯精密',
  '300124': '汇川技术',
  '002230': '科大讯飞',
  '603259': '药明康德',
  '300760': '迈瑞医疗',
  '603288': '海天味业',
  '000538': '云南白药',
  '002050': '三花智控',
  '300014': '亿纬锂能',
  '002460': '赣锋锂业',
  '600438': '通威股份',
  '601633': '长城汽车',
  '000625': '长安汽车',
  '600104': '上汽集团',
  '601238': '广汽集团',
  '300308': '中际旭创',
  '601138': '工业富联',
  '688981': '中芯国际',
  '688111': '金山办公',
  '600941': '中国移动',
  '601728': '中国电信',
  '00700': '腾讯控股',
  '09988': '阿里巴巴-SW',
  '03690': '美团-W',
  '01024': '快手-W',
  '09618': '京东集团-SW',
  '02318': '中国平安',
  '01299': '友邦保险',
  '00005': '汇丰控股',
  '00939': '建设银行',
  '01398': '工商银行',
  '02388': '中银香港',
  '03988': '中国银行',
  '01288': '农业银行',
  '03968': '招商银行',
  '00883': '中国海洋石油',
  '01088': '中国神华',
  '01211': '比亚迪股份',
  '01810': '小米集团-W',
  '00941': '中国移动',
  '02628': '中国人寿',
  '02331': '李宁',
  '02020': '安踏体育',
  '01109': '华润置地',
  '02007': '碧桂园',
  '09626': '哔哩哔哩-W',
  '09868': '小鹏汽车-W',
  '06618': '京东健康',
  '09961': '携程集团-S',
  '02015': '理想汽车-W',
  '00981': '中芯国际',
  '00762': '中国联通',
  '06030': '中信证券',
  '06886': 'HTSC',
  '02601': '中国太保',
  '02328': '中国人保',
  '01658': '邮储银行',
  '09999': '网易-S',
  '02899': '紫金矿业',
  '00386': '中国石油化工股份',
  '02269': '药明生物',
  '06690': '海尔智家',
  '09866': '蔚来-SW',
  '02013': '微盟集团',
  '01548': '金斯瑞生物科技',
  '09922': '九毛九',
  '00813': '世茂集团',
  // —— 更多中小盘 A（训练小盘能力）——
  '300010': '立昂技术',
  '600419': '天润乳业',
  '002001': '新和成',
  '002459': '晶澳科技',
  '002493': '荣盛石化',
  '002709': '天赐材料',
  '300274': '阳光电源',
  '300782': '卓胜微',
  '603501': '韦尔股份',
  '002812': '恩捷股份',
  '000568': '泸州老窖',
  '603899': '晨光股份',
  '002568': '百润股份',
  '603605': '珀莱雅',
  '300866': '安克创新',
  '603345': '安井食品',
  '002507': '涪陵榨菜',
  '603369': '今世缘',
  '000799': '酒鬼酒',
  '603589': '口子窖',
  '002032': '苏泊尔',
  '002508': '老板电器',
  '603486': '科沃斯',
  '300750': '宁德时代',
  '002920': '德赛西威',
  '603596': '伯特利',
  '300496': '中科创达',
  '688036': '传音控股',
  '002271': '东方雨虹',
  '600801': '华新水泥',
  '000876': '新希望',
  '002311': '海大集团',
  '600298': '安琪酵母',
  '603156': '养元饮品',
  '002841': '视源股份',
  '300661': '圣邦股份',
  '688981': '中芯国际',
  // —— 更多港股中小盘 ——
  '01928': '金沙中国有限公司',
  '00268': '金蝶国际',
  '00388': '香港交易所',
  '01099': '创科实业',
  '02313': '申洲国际',
  '06862': '海底捞',
  '09618': '京东集团-SW',
  '02020': '安踏体育',
  '06160': '百济神州',
  '01801': '信达生物',
  '02269': '药明生物',
  '06618': '京东健康',
  '02423': '贝壳-W',
  '09633': '农夫山泉',
  '02057': '中通快递-W',
  '01336': '新华保险',
  '02601': '中国太保',
  '03323': '中国建材',
  '01186': '中国铁建',
  '03968': '招商银行',
  '00027': '银河娱乐',
  '00175': '吉利汽车',
  '00285': '比亚迪电子',
  '00780': '同程旅行',
  '01024': '快手-W',
  '01810': '小米集团-W',
  '02015': '理想汽车-W',
  '09868': '小鹏汽车-W',
  '09961': '携程集团-S',
  '09626': '哔哩哔哩-W',
  // —— 生物医药（独立配额，必须训练）——
  '600276': '恒瑞医药',
  '600196': '复星医药',
  '603259': '药明康德',
  '300760': '迈瑞医疗',
  '300015': '爱尔眼科',
  '002007': '华兰生物',
  '300122': '智飞生物',
  '300142': '沃森生物',
  '688180': '君实生物',
  '300347': '泰格医药',
  '300759': '康龙化成',
  '002821': '凯莱英',
  '300601': '康泰生物',
  '300595': '欧普康视',
  '300529': '健帆生物',
  '300298': '三诺生物',
  '02269': '药明生物',
  '06160': '百济神州',
  '01801': '信达生物',
  '01548': '金斯瑞生物科技',
  '09969': '诺诚健华-B',
  '02162': '康诺亚-B',
  // —— 券商 / 地产 / 公用补齐到每档≥10 ——
  '600999': '招商证券',
  '000166': '申万宏源',
  '601881': '中国银河',
  '601066': '中信建投',
  '601377': '兴业证券',
  '601878': '浙商证券',
  '06886': '华泰证券',
  '600340': '华夏幸福',
  '600606': '绿地控股',
  '600383': '金地集团',
  '000069': '华侨城A',
  '02202': '万科企业',
  '601985': '中国核电',
  '600795': '国电电力',
  '600886': '国投电力',
  '600011': '华能国际',
  '600027': '华电国际',
  '601991': '大唐发电',
  '01193': '华润燃气',
  '002352': '顺丰控股',
  '02057': '中通快递-W',
  // —— 细分行业补齐（类内轮转，忌白酒/大行扎堆）——
  '600519': '贵州茅台',
  '600809': '山西汾酒',
  '000568': '泸州老窖',
  '600600': '青岛啤酒',
  '002304': '洋河股份',
  '603288': '海天味业',
  '603605': '珀莱雅',
  '02331': '李宁',
  '02020': '安踏体育',
  '000651': '格力电器',
  '000333': '美的集团',
  '002032': '苏泊尔',
  '600036': '招商银行',
  '002142': '宁波银行',
  '600919': '江苏银行',
  '601009': '南京银行',
  '601169': '北京银行',
  '601229': '上海银行',
  '601166': '兴业银行',
  '601998': '中信银行',
  '601319': '中国人保',
  '02328': '中国人保',
  '06060': '众安在线',
  '601601': '中国太保',
  '601318': '中国平安',
  '601628': '中国人寿',
  '601336': '新华保险',
  '01299': '友邦保险',
  '02601': '中国太保',
  '01336': '新华保险',
  '601899': '紫金矿业',
  '600362': '江西铜业',
  '601600': '中国铝业',
  '600547': '山东黄金',
  '601088': '中国神华',
  '601225': '陕西煤业',
  '000983': '山西焦煤',
  '600309': '万华化学',
  '002493': '荣盛石化',
  '600019': '宝钢股份',
  '600585': '海螺水泥',
  '002714': '牧原股份',
  '300498': '温氏股份',
  '601633': '长城汽车',
  '000625': '长安汽车',
  '002594': '比亚迪',
  '300750': '宁德时代',
  '300014': '亿纬锂能',
  '002460': '赣锋锂业',
  '601012': '隆基绿能',
  '600438': '通威股份',
  '002475': '立讯精密',
  '300124': '汇川技术',
  '002415': '海康威视',
  '300308': '中际旭创',
  '300661': '圣邦股份',
  '603501': '韦尔股份',
  '002050': '三花智控',
  '002271': '东方雨虹',
  '300760': '迈瑞医疗',
  '300529': '健帆生物',
  '300595': '欧普康视',
  '00700': '腾讯控股',
  '09988': '阿里巴巴-SW',
  '03690': '美团-W',
  '01024': '快手-W',
  '09618': '京东集团-SW',
  '09999': '网易-S',
  '09626': '哔哩哔哩-W',
  '01810': '小米集团-W',
  '00268': '金蝶国际',
  '002027': '分众传媒',
  '09961': '携程集团-S',
  '600048': '保利发展',
  '000002': '万科A',
  '001979': '招商蛇口',
  '01109': '华润置地',
  '600340': '华夏幸福',
  '00166': '申万宏源',
  '601155': '新城控股',
  '600208': '新湖中宝',
  '02669': '中海物业',
  '01209': '华润万象生活',
  '06049': '保利物业',
}

function isHk(code) {
  return /^\d{5}$/.test(code)
}

function tencentSym(code) {
  if (isHk(code)) return `hk${code}`
  if (code.startsWith('6') || code.startsWith('9')) return `sh${code}`
  return `sz${code}`
}

async function fetchNames(codes) {
  let cache = {}
  if (existsSync(NAME_CACHE)) {
    try {
      cache = JSON.parse(readFileSync(NAME_CACHE, 'utf8'))
    } catch {
      cache = {}
    }
  }
  Object.assign(cache, SEED_NAMES)

  const missing = codes.filter((c) => !cache[c])
  const batchSize = 40
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize)
    const q = batch.map(tencentSym).join(',')
    try {
      const url = `https://qt.gtimg.cn/q=${q}`
      const res = await fetch(url)
      const buf = Buffer.from(await res.arrayBuffer())
      let text
      try {
        text = new TextDecoder('gbk').decode(buf)
      } catch {
        text = buf.toString('utf8')
      }
      for (const part of text.split(';')) {
        if (!part.includes('~')) continue
        const fields = part.split('~')
        const name = fields[1]
        const code = fields[2]
        if (name && code) {
          cache[code] = name
          if (code.length <= 5) cache[code.padStart(5, '0')] = name
        }
      }
    } catch (e) {
      console.warn('name fetch batch failed', e.message)
    }
  }

  writeFileSync(NAME_CACHE, JSON.stringify(cache, null, 2), 'utf8')
  return cache
}

/**
 * Equal-quota universe: each archetype ~10 names (相对均匀).
 * Soft constraints: ~60 A / ~40 HK, ~半小盘. No capital_heavy flood.
 */
function buildUniverse() {
  const ARCHES = [
    'franchise_brand',
    'bank',
    'insurance',
    'broker',
    'cyclical',
    'capital_heavy',
    'platform',
    'biotech',
    'real_estate',
    'utility_infra',
  ]
  const PER_ARCH = 10 // 10 × 10 = 100

  const aMed = (() => {
    const mvs = Object.entries(STOCK_FINANCIALS)
      .filter(([c, f]) => /^\d{6}$/.test(c) && f.total_mv > 0)
      .map(([, f]) => f.total_mv)
      .sort((a, b) => a - b)
    return mvs[Math.floor(mvs.length / 2)] || 150
  })()
  const hkMed = (() => {
    const mvs = Object.entries(STOCK_FINANCIALS)
      .filter(([c, f]) => isHk(c) && f.total_mv > 0)
      .map(([, f]) => f.total_mv)
      .sort((a, b) => a - b)
    return mvs[Math.floor(mvs.length / 2)] || 200
  })()

  const archOf = (code, name) => getArchetype(getIndustry(code, name || ''), name || '')

  /** @type {Record<string, Array<{code:string,name:string,mv:number,market:string,size:string,industry:string}>>} */
  const pools = Object.fromEntries(ARCHES.map((a) => [a, []]))
  const seen = new Set()

  const offer = (code, name) => {
    if (seen.has(code)) return
    const f = STOCK_FINANCIALS[code]
    if (!f || !(f.total_mv > 0)) return
    if (f.total_mv < (isHk(code) ? 5 : 12) && !SEED_NAMES[code]) return
    const nm = name || SEED_NAMES[code] || code
    const industry = getIndustry(code, nm)
    const arch = getArchetype(industry, nm)
    if (!pools[arch]) return
    const mv = f.total_mv
    const market = isHk(code) ? 'HK' : 'A'
    const size = mv < (market === 'HK' ? hkMed : aMed) ? 'small' : 'large'
    pools[arch].push({ code, name: nm, mv, market, size, industry })
    seen.add(code)
  }

  // Seeds first (named → reliable industry)
  for (const [code, name] of Object.entries(SEED_NAMES)) offer(code, name)

  /**
   * Within one archetype: round-robin by industry (max 2 per industry),
   * then soft A/HK × size mix. Prevents 白酒/大行/住宅扎堆.
   */
  const pickBalanced = (pool, n) => {
    const MAX_PER_IND = 2
    const out = []
    const used = new Set()
    const indCount = {}

    const byInd = {}
    for (const r of pool) (byInd[r.industry] ||= []).push(r)
    // Prefer industries with fewer candidates last? Actually rotate largest diversity first
    const indKeys = Object.keys(byInd).sort((a, b) => byInd[a].length - byInd[b].length)

    // Pass 1: one from each industry
    let progressed = true
    while (out.length < n && progressed) {
      progressed = false
      for (const ind of indKeys) {
        if (out.length >= n) break
        if ((indCount[ind] || 0) >= MAX_PER_IND) continue
        const cand = byInd[ind].find((r) => !used.has(r.code))
        if (!cand) continue
        out.push(cand)
        used.add(cand.code)
        indCount[ind] = (indCount[ind] || 0) + 1
        progressed = true
      }
    }

    // Pass 2: fill remaining with market/size diversity, still respect MAX_PER_IND
    const take = (pred) => {
      for (const r of pool) {
        if (out.length >= n) break
        if (used.has(r.code)) continue
        if ((indCount[r.industry] || 0) >= MAX_PER_IND) continue
        if (!pred(r)) continue
        out.push(r)
        used.add(r.code)
        indCount[r.industry] = (indCount[r.industry] || 0) + 1
      }
    }
    take((r) => r.market === 'A' && r.size === 'small')
    take((r) => r.market === 'HK' && r.size === 'small')
    take((r) => r.market === 'A' && r.size === 'large')
    take((r) => r.market === 'HK' && r.size === 'large')
    // Pass 3: allow 3rd in an industry only if still short
    if (out.length < n) {
      for (const r of pool) {
        if (out.length >= n) break
        if (used.has(r.code)) continue
        if ((indCount[r.industry] || 0) >= 3) continue
        out.push(r)
        used.add(r.code)
        indCount[r.industry] = (indCount[r.industry] || 0) + 1
      }
    }
    // Pass 4: hard fill to quota (prefer unused industries already saturated)
    if (out.length < n) {
      for (const r of pool) {
        if (out.length >= n) break
        if (used.has(r.code)) continue
        out.push(r)
        used.add(r.code)
      }
    }
    return out.slice(0, n)
  }

  let rows = []
  for (const arch of ARCHES) {
    const pool = pools[arch].sort((a, b) => a.mv - b.mv)
    rows.push(...pickBalanced(pool, PER_ARCH))
  }

  // Deduplicate only — do NOT top-up by market (that breaks equal-quota)
  const uniq = []
  const seenRow = new Set()
  for (const r of rows) {
    if (seenRow.has(r.code)) continue
    seenRow.add(r.code)
    uniq.push(r)
  }
  rows = uniq

  const countArch = (arch) => rows.filter((r) => archOf(r.code, r.name) === arch).length
  const aCount = () => rows.filter((r) => r.market === 'A').length
  const hkCount = () => rows.filter((r) => r.market === 'HK').length

  return {
    rows,
    meta: {
      aMed: Math.round(aMed * 10) / 10,
      hkMed: Math.round(hkMed * 10) / 10,
      a: aCount(),
      hk: hkCount(),
      small: rows.filter((r) => r.size === 'small').length,
      large: rows.filter((r) => r.size === 'large').length,
      seeded: rows.filter((r) => SEED_NAMES[r.code]).length,
      perArchTarget: PER_ARCH,
      byArchPreview: Object.fromEntries(ARCHES.map((a) => [a, countArch(a)])),
      poolSizes: Object.fromEntries(ARCHES.map((a) => [a, pools[a].length])),
    },
  }
}

const { rows: universe, meta } = buildUniverse()
const codes = universe.map((r) => r.code)
const names = await fetchNames(codes)
await warmStockData(codes)

const results = []
for (const u of universe) {
  const fin = STOCK_FINANCIALS[u.code]
  if (!fin) continue
  const name = names[u.code] || SEED_NAMES[u.code] || u.name || u.code
  const industry = getIndustry(u.code, name)
  const r = calculateValuation({ ...fin }, u.code, name)
  const size = u.mv < (isHk(u.code) ? meta.hkMed : meta.aMed) ? 'small' : 'large'
  results.push({
    code: u.code,
    name,
    market: isHk(u.code) ? 'HK' : 'A',
    size,
    mv: Math.round(u.mv * 10) / 10,
    industry,
    arch: r.archetype,
    quality: r.quality,
    competence: r.competence,
    pe: r.pe != null ? +Number(r.pe).toFixed(1) : null,
    mos: r.marginOfSafety,
    need: r.mosBuyMin,
    verdict: r.verdict,
    hint: r.actionHint,
    conf: r.mosConfidence,
  })
}

// ——— Reports ———
console.log('=== Universe (equal-quota) ===')
console.log(meta)
console.log(`n=${results.length} named=${results.filter((r) => r.name !== r.code).length}`)

const byArch = {}
for (const r of results) (byArch[r.arch] ||= []).push(r)

console.log('\n=== Archetype balance ===')
const total = results.length || 1
for (const arch of Object.keys(byArch).sort((a, b) => byArch[b].length - byArch[a].length)) {
  const list = byArch[arch]
  const pct = ((100 * list.length) / total).toFixed(0)
  console.log(`  ${arch.padEnd(18)} n=${String(list.length).padStart(2)} (${pct}%)`)
}

console.log('\n=== By archetype ===')
for (const [arch, list] of Object.entries(byArch).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n## ${arch} (n=${list.length})`)
  for (const r of list) {
    console.log(
      `  [${r.market}/${r.size}] ${r.name}(${r.code}) ind=${r.industry} PE=${r.pe} MoS=${r.mos}% need=${r.need}% [${r.quality}/${r.competence}] ${r.verdict} → ${r.hint}`,
    )
  }
}

// Industry diversity within sample
const byInd = {}
for (const r of results) (byInd[r.industry] ||= []).push(r.name)
console.log('\n=== Industry diversity ===')
console.log(`distinct industries: ${Object.keys(byInd).length}`)
const indSorted = Object.entries(byInd).sort((a, b) => b[1].length - a[1].length)
for (const [ind, names] of indSorted.slice(0, 30)) {
  console.log(`  ${ind}: ${names.length} — ${names.slice(0, 4).join('、')}`)
}
if (indSorted.length > 30) console.log(`  … +${indSorted.length - 30} industries`)

// Within-archetype industry concentration
console.log('\n=== Within-archetype industry spread ===')
for (const [arch, list] of Object.entries(byArch).sort((a, b) => a[0].localeCompare(b[0]))) {
  const counts = {}
  for (const r of list) counts[r.industry] = (counts[r.industry] || 0) + 1
  const vals = Object.values(counts)
  const maxI = Math.max(...vals)
  const nInd = Object.keys(counts).length
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([i, n]) => `${i}×${n}`)
    .join(', ')
  console.log(`  ${arch}: ${nInd} industries, max/ind=${maxI} — ${top}`)
}

const extreme = results.filter((r) => r.mos != null && Math.abs(r.mos) > 50)
const buySignals = results.filter((r) => /可考虑分批|可小仓/.test(r.hint || ''))
const hard = results.filter((r) => r.competence === 'hard' || /太难理解/.test(r.hint || ''))
const otherArch = results.filter((r) => r.industry === '其他' || r.industry === '港股其他')
const smallBuys = buySignals.filter((r) => r.size === 'small')
const contradict = results.filter(
  (r) =>
    (r.verdict?.includes('偏高') && /分批|小仓/.test(r.hint || '')) ||
    (r.verdict?.includes('偏低') && /偏贵/.test(r.hint || '') && (r.mos == null || r.mos > -5)),
)

const counts = Object.values(byArch).map((l) => l.length)
const maxC = Math.max(...counts)
const minC = Math.min(...counts)

console.log('\n=== Health checks ===')
console.log(`|MoS|>50%: ${extreme.length}`)
console.log(`arch max/min: ${maxC}/${minC} (spread ${maxC - minC})`)
console.log(`buy-ish hints: ${buySignals.length} (small-cap among them: ${smallBuys.length})`)
console.log(`hard/competence-out: ${hard.length}`)
console.log(`industry fallback 其他/港股其他: ${otherArch.length}`)
console.log(`verdict↔hint contradictions: ${contradict.length}`)

console.log('\n=== Size × market ===')
for (const market of ['A', 'HK']) {
  for (const size of ['small', 'large']) {
    const list = results.filter((r) => r.market === market && r.size === size)
    console.log(`  ${market}/${size} n=${list.length}`)
  }
}

const outPath = join(__dirname, 'calibrate_report.json')
writeFileSync(
  outPath,
  JSON.stringify(
    {
      meta,
      extreme,
      otherArch: otherArch.map((r) => ({ code: r.code, name: r.name, arch: r.arch, industry: r.industry })),
      smallBuys,
      contradict,
      byArch: Object.fromEntries(Object.entries(byArch).map(([k, v]) => [k, v.length])),
      byIndustry: Object.fromEntries(Object.entries(byInd).map(([k, v]) => [k, v.length])),
      results,
    },
    null,
    2,
  ),
  'utf8',
)
console.log(`\nWrote ${outPath}`)
