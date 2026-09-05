function sanitizeLlmBriefing(text) {
  if (!text) return text
  let out = String(text)
  const replacements = [
    [/\bSIGNAL\s*:\s*(BUY|SELL|HOLD)\b/gi, 'SIGNAL: （已省略交易指令）'],
    [/\bACTION\s*:\s*(Buy|Sell|Hold)\b/gi, 'ACTION: （研究备注，非下单）'],
    [/\bRATING\s*:\s*(Overweight|Equal Weight|Underweight|Buy|Sell)\b/gi, 'RATING: （研究分档，非下单）'],
    [/\bENTRY\s*:\s*[^\n]+/gi, 'ENTRY: （不提供进场点）'],
    [/\bSTOP\s*:\s*[^\n]+/gi, 'STOP: （不提供止损点）'],
    [/\bSIZE\s*:\s*[^\n]+/gi, 'SIZE: （仓位由硬约束决定，此处不下单）'],
    [/\b(BUY|SELL)\b/g, '（研究倾向，非指令）'],
    [/建议(立即)?买入/g, '仅作观察：是否加仓须过硬约束'],
    [/建议(立即)?卖出/g, '仅作观察：减仓含义须对照硬约束'],
    [/建议(立即)?(加仓|清仓)/g, '仅作观察：仓位变动须过硬约束'],
    [/目标价[:：]\s*¥?[\d.]+(?:\s*[–\-至到]\s*¥?[\d.]+)?/g, '目标价：不提供'],
    [/止损价[:：]\s*¥?[\d.]+/g, '止损价：不提供'],
    [/进场(?:价|区间)[:：][^\n]+/g, '进场点：不提供'],
  ]
  for (const [re, sub] of replacements) out = out.replace(re, sub)
  return out.trim()
}

export const NEWS_BRIEF_SYSTEM = `你是 FinDigest 的宏观与产业研究助手。任务：把一条要闻翻译成「真实经济怎么被碰到」，再按时间拆开。不是荐股机器人，不是主题炒作写手。

必须遵循：
1. 先问四个经济问题再写：这条新闻动的是需求、供给、价格、资金、财政、汇率、就业里的哪一根？谁付钱、谁收钱？现金流什么时候进报表？有没有被标题夸大？
2. 思考过程要具体。至少覆盖：事实边界 → 经济变量 → 部门/行业谁先被传到 → 短期情绪与中期盈利为何可能分叉 → 长期是否改变结构。禁止空话（「利好市场」「提振信心」单独成句不算分析）。
3. 核心输出是三档时间：
   - 短期（数日到数周）：资金价格、风险偏好、库存与现货、运价、情绪溢价。还没进报表的不要写成已经兑现。
   - 中期（一季到四季度）：订单、信贷、投资、消费、政策落地、利润表。写清「还缺哪张数据才能确认」。
   - 长期（一年以上）：产能、制度、人口/收入结构、全球分工。单条联播很少改结构，不要硬写百年变局。
4. 板块是行业/主题，不是买入清单。禁止点名个股并暗示该买该卖。新闻里的公司可作事实主语，随后必须落到行业与经济变量。
5. 禁止 BUY/SELL/HOLD、目标价、止损、仓位、加仓、清仓、必买清单。
6. 利好、利空、中性、不确定都要诚实。人事、外事、会议如果传导链写不出来，三档都应写不确定，并说明缺什么。
7. 只输出一个 JSON 对象，不要 markdown 围栏，不要前后解释。`

const TONES = new Set(['利好', '利空', '中性', '不确定'])
const EFFECTS = new Set(['利好', '利空', '中性', '不确定'])

