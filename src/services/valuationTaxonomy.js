/**
 * Buffett × Munger valuation taxonomy
 *
 * Sources distilled (not slogans):
 * - Buffett 1986: Owner Earnings; IV = discounted cash taken out over life
 * - Buffett/Munger: wonderful business at fair price > fair business at wonderful price
 * - Munger (Poor Charlie's Almanack): circle of competence, inversion, moats,
 *   lollapalooza, avoid false precision, classify before calculating
 *
 * Rule: DIFFERENT business types → DIFFERENT primary methods.
 * Never force one DCF+brand-premium onto banks, cyclicals, and biotech alike.
 */

/** @typedef {'franchise_brand'|'bank'|'insurance'|'broker'|'cyclical'|'capital_heavy'|'platform'|'biotech'|'real_estate'|'utility_infra'|'hard'} Archetype */

/**
 * Industry → archetype. First match by exact industry name.
 * Anything unmapped falls to capital_heavy or hard.
 */
export const INDUSTRY_ARCHETYPE = {
  // —— Franchise / brand (See's, Coke style): capital-light, pricing power ——
  高端白酒: 'franchise_brand',
  次高端白酒: 'franchise_brand',
  区域白酒: 'franchise_brand',
  液态奶: 'franchise_brand',
  奶粉及奶酪: 'franchise_brand',
  酱油醋: 'franchise_brand',
  复合调味品: 'franchise_brand',
  休闲食品: 'franchise_brand',
  速冻食品: 'franchise_brand',
  饮料: 'franchise_brand',
  烘焙及调味: 'franchise_brand',
  啤酒: 'franchise_brand',
  中药创新: 'franchise_brand',
  运动服饰: 'franchise_brand',
  休闲服饰: 'franchise_brand',
  家纺: 'franchise_brand',
  白电: 'franchise_brand', // 格力美的偏品牌+规模，按特许经营权更贴近芒格
  小家电: 'franchise_brand',
  厨电: 'franchise_brand',
  // 景区/酒店是客流与资本开支生意，不是 See's 式轻资产特许经营
  景区: 'cyclical',
  酒店: 'cyclical',
  免税及旅行社: 'franchise_brand', // 牌照/渠道仍偏特许
  // 百货/超市：租金与同店销售周期，不是 See's 式定价权
  百货: 'capital_heavy',
  超市便利店: 'capital_heavy',

  // —— Banks ——
  国有大行: 'bank',
  股份制银行: 'bank',
  城商行: 'bank',
  农商行: 'bank',

  // —— Insurance ——
  寿险: 'insurance',
  财险: 'insurance',
  综合保险: 'insurance',

  // —— Brokers (cyclical financial) ——
  头部券商: 'broker',
  中型券商: 'broker',
  中小券商: 'broker',

  // —— Cyclicals ——
  基础化工: 'cyclical',
  精细化工: 'cyclical',
  农化: 'cyclical',
  贵金属: 'cyclical',
  工业金属: 'cyclical',
  稀有金属: 'cyclical',
  小金属: 'cyclical',
  动力煤: 'cyclical',
  焦煤: 'cyclical',
  无烟煤及其他: 'cyclical',
  特钢: 'cyclical',
  普钢: 'cyclical',
  钢管: 'cyclical',
  航运: 'cyclical',
  客运航空: 'cyclical',
  养殖: 'cyclical',
  饲料: 'cyclical',
  种植: 'cyclical',
  消费电子: 'platform',
  水泥: 'cyclical',
  玻璃: 'cyclical',
  传统车企: 'cyclical',
  商用车: 'cyclical',

  // —— Capital heavy manufacturers ——
  工程机械: 'capital_heavy',
  通用设备: 'capital_heavy',
  专用设备: 'capital_heavy',
  动力系统: 'capital_heavy',
  底盘系统: 'capital_heavy',
  汽车电子: 'capital_heavy',
  车身内外饰: 'capital_heavy',
  动力电池: 'capital_heavy',
  电池材料: 'capital_heavy',
  电池片: 'capital_heavy',
  组件: 'capital_heavy',
  硅片: 'capital_heavy',
  逆变器储能: 'capital_heavy',
  新能源车企: 'capital_heavy',
  低值耗材: 'capital_heavy',
  通信设备: 'capital_heavy',
  封测: 'capital_heavy',
  晶圆制造: 'capital_heavy',

  // —— Platforms (circle of competence often "hard") ——
  电商: 'platform',
  社交内容: 'platform',
  游戏: 'platform',
  SaaS云计算: 'platform',
  本地生活: 'platform',
  电商零售: 'platform',
  影视: 'platform',
  广告营销: 'platform',
  芯片设计: 'capital_heavy', // 设计公司常资本/周期属性强于纯平台
  面板: 'cyclical',
  安防: 'capital_heavy',
  医疗服务: 'franchise_brand',
  眼科医疗: 'franchise_brand',
  互联网券商: 'broker',
  证券: 'broker',
  证券业务: 'broker',

  // —— Biotech / pharma / CXO（机会留给有准备的人：必须单独训练）——
  化学创新药: 'biotech',
  生物创新药: 'biotech',
  CXO服务: 'biotech',
  疫苗: 'biotech',
  血液制品: 'biotech',
  高值耗材: 'franchise_brand',
  体外诊断: 'franchise_brand',
  医疗设备: 'franchise_brand',
  低值耗材: 'capital_heavy',
  半导体设备: 'capital_heavy',
  半导体材料: 'capital_heavy',

  // —— Real estate ——
  住宅开发: 'real_estate',
  商业地产: 'real_estate',
  产业地产: 'real_estate',
  物业管理: 'real_estate',

  // —— Utilities / infra ——
  火电: 'utility_infra',
  水电: 'utility_infra',
  核电: 'utility_infra',
  新能源发电: 'utility_infra',
  运营商: 'utility_infra',
  港口: 'utility_infra',
  港口服务: 'utility_infra',
  燃气: 'utility_infra',
  水务及其他: 'utility_infra',
  固废处理: 'utility_infra',
  水处理: 'utility_infra',
  快递: 'utility_infra',
  仓储物流: 'utility_infra',
  基建: 'capital_heavy', // 建筑央企：订单周期+垫资，非公用稳定现金流
  房建: 'capital_heavy',
  专业工程: 'capital_heavy',
}

