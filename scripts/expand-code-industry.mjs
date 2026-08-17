/**
 * One-shot: classify remaining named-非ST「其他」into CODE_INDUSTRY heuristics,
 * merge into src/data/codeIndustry.js
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STOCK_FINANCIALS } from '../src/data/stock_financials.js'
import { getStockName } from '../src/data/stock_names.js'
import { getIndustry } from '../src/services/industry.js'
import { CODE_INDUSTRY } from '../src/data/codeIndustry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function guess(name) {
  const n = name || ''
  if (/指数|价值|转债|综指|金融$/.test(n) && /上证|中证|380|高新/.test(n)) return null // skip indices
  if (/ST|退市|退$/.test(n)) return null
  if (/中航|航发|成飞|沈飞|西飞|航空制造|航材|高科.*航|沈飞|光电.*航/.test(n) || /航发|沈飞|西飞|成飞/.test(n))
    return '航空制造'
  if (/军工|兵器|重机.*航|航天/.test(n)) return '军工电子'
  if (/铁路|铁特货|成渝|广深铁路|大秦/.test(n)) return '基建'
  if (/建工|建设|交建|江河|合诚|华设/.test(n)) return '房建'
  if (/能源|蒙电|电力|能化|成渝$|深圳能源|湖北能源|嘉泽新能|佛燃/.test(n)) return '火电'
  if (/环境|清新|盈峰|上海环境|洗霸/.test(n)) return '水处理'
  if (/钢铁|新钢|三钢|铸管|钢构|闽光/.test(n)) return '普钢'
  if (/冶|镁业|有色|龙佰|株冶/.test(n)) return '工业金属'
  if (/钾|盐湖|盐化工/.test(n)) return '农化'
  if (/橡胶|轮胎|双星/.test(n)) return '基础化工'
  if (/化工|腾达|美丰|华科|醋化|圣泉|川恒/.test(n)) return '基础化工'
  if (/半导|斯达半导|寒武纪|有研硅/.test(n)) return '芯片设计'
  if (/讯飞|网新|奇安信|软件|数科/.test(n)) return 'SaaS云计算'
  if (/大华|安防|立讯|精密|舜宇|丘钛|瑞声|工业富联/.test(n)) return /大华/.test(n) ? '安防' : '消费电子'
  if (/激光|智控|精工|装备|电气|时代电气|步科|威迈斯|麦格米特|三星电气|博菲电气/.test(n))
    return '专用设备'
  if (/诺唯赞|康希诺|海思科|泰诺麦博|生物/.test(n)) return /康希诺|疫苗/.test(n) ? '疫苗' : '生物创新药'
  if (/张裕|白酒|酿/.test(n)) return '区域白酒'
  if (/食品|元祖|一鸣|全聚德|同庆楼|名臣/.test(n)) return '休闲食品'
  if (/家居|居然|美凯龙|富森美|西大门|好太太|中源家居/.test(n)) return '家纺'
  if (/服饰|时尚|奥康|安正|牧高笛|摩登/.test(n)) return '休闲服饰'
  if (/体育|舒华|春风动力/.test(n)) return /春风/.test(n) ? '传统车企' : '运动服饰'
  if (/出版/.test(n)) return '出版'
  if (/物流|中谷|宏川|龙洲|海峡/.test(n)) return '仓储物流'
  if (/索道|旅游/.test(n)) return '景区'
  if (/玻璃|福莱特|巨石/.test(n)) return '玻璃'
  if (/卫浴|惠达/.test(n)) return '其他建材'
  if (/物业|商管|锦和|新大正/.test(n)) return '物业管理'
  if (/地产|陆家嘴|中华企业|京投|海南发展/.test(n)) return '住宅开发'
  if (/通讯|鼎信|武汉凡谷|长高|中电鑫龙/.test(n)) return '通信设备'
  if (/锂芯|蔚蓝锂|旭升|三花|奥特佳|飞龙|天汽模/.test(n)) return '汽车电子'
  if (/冷链|海容|爱仕达|奥佳华|荣泰/.test(n)) return '小家电'
  if (/跨境通|爱施德|零售|利群/.test(n)) return '电商零售'
  if (/投资|控股|集团|发展|国际|股份$/.test(n)) return null // too vague
  return null
}

const merged = { ...CODE_INDUSTRY }
let added = 0
for (const code of Object.keys(STOCK_FINANCIALS)) {
  if (merged[code]) continue
  const name = getStockName(code)
  if (!name) continue
  if (getIndustry(code, name) !== '其他') continue
  const g = guess(name)
  if (g) {
    merged[code] = g
    added++
  }
}

const body = `/**
 * Explicit code → industry overrides for names that keyword tables still miss.
 * Prefer NAME_RULES / getIndustry fallbacks; keep this list short and high-signal.
 */
export const CODE_INDUSTRY = ${JSON.stringify(merged, null, 2)}

export function industryByCode(code) {
  const c = String(code || '')
  if (CODE_INDUSTRY[c]) return CODE_INDUSTRY[c]
  if (c.length > 0 && c.length < 5) {
    const padded = c.padStart(5, '0')
    if (CODE_INDUSTRY[padded]) return CODE_INDUSTRY[padded]
  }
  if (c.length === 5 && c.startsWith('0')) {
    const short = c.replace(/^0+/, '')
    if (short && CODE_INDUSTRY[short]) return CODE_INDUSTRY[short]
  }
  return ''
}
`
fs.writeFileSync(path.join(__dirname, '../src/data/codeIndustry.js'), body)
console.log('added', added, 'total overrides', Object.keys(merged).length)