const RULES = [
  {
    test: /降准|降息|LPR|存款准备金|MLF|逆回购/,
    thinking:
      '这是货币条件变化，不是销售数据。短端先动的是银行间流动性、债券利率和风险偏好；中期要看信贷和居民加杠杆是否真的起来；长期只靠降准降息解决不了收入与资产负债表问题。地产只有同时出现需求端松绑，才从资金逻辑变成销售逻辑。',
    tone: '利好',
    sectors: [
      { name: '银行', effect: '利好', why: '负债成本先降，净息差预期改善，但资产端收益率随后也会下移。' },
      { name: '地产链', effect: '中性', why: '资金面改善不等于购房需求恢复。' },
    ],
    short: {
      effect: '利好',
      text: '银行间资金预计变松，短端利率和信用债利差往往先反应。股市里金融与高估值成长会对流动性更敏感，这是价格层，还不是企业已经多赚钱。',
    },
    medium: {
      effect: '中性',
      text: '一到四个季度要看贷款增速、票据冲量还是真需求、居民按揭与企业中长贷。若只是金融机构空转，对GDP和上市公司利润帮助有限。',
    },
    long: {
      effect: '不确定',
      text: '货币宽松改变的是融资价格，不自动修复就业、收入和房价预期。长期增长仍取决于 entrench 的需求能否回来，单次降准不是结构改革。',
    },
  },
  {
    test: /专项债|财政政策|超长期国债|赤字|以旧换新|消费券/,
    thinking:
      '这是财政扩张或消费补贴。短端是国债供给和项目开工预期；中期是基建实物工作量、耐用消费品和相关中游材料；长期要看有没有形成可持续的居民收入，而不是一次性把需求提前透支。',
    tone: '利好',
    sectors: [
      { name: '基建链', effect: '利好', why: '财政资金最终要变成水泥、金属、设备与施工订单。' },
      { name: '可选消费', effect: '中性', why: '补贴能提前需求，但不等于收入趋势改善。' },
    ],
    short: {
      effect: '利好',
      text: '债市会权衡供给冲击与增长预期；股市里建筑、建材、部分制造对「有项目、有资金」的叙事更敏感。',
    },
    medium: {
      effect: '利好',
      text: '要看专项债发行和使用进度、项目资本金是否到位。实物工作量上来，中游材料和设备的收入才进报表。',
    },
    long: {
      effect: '中性',
      text: '若只是把明天的消费和投资挪到今天，长期乘数有限。能留下资产和收入的项目，才谈得上改变潜在增长。',
    },
  },
  {
    test: /军工|国防|武器装备|战备|解放军装备/,
    thinking:
      '国防开支是政府采购。短端是主题与订单预期；中期才是军工企业收入确认；长期取决于国防预算占财政的比重，不是一条新闻就能改。',
    tone: '利好',
    sectors: [{ name: '军工', effect: '利好', why: '装备需求叙事先于利润兑现。' }],
    short: {
      effect: '利好',
      text: '风险偏好会涌向军工主题，价格可以先动。这反映的是预期，不是当季已经交货。',
    },
    medium: {
      effect: '中性',
      text: '要看预算、招标和合同。没有后续采购文件，中期盈利还是不确定。',
    },
    long: {
      effect: '不确定',
      text: '军工产能和研发周期以年计。长期只在国防开支趋势向上时才构成产业结构变化。',
    },
  },
  {
    test: /航天|载人航天|嫦娥|火箭发射|卫星发射|商业航天/,
    thinking:
      '航天任务是公共投资加技术外溢。短端是主题；中期是箭体、测控、卫星应用的合同；长期才可能形成商业航天的经常性收入。',
    tone: '利好',
    sectors: [{ name: '航天装备', effect: '利好', why: '任务节点抬升商业航天与卫星应用的关注度。' }],
    short: {
      effect: '利好',
      text: '发射窗口会点燃主题交易。经济上当天几乎没有新增GDP。',
    },
    medium: {
      effect: '中性',
      text: '后续商业订单、频谱与应用落地才决定中游制造能否把新闻变成收入。',
    },
    long: {
      effect: '不确定',
      text: '商业闭环（通信、遥感、导航服务收费）需要多年。没有收费模式就只是财政支出。',
    },
  },
  {
    test: /集采|医保谈判|药审|创新药/,
    thinking:
      '医药政策同时动价格和准入。集采压的是仿制药支付端；审评开闸动的是创新药供给。短端情绪分裂，中期看放量和降价谁赢，长期看支付能力和管线。',
    tone: '中性',
    sectors: [{ name: '医药', effect: '中性', why: '降价与审批往往同时存在，不能写成单边利好。' }],
    short: {
      effect: '不确定',
      text: '集采名单或谈判规则一出，相关仿制药股价先定价。这是支付价格预期，不是销量已经爆。',
    },
    medium: {
      effect: '中性',
      text: '中期看中标价、执行量和医院端替代。创新药则看获批适应症能否放量。',
    },
    long: {
      effect: '不确定',
      text: '长期取决于医保筹资与创新回报是否平衡。支付能力约束在，单条政策很难永久抬高全行业利润率。',
    },
  },
  {
    test: /新能源车|购置税|充电桩|动力电池|光伏|硅料|风电/,
    thinking:
      '新能源同时有补贴、产能和价格三条线。短端是政策情绪和产业链现货；中期是装机、车销和电池排产；长期是电价、消纳和全球供给格局。',
    tone: '利好',
    sectors: [{ name: '新能源', effect: '利好', why: '政策或产业节点通常先作用于车、电池或光伏链条。' }],
    short: {
      effect: '利好',
      text: '补贴、税收或装机目标会立刻改预期。现货价格（硅料、碳酸锂）可能先于财报波动。',
    },
    medium: {
      effect: '中性',
      text: '要核对排产、出口和价格战。产能过剩时，中期利润会被价格打掉，即使销量还在涨。',
    },
    long: {
      effect: '不确定',
      text: '长期看电网消纳、全球贸易壁垒和成本曲线。技术路线切换会让今天的产能在几年后贬值。',
    },
  },
  {
    test: /房地产|保交楼|限购|房企|楼市|住房公积金/,
    thinking:
      '地产是居民资产负债表和地方政府财政的交汇。短端是情绪和销售周末数据；中期是开工、竣工、相关工业品；长期是人口、收入和房价预期能否稳住。',
    tone: '中性',
    sectors: [{ name: '房地产', effect: '中性', why: '表态常见，需求端措施才构成销售逻辑。' }],
    short: {
      effect: '中性',
      text: '政策口径变化会先打到开发商融资预期和周末看房。成交没有跟上之前，不宜写成需求已经恢复。',
    },
    medium: {
      effect: '不确定',
      text: '中期看新房销售、土地出让和城投/地方财政。销售起不来，上游建材和家电的中期盈利也接不住。',
    },
    long: {
      effect: '不确定',
      text: '住房从增量转向存量。长期增长不再靠高杠杆开工，而靠收入和城市化质量，单条新闻改不了这个斜率。',
    },
  },
  {
    test: /半导体|芯片|光刻|集成电路|国产替代/,
    thinking:
      '半导体是全球分工加资本开支。短端是自主可控主题；中期是设备材料进口替代的订单；长期是制程、人才和对外管制。',
    tone: '利好',
    sectors: [{ name: '半导体', effect: '利好', why: '产业政策或管制叙事会先传到设备和材料。' }],
    short: {
      effect: '利好',
      text: '出口管制或扶持文件会迅速改风险偏好。这是主题溢价，不是当季晶圆厂已经扩产完成。',
    },
    medium: {
      effect: '中性',
      text: '中期看资本开支、国产设备验证和下游消费电子/汽车需求。没有下游，设备订单也撑不久。',
    },
    long: {
      effect: '不确定',
      text: '长期取决于能否在限制下形成可重复的工艺能力。这是数年维度，单条新闻只是节点。',
    },
  },
  {
    test: /原油|OPEC|霍尔木兹|油运|VLCC|成品油|天然气/,
    thinking:
      '能源是全球通胀和运价的交汇。短端是现货、运费和风险溢价；中期是国内成品油调价、化工成本和出行需求；长期是能源结构和地缘供给。',
    tone: '利好',
    sectors: [
      { name: '油运', effect: '利好', why: '运输风险溢价会推升油运费率预期。' },
      { name: '炼化', effect: '中性', why: '油价上涨对炼厂是成本，除非出现明确的涨价传导。' },
    ],
    short: {
      effect: '利好',
      text: '油价和VLCC运价可以当天重定价。航空、化工会感到成本压力，油运则吃运价。',
    },
    medium: {
      effect: '中性',
      text: '中期看国内调价机制、下游能否提价、以及需求是否被高油价抑制。通胀预期也会影响货币政策空间。',
    },
    long: {
      effect: '不确定',
      text: '长期供给仍看OPEC+与非常规产能。地缘冲突改变风险溢价，不一定永久改变储量与成本曲线。',
    },
  },
  {
    test: /关税|贸易战|出口管制|制裁/,
    thinking:
      '贸易壁垒改的是外需价格和供应链。短端是出口企业情绪和汇率；中期是订单转移、库存和替代产能；长期是全球分工重组。',
    tone: '利空',
    sectors: [
      { name: '出口链', effect: '利空', why: '关税或管制直接压制外需和订单能见度。' },
      { name: '国产替代', effect: '中性', why: '替代叙事会被点燃，份额兑现往往慢于标题。' },
    ],
    short: {
      effect: '利空',
      text: '出口报价、接单和航运即期预期会先被打。人民币和风险资产可能同时波动。',
    },
    medium: {
      effect: '利空',
      text: '中期看关税转嫁能力、海外库存和是否改道第三国。利润率往往比销量先坏。',
    },
    long: {
      effect: '不确定',
      text: '长期是供应链迁徙。有的环节留在国内形成替代，有的产能永久外移，不能写成全面利好国产。',
    },
  },
  {
    test: /白酒|酱香|酒业|批价/,
    thinking:
      '白酒是高利润消费品，短端看场景和批价情绪，中期看宴席与商务需求，长期看人口和收入分层。联播点名不等于已经卖得更好。',
    tone: '中性',
    sectors: [{ name: '白酒', effect: '中性', why: '消费场景被提及只是关注度，不是批价或销量数据。' }],
    short: {
      effect: '中性',
      text: '主题关注度上升，批价和经销商库存才是短端真实变量。没有批价数据就不要写成需求爆发。',
    },
    medium: {
      effect: '不确定',
      text: '中期看宴席、礼品和商务消费能否从弱复苏里走出来。收入预期比口号更决定开瓶。',
    },
    long: {
      effect: '不确定',
      text: '长期由人口结构和富裕阶层消费习惯决定。单条新闻几乎不改这个慢变量。',
    },
  },
  {
    test: /就业|失业|青年就业|工资|居民收入/,
    thinking:
      '就业是消费的上游。短端对股市往往钝；中期决定可选消费和地产；长期决定潜在增长。',
    tone: '中性',
    sectors: [{ name: '可选消费', effect: '中性', why: '就业改善才会慢慢变成消费，不是当天兑现。' }],
    short: {
      effect: '中性',
      text: '就业数据很少当天改企业报表。风险资产更多是在重新评估消费韧性。',
    },
    medium: {
      effect: '不确定',
      text: '中期看青年就业、私营部门用工和工资。这才是社零、旅游、汽车的真实约束。',
    },
    long: {
      effect: '不确定',
      text: '长期劳动参与率和人力资本决定潜在增速。政策表态要落到岗位和收入才算数。',
    },
  },
]