export const ARCHETYPE_META = {
  franchise_brand: {
    label: '特许经营权/品牌',
    method: 'Owner Earnings × 保守合理PE',
    buffett: '资本轻、可预见现金流；wonderful at fair price',
    munger: '宽护城河优先；宁可贵一点买伟大企业',
    mosBuyMin: 20, // 特许经营仍要 20%+：好生意≠免安全边际
    competenceDefault: 'easy',
    inputs: ['EPS/所有者盈余', '毛利率/净利率', 'ROE', '行业PE带'],
    assumptions: ['护城河可持续', '现金转化接近报表利润', '不做品牌溢价自动加成'],
    failureModes: ['渠道/品牌力崩塌', '提价权丧失', '用叙事PE替代现金'],
    doesNotDo: ['不做永续高增DCF', '不加品牌叙事溢价', '不把峰值利润当常态'],
  },
  bank: {
    label: '银行',
    method: 'PB-ROE / 常态化年化ROE',
    buffett: '看常态化盈利与资产质量；金融要求更大折扣',
    munger: '不透明→更大安全边际；能力圈谨慎',
    mosBuyMin: 18,
    competenceDefault: 'moderate',
    inputs: ['PB', 'ROE（或EPS/BVPS年化）', '账面净资产'],
    assumptions: ['常态化ROE可辩护', '资产质量无系统性恶化', '杠杆属行业结构'],
    failureModes: ['信用周期坏账', '净息差长期压缩', '缺PB时退化为粗糙PE'],
    doesNotDo: ['不用成长DCF估银行', '不把破净自动当低估', '不忽略资本约束'],
  },
  insurance: {
    label: '保险',
    method: 'P/EV代理（账面×ROE封顶）折扣',
    buffett: '浮存金+承保纪律；忌精算/投资收益幻觉',
    munger: '复杂→要求折扣；逆向：准备金不足会毁公司',
    mosBuyMin: 22,
    competenceDefault: 'moderate',
    inputs: ['PB/账面', 'ROE（投资波动封顶）', '行业折扣假设'],
    assumptions: ['EV代理可用账面近似', '承保纪律大致稳定', '投资收益不可外推峰值'],
    failureModes: ['准备金不足', '投资端巨亏', '把投资收益当承保利润'],
    doesNotDo: ['不做精算级EV重估', '不把浮存金当无风险收益', '不输出假精确内含价值'],
  },
  broker: {
    label: '券商',
    method: '周期PB中枢（牛市去泡沫）',
    buffett: '强周期金融，按中枢而非高峰',
    munger: '牛市幻觉是误判心理学经典',
    mosBuyMin: 28,
    competenceDefault: 'moderate',
    inputs: ['PB', '中周期ROE', '成交额周期位置（启发式）'],
    assumptions: ['经纪/自营弹性回归中枢', '牛市PB不可外推', '杠杆属结构而非护城河'],
    failureModes: ['成交额中枢下移', '监管收紧', '用牛市利润估永续'],
    doesNotDo: ['不用高峰ROE估公允PB', '不做投行流水成长故事IV', '不把弹性当护城河'],
  },
  cyclical: {
    label: '强周期',
    method: '中枢盈利×低PE（景气顶禁外推）',
    buffett: '用中周期盈利，不在景气顶用高增长DCF',
    munger: '逆向：景气顶点买入=毁灭本金的快速路径',
    mosBuyMin: 28,
    competenceDefault: 'moderate',
    inputs: ['EPS/利润增速', '中枢盈利假设', '低PE带'],
    assumptions: ['盈利均值回归', '景气顶禁止高增外推', '产能/价格可逆'],
    failureModes: ['峰值盈利当永续', '产能过剩价格战', '商品价格均值回归'],
    doesNotDo: ['不做景气顶高增DCF', '不用谷底PE伪装便宜', '不把周期弹性当护城河'],
  },
  capital_heavy: {
    label: '资本密集制造',
    method: 'Owner Earnings折损EPS后×PE带',
    buffett: '维保资本开支常>折旧，报表利润高估现金',
    munger: '护城河常窄；需要更大折扣',
    mosBuyMin: 25,
    competenceDefault: 'moderate',
    inputs: ['EPS', 'OCF/Capex或FCF', '行业PE带', '负债率'],
    assumptions: ['维保资本开支常侵蚀利润', '报表利润需折损后才可估', '护城河通常有限'],
    failureModes: ['资本开支吞噬现金', '技术路线切换资产搁浅', '客户集中'],
    doesNotDo: ['不把折旧当充足维保', '不加产能叙事溢价', '不忽略高杠杆误判放大'],
  },
  platform: {
    label: '平台/互联网',
    method: '盈利平台保守PE；亏损默认能力圈外',
    buffett: '能理解的消费/网络属性才下手；无自由现金不估',
    munger: '复杂平台默认难；有稳定利润可进能力圈边缘',
    mosBuyMin: 28,
    competenceDefault: 'moderate',
    inputs: ['EPS/PE', '利润率（若有）', '用户/取率线索（启发式）'],
    assumptions: ['正利润才进入可估边缘', '亏损默认能力圈外', '网络效应可能反转'],
    failureModes: ['监管与反垄断', '用户迁移', '烧钱无利润'],
    doesNotDo: ['不对亏损平台给精确IV', '不用GMV故事替代利润', '不加用户叙事溢价'],
  },
  biotech: {
    label: '生物医药',
    method: '分层：管线hard / 盈利创新药保守PE / CXO折现PE',
    buffett: '看可理解的自由现金；管线故事不当永续',
    munger: '临床失败率极高；逆向先想归零与医保砍价',
    mosBuyMin: 32,
    competenceDefault: 'hard',
    inputs: ['EPS/PE（若盈利）', '行业分层（管线/CXO/创新药）', '订单/管线可见度线索'],
    assumptions: ['管线叙事默认hard', '盈利CXO可边缘理解', '临床失败与砍价为常态风险'],
    failureModes: ['管线临床失败', '医保谈判砍价', '融资枯竭'],
    doesNotDo: ['不做管线概率精确rNPV定价', '不把峰值管线价值当基线', '不对叙事阶段输出假精度IV'],
  },
  real_estate: {
    label: '地产',
    method: '压力NAV/PB（亏损账面≠便宜）',
    buffett: '资产变现与去化，不是成长故事',
    munger: '杠杆与政策是误判放大器；破净常是价值陷阱',
    mosBuyMin: 30,
    competenceDefault: 'moderate',
    inputs: ['PB/账面', '盈亏状态', '压力NAV折扣假设'],
    assumptions: ['账面需压力折扣', '亏损破净≠便宜', '去化与融资约束关键'],
    failureModes: ['去化失灵', '政策与融资收紧', 'NAV高估'],
    doesNotDo: ['不把破净当烟蒂机会', '不做房价上涨永续外推', '不忽略杠杆清算风险'],
  },
  utility_infra: {
    label: '公用/基建/稳定现金流',
    method: '稳定DCF + 股息锚定',
    buffett: '可预测性优先于增速',
    munger: '无聊常是优点',
    mosBuyMin: 20,
    competenceDefault: 'easy',
    inputs: ['稳定OE/EPS', '贴现假设', '股息/费率线索'],
    assumptions: ['现金流可预测优先于增速', '监管收益率大致约束估值', '利率敏感'],
    failureModes: ['电价/费率管制不利', '利率上行压制估值', '长期合同重置'],
    doesNotDo: ['不做高增成长故事', '不加基建叙事溢价', '不把管制资产当自由定价权'],
  },
  hard: {
    label: '太难理解',
    method: '不给精确IV，只给风险提示',
    buffett: '能力圈外不做',
    munger: '知道边界比扩大边界更重要',
    mosBuyMin: 99,
    competenceDefault: 'hard',
    inputs: ['能力圈判定', '稀疏/异常数据信号'],
    assumptions: ['未知未知占主导', '假精度比沉默更危险'],
    failureModes: ['强行精算幻觉', '叙事填补数据空洞'],
    doesNotDo: ['不输出戏剧性目标价', '不伪装成可计算主锚', '不把复杂度包装成深度'],
  },
}

