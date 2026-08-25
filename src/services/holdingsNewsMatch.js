/**
 * Tag CCTV / 联播 headlines against the user's book.
 * Name/code hits are "点名"; industry keywords are "行业相关".
 * Never a buy/sell signal.
 */
import { getIndustry } from './industry.js'

const GEO_PREFIX =
  /^(贵州|山西|四川|云南|安徽|江苏|浙江|山东|河南|河北|湖南|湖北|广东|广西|福建|江西|辽宁|吉林|黑龙江|陕西|甘肃|新疆|西藏|内蒙古|宁夏|青海|北京|上海|天津|重庆)/

const SUFFIX = /(股份有限公司|有限公司|股份公司|股份|集团|控股|有限)$/g

const NAME_STOP = new Set([
  '中国',
  '国际',
  '科技',
  '发展',
  '建设',
  '投资',
  '实业',
  '股份',
  '集团',
  '控股',
  '银行',
  '证券',
  '保险',
  '能源',
  '电力',
  '有限',
  '公司',
  'A',
  'B',
])

const NOISE_TITLE = /足协|美食节|演唱会|选美|乒乓球|羽毛球|奥运村|马拉松/

/** Common words: only count if they appear in the title. */
const TITLE_ONLY = new Set([
  '白酒',
  '航天',
  '原油',
  '房地产',
  '央行',
  '保险',
  '光伏',
  '港口',
  '航运',
  '军工',
  '火箭',
  '卫星',
  '银行',
  '券商',
])

const BANK_KW = ['降准', '降息', 'LPR', '央行', '信贷投放', '存款利率', '房贷利率', '商业银行']
const LIQUOR_KW = ['白酒', '酱香', '酒业', '批价', '酒企']
const SHIP_KW = ['霍尔木兹', '油运', 'VLCC', 'BDI', '海运费', '原油运输', '海峡封锁']
const AERO_KW = ['航天', '载人航天', '嫦娥', '商业航天', '火箭发射', '卫星发射']
const DEFENSE_KW = ['军工', '国防装备', '武器装备']
const INS_KW = ['保费', '偿付能力', '保险资金']
const BROKER_KW = ['券商', '印花税', '注册制']
const PROPERTY_KW = ['房地产', '保交楼', '限购', '房企', '楼市']
const PHARMA_KW = ['集采', '医保谈判', '药审', '创新药']
const EV_KW = ['新能源车', '购置税减免', '充电桩', '动力电池']
const PV_KW = ['光伏', '硅料', '新能源消纳']
const OIL_KW = ['原油', 'OPEC', '成品油']
const UTILITY_KW = ['电价', '利用小时', '电网']
const FOOD_KW = ['乳业', '奶粉', '调味品']

/**
 * @param {string} name
 * @returns {string[]}
 */
export function nameTokens(name) {
  const raw = String(name || '')
    .replace(/[\s*]/g, '')
    .replace(/^\*ST|^ST/, '')
    .replace(/-W$|-SW$|-B$|-S$/i, '')
  const stripped = raw.replace(SUFFIX, '')
  const tokens = new Set()
  if (raw.length >= 2) tokens.add(raw)
  if (stripped.length >= 2) tokens.add(stripped)
  const geo = stripped.match(new RegExp(`${GEO_PREFIX.source}(.+)$`))
  if (geo && geo[2] && geo[2].length >= 2) tokens.add(geo[2])
  return [...tokens].filter((t) => t.length >= 2 && !NAME_STOP.has(t))
}

/**
 * @param {string} industry
 * @returns {string[]}
 */
export function keywordsForIndustry(industry) {
  const ind = String(industry || '')
  if (!ind) return []
  if (/白酒/.test(ind)) return LIQUOR_KW
  if (/银行/.test(ind)) return BANK_KW
  if (/保险/.test(ind)) return INS_KW
  if (/券商/.test(ind)) return BROKER_KW
  if (/航运|油运/.test(ind)) return SHIP_KW
  if (/港口/.test(ind)) return ['港口吞吐量', '集装箱', '码头']
  if (/航天/.test(ind)) return AERO_KW
  if (/军工/.test(ind)) return DEFENSE_KW
  if (/住宅|地产|物业/.test(ind)) return PROPERTY_KW
  if (/药|疫苗|CXO|耗材|诊断/.test(ind)) return PHARMA_KW
  if (/新能源车|整车/.test(ind)) return EV_KW
  if (/光伏|硅片|硅料/.test(ind)) return PV_KW
  if (/石油|油气/.test(ind)) return OIL_KW
  if (/核电|水电|电力|公用/.test(ind)) return UTILITY_KW
  if (/乳|调味|食品|啤酒/.test(ind)) return FOOD_KW
  return []
}

function haystacks(item) {
  const title = String(item?.title || '')
  const brief = String(item?.brief || item?.description || '')
  return { title, brief, all: `${title}\n${brief}` }
}

function industryHits(title, brief, keywords) {
  const found = []
  for (const kw of keywords || []) {
    const inTitle = title.includes(kw)
    const inBrief = brief.includes(kw)
    if (!inTitle && !inBrief) continue
    if (TITLE_ONLY.has(kw) && !inTitle) continue
    found.push(kw)
  }
  return found
}

/**
 * @param {{ title?: string, brief?: string, description?: string }} item
 * @param {{ code?: string, name?: string, industry?: string }} holding
 * @returns {{ code: string, name: string, industry: string, strength: 'strong'|'weak', why: string } | null}
 */
export function matchHolding(item, holding) {
  const code = String(holding?.code || '')
  const name = String(holding?.name || '')
  const industry = holding?.industry || (code || name ? getIndustry(code, name) : '')
  const { title, brief, all } = haystacks(item)

  const tokens = nameTokens(name)
  let nameHit = ''
  for (const t of tokens) {
    if (title.includes(t) || (t.length >= 3 && all.includes(t))) {
      nameHit = t
      break
    }
  }
  const codeHit = code && code.length >= 5 && (title.includes(code) || brief.includes(code))

  if (nameHit || codeHit) {
    return {
      code,
      name,
      industry,
      strength: 'strong',
      why: nameHit ? `点名「${nameHit}」` : `代码 ${code}`,
    }
  }

  if (NOISE_TITLE.test(title)) return null

  const kws = keywordsForIndustry(industry)
  const hits = industryHits(title, brief, kws)
  if (!hits.length) return null
  return {
    code,
    name,
    industry,
    strength: 'weak',
    why: `行业「${industry}」·${hits[0]}`,
  }
}

/**
 * @param {{ title?: string, brief?: string, description?: string }} item
 * @param {Array<{ code?: string, name?: string, industry?: string }>} holdings
 */
export function matchItemToHoldings(item, holdings) {
  const out = []
  const seen = new Set()
  for (const h of holdings || []) {
    const hit = matchHolding(item, h)
    if (!hit || !hit.code || seen.has(hit.code)) continue
    seen.add(hit.code)
    out.push(hit)
  }
  out.sort((a, b) => (a.strength === b.strength ? 0 : a.strength === 'strong' ? -1 : 1))
  return out
}

/**
 * @param {Array<object>} items
 * @param {Array<{ code?: string, name?: string, industry?: string }>} holdings
 */
export function annotateNewsItems(items, holdings) {
  const book = (holdings || [])
    .map((h) => ({
      code: String(h.code || ''),
      name: String(h.name || ''),
      industry: h.industry || '',
    }))
    .filter((h) => h.code || h.name)
  return (items || []).map((it) => ({
    ...it,
    relatedHoldings: matchItemToHoldings(it, book),
  }))
}