export function clipText(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function newsBriefCacheKey(item) {
  const id = String(item?.id || '').trim()
  if (id) return `v2:${id}`.slice(0, 180)
  const title = String(item?.title || '').trim()
  const date = String(item?.event_date || '').slice(0, 10)
  return `v2:${title}|${date}`.slice(0, 180)
}

function emptyHorizon(label) {
  return { label, effect: '不确定', text: '' }
}

function emptyBrief(raw = '') {
  return {
    thinking: '',
    facts: '',
    tone: '不确定',
    sectors: [],
    short: emptyHorizon('短期'),
    medium: emptyHorizon('中期'),
    long: emptyHorizon('长期'),
    note: '',
    raw,
  }
}

function normalizeSectors(list) {
  if (!Array.isArray(list)) return []
  const out = []
  const seen = new Set()
  for (const row of list.slice(0, 4)) {
    const name = clipText(row?.name, 24)
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const effect = EFFECTS.has(row?.effect) ? row.effect : '中性'
    out.push({
      name,
      effect,
      why: clipText(row?.why, 160),
    })
  }
  return out
}

function normalizeHorizon(row, label) {
  if (typeof row === 'string') {
    return { label, effect: '中性', text: clipText(row, 360) }
  }
  if (!row || typeof row !== 'object') return emptyHorizon(label)
  const effect = EFFECTS.has(row.effect)
    ? row.effect
    : EFFECTS.has(row.tone)
      ? row.tone
      : '中性'
  const text = clipText(row.text || row.why || row.economy || row.summary || '', 360)
  return { label, effect: text ? effect : '不确定', text }
}

function extractJsonObject(text) {
  const src = String(text || '').trim()
  if (!src) return null
  const fenced = src.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced ? fenced[1] : src).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    return null
  }
}