export function getArchetype(industry, name = '') {
  const mapped = INDUSTRY_ARCHETYPE[industry]
  if (mapped) return mapped
  const n = String(name || '')
  if (/药明|康龙|泰格|凯莱英|昭衍|美迪西|生物科技|创新药|制药|生物-B|疫苗|血液制品|君实|百济|信达|康方|诺诚|康诺亚|金斯瑞/.test(n)) {
    return 'biotech'
  }
  if (/腾讯|阿里|美团|京东|快手|拼多多|网易|百度|小米集团/.test(n)) return 'platform'
  if (/地产|万科|保利|招商蛇口|金地|华侨城|华夏幸福|新城控股|碧桂园|世茂/.test(n)) return 'real_estate'
  if (/煤业|煤炭|焦煤|焦炭|铁矿|钢铁|有色|矿业|油气|航运|航空/.test(n)) return 'cyclical'
  return 'capital_heavy'
}

/**
 * Structured moat checklist (0/1/2 each). Evidence-based, not narrative.
 * Dimensions: pricingPower, switchingCost, network, costAdvantage, license
 */
export function assessMoat(fin, archetype, name = '') {
  const gm = +(fin.grossMargin || 0)
  const nm = +(fin.netMargin || 0)
  const roe = +(fin.roe || 0)
  const debt = +(fin.debtRatio || 0)
  const n = String(name || '')
  const dims = {
    pricingPower: 0,
    switchingCost: 0,
    network: 0,
    costAdvantage: 0,
    license: 0,
  }
  const evidence = []

  if (gm >= 55) {
    dims.pricingPower = 2
    evidence.push('毛利率≥55%→定价权信号')
  } else if (gm >= 35) {
    dims.pricingPower = 1
    evidence.push('毛利率≥35%')
  }

  if (archetype === 'platform' || /腾讯|阿里|美团|京东|拼多多|网易/.test(n)) {
    dims.network = 2
    evidence.push('平台网络效应')
  } else if (archetype === 'franchise_brand') {
    dims.pricingPower = Math.max(dims.pricingPower, 2)
    dims.switchingCost = Math.max(dims.switchingCost, 1)
    evidence.push('品牌特许')
  }

  if (archetype === 'bank' || archetype === 'insurance' || archetype === 'utility_infra') {
    dims.license = 2
    evidence.push('牌照/特许经营')
  }
  if (archetype === 'biotech' && /药明|康龙|泰格|CXO/.test(n + (fin.industry || ''))) {
    dims.switchingCost = 1
    evidence.push('CXO客户粘性')
  }

  if (roe >= 15 && debt < 50 && archetype !== 'bank' && archetype !== 'insurance') {
    dims.costAdvantage = Math.max(dims.costAdvantage, 1)
    evidence.push('高ROE低负债→效率优势')
  }
  if (nm >= 20 && gm >= 40) {
    dims.pricingPower = Math.max(dims.pricingPower, 2)
  }

  // Sparse HK: do not invent moat from empty margins
  const sparse = !(gm > 0) && !(nm > 0) && archetype === 'platform'
  if (sparse) {
    evidence.push('缺利润率：护城河仅按商业模式先验')
  }

  const score = Object.values(dims).reduce((a, b) => a + b, 0)
  return { dims, score, evidence, sparse }
}

/**
 * Moat / quality heuristic from available fundamentals.
 * Munger: durable competitive advantage first; price second.
 */
export function assessQuality(fin, archetype, name = '') {
  let roe = +(fin.roe || 0)
  // Banks/insurers often store quarterly ROE in our dataset — annualize via EPS/BVPS
  if ((archetype === 'bank' || archetype === 'insurance' || archetype === 'broker') && fin.bvps > 0 && fin.eps > 0) {
    const implied = (fin.eps / fin.bvps) * 100
    if (roe > 0 && roe < 6 && implied > roe * 1.5) roe = implied
    else if (!(roe > 0)) roe = implied
  }

  // Insurers: EPS/BVPS often inflated by investment gains — cap for quality scoring
  let insurerRoeCapped = false
  if (archetype === 'insurance' && roe > 18) {
    insurerRoeCapped = true
    roe = 18
  }

  const gm = +(fin.grossMargin || 0)
  const nm = +(fin.netMargin || 0)
  const debt = +(fin.debtRatio || 0)
  const g = +(fin.profitGrowth || 0)
  const sparseBooks = !(+(fin.bvps || 0) > 0) && !(+(fin.pb || 0) > 0)
  const moat = assessMoat(fin, archetype, name)

  let score = 0
  const notes = []
  if (insurerRoeCapped) notes.push('报表ROE含投资波动，质量评分用18%封顶')
  if (moat.evidence.length) notes.push(...moat.evidence.slice(0, 2))

  // Round so EPS/BVPS annualization (e.g. 9.99%) doesn't miss 10% bands
  const roeR = Math.round(roe * 10) / 10
  if (roeR >= 15) {
    score += 3
    notes.push('高ROE')
  } else if (roeR >= 10) {
    score += 2
    notes.push('体面ROE')
  } else if (roeR >= 6) {
    score += 1
  } else if (roeR > 0) {
    notes.push('ROE偏弱')
  }

  // Moat bonus (capped)
  if (moat.score >= 6) score += 2
  else if (moat.score >= 3) score += 1

  if (archetype === 'bank' || archetype === 'insurance') {
    // Leverage is structural — do not punish 90% debt ratio
    if (roeR >= 10) score += 1
    if (+(fin.pb || 0) > 0 && fin.pb < 0.7) notes.push('破净/折价交易')
  } else if (archetype === 'broker') {
    // Broker leverage is structural; quality from mid-cycle ROE only
    if (roeR >= 10) score += 1
    else if (roeR >= 7) score += 0
    if (+(fin.pb || 0) > 0 && fin.pb < 1.0) notes.push('PB偏低(需辨周期)')
  } else if (archetype === 'real_estate') {
    // Developer leverage is structural — punish losses/ROE collapse, not debt alone
    if (roeR >= 8) score += 1
    if (roeR < 0 || +(fin.eps || 0) < 0) {
      score -= 2
      notes.push('亏损/负ROE：账面折价常是陷阱')
    }
    if (+(fin.pb || 0) > 0 && fin.pb < 0.4) notes.push('深度破净(需辨去化)')
  } else {
    if (gm >= 50) {
      score += 2
      notes.push('厚毛利(定价权信号)')
    } else if (gm >= 30) score += 1
    if (nm >= 20) score += 1
    if (debt > 70) {
      score -= 2
      notes.push('高负债(逆向风险)')
    }
  }

  const ocf = +(fin.ocf || 0)
  const profitYi = +(fin.profit || 0)
  if (profitYi > 0.05 && ocf) {
    const conv = ocf / profitYi
    if (conv >= 0.9) {
      score += 1
      notes.push(`现金转化${conv.toFixed(2)}（>0.9）`)
    } else if (conv < 0.5) {
      score -= 1
      notes.push(`现金转化${conv.toFixed(2)}（报表利润含金量弱）`)
    }
  }

  if (g < -20 && archetype !== 'cyclical' && archetype !== 'broker') {
    score -= 1
    notes.push('利润大幅下滑')
  }
  // Peak cyclical earnings: block wonderful
  const peakCycle = archetype === 'cyclical' && g >= 40

  if (archetype === 'franchise_brand') score += 1
  if (archetype === 'cyclical' || archetype === 'broker') score -= 1
  if (archetype === 'biotech') score -= 1
  if (archetype === 'platform') {
    score -= 1
    // Sparse HK fundamentals: positive earnings still count as a quality signal
    if (+(fin.eps || 0) > 0 && +(fin.pe_ttm || 0) > 0) {
      score += 3
      notes.push('正利润平台(能力圈边缘)')
    }
  }

  // Buffett: able & honest management — scored from F10 when present
  const mgmt = +(fin.managementScore || 0)
  if (mgmt >= 3) {
    score += 1
    notes.push('管理层评估稳健偏强')
  } else if (mgmt <= -2) {
    score -= 1
    notes.push('管理层信号需警惕（减持等）')
  }
  if (Array.isArray(fin.managementNotes) && fin.managementNotes.length) {
    notes.push(...fin.managementNotes.slice(0, 2))
  }

  let quality = 'fair'
  // wonderful: moat threshold + not peak cycle + not sparse books for financials
  const finLike =
    archetype === 'bank' ||
    archetype === 'insurance' ||
    archetype === 'broker' ||
    archetype === 'real_estate'
  const canWonderful =
    score >= 6 &&
    moat.score >= 3 &&
    !peakCycle &&
    !(finLike && sparseBooks) &&
    !(archetype === 'biotech' && score < 7)

  if (canWonderful) quality = 'wonderful'
  else if (score >= 6 && (peakCycle || (finLike && sparseBooks))) {
    quality = 'good'
    notes.push('未达wonderful：周期顶利或账面稀疏')
  } else if (score >= 4) quality = 'good'
  else if (score <= 1) quality = 'cigar'

  return {
    score,
    quality,
    notes,
    roeUsed: Math.round(roe * 100) / 100,
    moat: { score: moat.score, dims: moat.dims, evidence: moat.evidence },
  }
}