export function parseNewsBrief(text) {
  const raw = sanitizeLlmBriefing(String(text || '').trim())
  const json = extractJsonObject(raw)
  if (!json || typeof json !== 'object') {
    return {
      ...emptyBrief(raw),
      facts: clipText(raw, 480),
      note: raw ? '未能结构化，以下为原文摘要。' : '',
    }
  }
  const nested = json.horizons && typeof json.horizons === 'object' ? json.horizons : {}
  const tone = TONES.has(json.tone) ? json.tone : '不确定'
  return {
    thinking: clipText(json.thinking || json.reason || '', 900),
    facts: clipText(json.facts || json.summary || '', 480),
    tone,
    sectors: normalizeSectors(json.sectors),
    short: normalizeHorizon(json.short || nested.short || nested['短期'], '短期'),
    medium: normalizeHorizon(json.medium || nested.medium || nested['中期'], '中期'),
    long: normalizeHorizon(json.long || nested.long || nested['长期'], '长期'),
    note: clipText(json.note, 220),
    raw,
  }
}

export function buildNewsBriefPrompt(item) {
  const holdings = (item?.related || item?.relatedHoldings || [])
    .slice(0, 6)
    .map((h) => `${h.name || h.code}${h.strength === 'strong' ? '（点名）' : '（行业）'}`)
    .filter(Boolean)
  const title = String(item?.title || '').trim() || '（无标题）'
  const lines = [
    `标题：${title}`,
    `日期：${String(item?.event_date || '').slice(0, 10) || '未知'}`,
    `来源：${item?.source_url || '无链接'}`,
    `频道：${item?.channel || item?.lane || item?.catalyst_label || ''}`,
    `已有摘要：${String(item?.description || '').trim() || '无'}`,
  ]
  if (holdings.length) {
    lines.push(`本条已对上持仓标签（仅对照，不是买入理由）：${holdings.join('、')}`)
  }
  lines.push(
    '请只输出 JSON：{"thinking":"6-10句，必须点名经济变量（需求/供给/价格/资金/财政/汇率/就业）并写出传导","facts":"3-5句事实梗概，不编数字","tone":"利好|利空|中性|不确定","short":{"effect":"利好|利空|中性|不确定","text":"短期数日到数周：资金、价格、情绪，2-4句"},"medium":{"effect":"利好|利空|中性|不确定","text":"中期一季到一年：订单、信贷、利润，2-4句，写清还缺什么数据"},"long":{"effect":"利好|利空|中性|不确定","text":"长期一年以上：结构、制度、产能，2-4句，单条新闻不够就写不确定"},"sectors":[{"name":"板块","effect":"利好|利空|中性","why":"一句因果"}],"note":"信息不足时的一句；可空"}',
  )
  lines.push('sectors 最多 3 条。不要写个股代码、不要写该买谁。短期中期长期三档都不能空。')
  return lines.join('\n')
}

function genericHorizons() {
  return {
    short: {
      effect: '不确定',
      text: '短端最多动风险偏好和舆论溢价。没有利率、价格、订单或财政数字，不宜写成当天的经济冲击。',
    },
    medium: {
      effect: '不确定',
      text: '中期要等这件事有没有变成可执行的财政、产业或外需政策。会议和表态本身进不了利润表。',
    },
    long: {
      effect: '不确定',
      text: '长期结构（人口、产业分工、制度）很少被单条联播改写。没有后续法规或资本开支，就保持不确定。',
    },
  }
}

export function localNewsBrief(item) {
  const title = String(item?.title || '').trim()
  const desc = String(item?.description || '').trim()
  const blob = `${title} ${desc}`
  const hit = RULES.find((r) => r.test.test(blob))
  const holdings = (item?.related || item?.relatedHoldings || [])
    .slice(0, 4)
    .map((h) => h.name || h.code)
    .filter(Boolean)
  const holdNote = holdings.length
    ? `本条已对上持仓标签（${holdings.join('、')}），仍不是买入理由。`
    : ''
  if (!title) {
    return {
      ...emptyBrief(''),
      thinking: '没有标题，无法判断事实边界，更无法映射到经济变量。',
      facts: '缺少可摘要的标题。',
      note: holdNote,
    }
  }
  const base = hit
    ? {
        thinking: hit.thinking,
        tone: hit.tone,
        sectors: normalizeSectors(hit.sectors),
        short: normalizeHorizon(hit.short, '短期'),
        medium: normalizeHorizon(hit.medium, '中期'),
        long: normalizeHorizon(hit.long, '长期'),
        note: clipText(holdNote || '依据标题关键词的本地经济速读；有模型时会写得更贴这条新闻。', 220),
      }
    : {
        thinking:
          '标题没有给出利率、价格、财政、订单或就业等可核验变量。人事、外事和会议报道对实体经济的传导往往是间接的：短端至多改情绪，中期要看有没有变成政策工具，长期几乎不动结构。硬写成板块狂欢会把叙事当成数据。',
        tone: '不确定',
        sectors: [],
        short: normalizeHorizon(genericHorizons().short, '短期'),
        medium: normalizeHorizon(genericHorizons().medium, '中期'),
        long: normalizeHorizon(genericHorizons().long, '长期'),
        note: clipText(holdNote || '仅标题级信息，三档时间都以不确定为主。', 220),
      }
  return {
    ...emptyBrief(''),
    ...base,
    facts: clipText(desc ? `${title}。${desc}` : title, 480),
    raw: '',
  }
}