/** Inversion: what kills this thesis? (Munger: invert, always invert) */
export function invertRisks(archetype, fin, industry) {
  const risks = []
  const map = {
    franchise_brand: ['品牌力被侵蚀/渠道塌陷', '提价能力丧失', '管理层稀释护城河换短期利润'],
    bank: ['信用周期恶化与坏账', '净息差长期压缩', '监管资本要求上升'],
    insurance: ['准备金计提不足', '投资端大幅亏损', '承保纪律放松'],
    broker: ['成交额中枢下移', '杠杆交易监管收紧', '牛市估值幻觉破裂'],
    cyclical: ['在景气高峰外推永续高盈利', '产能过剩价格战', '商品价格均值回归'],
    capital_heavy: ['维保资本开支吃掉账面利润', '技术路线切换导致资产搁浅', '客户集中'],
    platform: ['监管与反垄断', '用户迁移/网络效应反转', '竞争烧钱无利润'],
    biotech: ['管线临床失败', '医保谈判砍价', '融资枯竭'],
    real_estate: ['去化与资产负债表风险', '政策与融资收紧', 'NAV高估'],
    utility_infra: ['电价/费率管制', '利率上行压制估值', '长期合同重置不利'],
    hard: ['超出能力圈的未知未知'],
  }
  risks.push(...(map[archetype] || map.hard))
  if (
    +(fin.debtRatio || 0) > 70 &&
    archetype !== 'bank' &&
    archetype !== 'insurance' &&
    archetype !== 'broker' &&
    archetype !== 'real_estate'
  ) {
    risks.unshift('资产负债率过高放大误判')
  }
  if (+(fin.pe_ttm || 0) > 60) risks.unshift('极高PE：增长叙事一旦失真损失巨大')
  return risks.slice(0, 4)
}
