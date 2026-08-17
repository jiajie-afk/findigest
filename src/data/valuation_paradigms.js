/**
 * FinDigest valuation paradigm catalog (~100 thinking frameworks).
 * UI / briefing knowledge base. Compute maps paradigms with engineHint onto ~11 archetypes
 * via paradigmResolver + valuation bands — not 100 separate IV engines.
 *
 * Each entry: id, name (zh), family, desc, when (when-to-use), engineHint (optional INDUSTRY_MODELS.model match).
 */
export const VALUATION_PARADIGMS = [
  // ── Multiples / classic ──────────────────────────────────────────────
  { id: 'pe-ttm', name: 'PE(TTM) 倍数', family: 'multiples', desc: '用过去十二个月每股收益对照合理市盈率带。', when: '盈利稳定、一次性损益少的成熟企业。', engineHint: 'PE+ROE估值' },
  { id: 'pe-forward', name: '前瞻 PE', family: 'multiples', desc: '用一致预期 FY1/FY2 EPS 估公允价。', when: '分析师覆盖充分、业绩可预测时。', engineHint: 'PE+PS估值' },
  { id: 'pe-normalized', name: '常态化 PE', family: 'multiples', desc: '剔除非经常损益后的常态 EPS 再乘合理倍数。', when: '有大额一次性收益/减值的年份。' },
  { id: 'pb-simple', name: '简单 PB', family: 'multiples', desc: '市净率对照历史与同业分位。', when: '资产驱动、盈利波动大但账面相对可信。', engineHint: 'PE+ROE估值' },
  { id: 'ps-growth', name: 'PS 成长倍数', family: 'multiples', desc: '用营收倍数给尚在爬坡的业务定区间。', when: '早期成长、利润尚未稳定为正。', engineHint: 'PE+PS估值' },
  { id: 'ev-ebitda', name: 'EV/EBITDA', family: 'multiples', desc: '企业价值对息税折旧摊销前利润。', when: '资本结构差异大、折旧政策不一的同业比较。', engineHint: 'EV/EBITDA+件量' },
  { id: 'ev-sales', name: 'EV/Sales', family: 'multiples', desc: '企业价值对营收，弱化短期利润噪音。', when: '规模优先、利润率仍在扩张的平台或制造。' },
  { id: 'ev-ebit', name: 'EV/EBIT', family: 'multiples', desc: '企业价值对营业利润，强调经营杠杆。', when: '折旧合理、关注经营利润质量时。' },
  { id: 'peg', name: 'PEG 增速校正', family: 'multiples', desc: 'PE 相对盈利增速的粗校正。', when: '成长股初筛，不作最终定价。' },
  { id: 'dividend-yield', name: '股息率锚', family: 'multiples', desc: '以可持续股息率反推合理价。', when: '高分红、派息政策稳定的现金牛。' },
  { id: 'fcf-yield', name: '自由现金流收益率', family: 'multiples', desc: 'FCF/市值作为反向收益锚。', when: '资本开支可预期、FCF 质量高。' },
  { id: 'owner-earnings-yield', name: '所有者盈余收益率', family: 'multiples', desc: '巴菲特式所有者盈余相对市值。', when: '维护性资本开支可估计的优质企业。' },

  // ── DCF family ───────────────────────────────────────────────────────
  { id: 'dcf-2stage', name: '两阶段 DCF', family: 'dcf', desc: '高增期 + 永续期贴现自由现金流/盈余。', when: '增速可分阶段刻画、贴现率可辩护。', engineHint: 'DCF+稳定现金流' },
  { id: 'dcf-3stage', name: '三阶段 DCF', family: 'dcf', desc: '爆发→过渡→永续三段增长路径。', when: '高增长向成熟过渡的企业。' },
  { id: 'dcf-conservative', name: '保守 DCF', family: 'dcf', desc: '增速打折、永续封顶、无叙事溢价。', when: 'FinDigest 默认安全边际口径。', engineHint: 'DCF+稳定现金流' },
  { id: 'dcf-brand', name: '品牌护城河 DCF', family: 'dcf', desc: '在稳健现金流上识别品牌定价权，但不自动加溢价。', when: '白酒、调味品、运动服饰等特许经营。', engineHint: 'DCF+品牌溢价' },
  { id: 'dcf-user', name: '用户价值 DCF', family: 'dcf', desc: '订阅/活跃用户经济转化为现金流路径。', when: '电商、社交、游戏、SaaS。', engineHint: 'DCF+用户价值' },
  { id: 'dcf-capacity', name: '产能扩张 DCF', family: 'dcf', desc: '产能利用率与投产节奏驱动现金流。', when: '制造、新能源、设备与整车。', engineHint: 'DCF+产能' },
  { id: 'dcf-cycle', name: '周期位置 DCF', family: 'dcf', desc: '按周期位置对盈利与终值折扣。', when: '化工、有色、煤炭、航运、养殖。', engineHint: 'DCF+周期调整' },
  { id: 'dcf-pipeline-orders', name: '订单管线 DCF', family: 'dcf', desc: '在手订单/合同负债支撑收入可见度。', when: '半导体设备、工程机械、部分军工。', engineHint: 'DCF+订单管线' },
  { id: 'dcf-pipeline-rx', name: '管线价值 DCF', family: 'dcf', desc: '已上市产品现金流 + 管线概率加权。', when: '高值耗材、IVD、CXO 订单可见时。', engineHint: 'DCF+管线' },
  { id: 'dcf-utility', name: '公用事业 DCF', family: 'dcf', desc: '稳定分红与监管收益率约束下的贴现。', when: '水电、核电、燃气、水务。', engineHint: 'DCF+稳定现金流' },
  { id: 'apv', name: '调整现值 APV', family: 'dcf', desc: '无杠杆价值 + 税盾/财务副作用分开估。', when: '杠杆结构将显著变化的并购或重组。' },
  { id: 'epv', name: '盈利能力价值 EPV', family: 'dcf', desc: '零增长假设下的当前盈利资本化。', when: '成熟企业，检验增长是否被高估。' },

  // ── Quality / franchise ──────────────────────────────────────────────
  { id: 'roe-moat', name: '高 ROE 护城河', family: 'quality', desc: '持续高 ROE + 再投资回报决定溢价资格。', when: '消费品牌、部分软件与龙头制造。' },
  { id: 'roic-spread', name: 'ROIC-WACC 利差', family: 'quality', desc: '投入资本回报相对资本成本的利差。', when: '资本配置纪律清晰的企业。' },
  { id: 'franchise-buffett', name: '特许经营权', family: 'quality', desc: '定价权、转换成本与可理解商业模式。', when: '芒格式「好生意」优先于便宜货。', engineHint: 'DCF+品牌溢价' },
  { id: 'gross-margin-stability', name: '毛利率稳定性', family: 'quality', desc: '毛利率波动幅度作护城河代理。', when: '品牌消费、差异化制造。' },
  { id: 'cash-conversion', name: '利润现金转化', family: 'quality', desc: '经营现金流相对净利润的转化质量。', when: '怀疑应计利润虚增时。' },
  { id: 'capital-light', name: '轻资产复利', family: 'quality', desc: '低再投资需求下的股东盈余复利。', when: '平台、品牌授权、部分软件。' },
  { id: 'capital-heavy-disc', name: '重资产折价', family: 'quality', desc: '高维护性 capex 要求更大安全边际。', when: '钢铁、航运、部分化工与地产链。' },
  { id: 'management-quality', name: '管理层质量加权', family: 'quality', desc: '资本配置与诚信进入估值门槛，而非加点。', when: '价值路径与管理层洞察联动。' },

  // ── Cyclical ─────────────────────────────────────────────────────────
  { id: 'mid-cycle-earnings', name: '中周期盈利', family: 'cyclical', desc: '用中周期常态盈利替代峰值 EPS。', when: '强周期品顶部/底部易误杀。', engineHint: 'DCF+周期调整' },
  { id: 'replacement-cost', name: '重置成本', family: 'cyclical', desc: '产能重置成本相对企业价值。', when: '供给出清后的周期底部。' },
  { id: 'inventory-cycle', name: '库存周期', family: 'cyclical', desc: '库存/销售与价格联动判断周期位置。', when: '有色、化工、半导体存储。' },
  { id: 'commodity-spread', name: '价差/吨毛利', family: 'cyclical', desc: '加工价差或吨毛利驱动盈利弹性。', when: '炼化、钢厂、锂电材料。' },
  { id: 'capacity-utilization', name: '产能利用率锚', family: 'cyclical', desc: '利用率决定利润率与资本开支拐点。', when: '制造与周期交叉行业。', engineHint: 'DCF+产能' },
  { id: 'trough-pe', name: '谷底 PE', family: 'cyclical', desc: '用谷底盈利估「看起来贵」的合理区间。', when: '周期底部盈利塌陷年份。' },
  { id: 'peak-pe-reject', name: '峰值 PE 拒绝', family: 'cyclical', desc: '拒绝用峰值盈利乘历史高倍。', when: '景气高潮叙事盛行时。' },

  // ── Bank / insurance / broker ────────────────────────────────────────
  { id: 'pb-roe-bank', name: '银行 PB-ROE', family: 'bank', desc: 'ROE 与合理 PB 联动，辅以分红贴现。', when: '国有大行与股份行稳态估值。', engineHint: 'PE+ROE估值' },
  { id: 'bank-nim', name: '净息差情景', family: 'bank', desc: 'NIM 与不良生成情景驱动盈利路径。', when: '利率与资产质量拐点期。' },
  { id: 'bank-ddm', name: '银行 DDM', family: 'bank', desc: '可持续分红贴现，强调资本充足约束。', when: '高分红银行。', engineHint: 'PE+ROE估值' },
  { id: 'bank-cet1', name: '核心一级资本约束', family: 'bank', desc: 'CET1 缓冲决定分红与扩张上限。', when: '资本承压或扩张激进的银行。' },
  { id: 'npl-stress', name: '不良压力测试', family: 'bank', desc: '不良生成与拨备覆盖下的账面折价。', when: '信用周期下行。' },
  { id: 'pev-life', name: '寿险 PEV', family: 'insurance', desc: '内含价值倍数估长期寿险价值。', when: '寿险公司。', engineHint: 'PEV内含价值' },
  { id: 'nbv-margin', name: '新业务价值率', family: 'insurance', desc: 'NBV margin 与销量驱动寿险成长。', when: '代理人/银保渠道转型期。' },
  { id: 'pnc-combined', name: '财险综合成本率', family: 'insurance', desc: '承保利润 + 投资收益拆解。', when: '财险与综合保险。', engineHint: 'PE+ROE估值' },
  { id: 'insurance-sotp', name: '保险 SOTP', family: 'insurance', desc: '寿险 EV + 财险 + 投资分部加总。', when: '综合保险集团。', engineHint: 'SOTP分部估值' },
  { id: 'broker-pb', name: '券商 PB 周期', family: 'broker', desc: '经纪/自营/投行弹性下的 PB 带。', when: '头部与中小券商。', engineHint: 'PE+ROE估值' },
  { id: 'broker-aum', name: '资管规模倍数', family: 'broker', desc: '资管与财富管理 AUM 贡献估值。', when: '财富管理转型券商。' },

  // ── Real estate / NAV ────────────────────────────────────────────────
  { id: 'nav-dev', name: '开发商 NAV', family: 'real_estate', desc: '项目净值加总减净负债。', when: '住宅与产业地产开发。', engineHint: 'NAV净资产价值' },
  { id: 'rnaav', name: '重估净资产 RNAV', family: 'real_estate', desc: '按市价重估物业后的净资产。', when: '商业地产与物管相关。', engineHint: 'NAV净资产价值' },
  { id: 'cap-rate', name: '资本化率', family: 'real_estate', desc: '净营运收入 / cap rate 估物业。', when: '收租型商业地产。' },
  { id: 'landbank', name: '土储质量折价', family: 'real_estate', desc: '土储区位与去化速度决定 NAV 折扣。', when: '高杠杆开发商。' },
  { id: 'property-mgmt-dcf', name: '物管现金流', family: 'real_estate', desc: '在管面积与续约率驱动稳定现金流。', when: '物业管理。', engineHint: 'DCF+稳定现金流' },

  // ── Biotech / healthcare ─────────────────────────────────────────────
  { id: 'rnpv', name: 'rNPV 管线', family: 'biotech', desc: '各阶段成功率折扣后的净现值。', when: '创新药与生物药管线公司。', engineHint: 'rNPV管线价值' },
  { id: 'peak-sales', name: '峰值销售倍数', family: 'biotech', desc: '峰值销售额 × 特许权/成功概率。', when: '管线早期粗筛。' },
  { id: 'cxo-backlog', name: 'CXO 订单簿', family: 'biotech', desc: '在手订单与产能利用率估成长。', when: 'CRO/CDMO。', engineHint: 'DCF+管线' },
  { id: 'device-hospital', name: '器械入院渗透', family: 'biotech', desc: '入院进度与集采价格带。', when: '高值耗材与医疗设备。' },
  { id: 'ivd-volume', name: 'IVD 检测量', family: 'biotech', desc: '检测量 × 单测价格与试剂耗。', when: '体外诊断。' },

  // ── Platform / HK / ADR ──────────────────────────────────────────────
  { id: 'platform-gm', name: '平台毛利取率', family: 'platform', desc: 'GMV × take rate × 费用率路径。', when: '电商与本地生活。', engineHint: 'DCF+用户价值' },
  { id: 'ltv-cac', name: 'LTV/CAC', family: 'platform', desc: '用户终身价值相对获客成本。', when: '订阅与互联网消费。' },
  { id: 'mau-arpu', name: 'MAU×ARPU', family: 'platform', desc: '活跃用户与变现效率。', when: '社交、内容、游戏。' },
  { id: 'saas-arr', name: 'SaaS ARR 倍数', family: 'platform', desc: '经常性收入增长与留存。', when: '云计算与企业软件。', engineHint: 'DCF+用户价值' },
  { id: 'rule-of-40', name: 'Rule of 40', family: 'platform', desc: '增速 + 利润率合计门槛。', when: 'SaaS 成长质量初筛。' },
  { id: 'hk-adr-parity', name: '港股–ADR 平价', family: 'hk_adr', desc: '同一公司港股与 ADR 折溢价套利框架。', when: '阿里、中概回流等双上市。' },
  { id: 'ah-premium', name: 'A/H 溢价', family: 'hk_adr', desc: 'A 股相对 H 股溢价分位。', when: 'AH 两地上市标的。' },
  { id: 'hk-liquidity-disc', name: '港股流动性折价', family: 'hk_adr', desc: '成交清淡时要求更大安全边际。', when: '小盘港股与南向偏好之外的标的。' },
  { id: 'connect-flow', name: '互联互通资金', family: 'hk_adr', desc: '南向/北向持仓变化作情绪辅证。', when: '不是定价主锚，只作催化。' },
  { id: 'usd-cnh-fx', name: '汇率换算锚', family: 'hk_adr', desc: '美元 ADR 与港币报价换算一致性。', when: '跨国上市比较。' },

  // ── Semiconductors / tech manufacturing ──────────────────────────────
  { id: 'semi-ps', name: '半导体 PS/PE', family: 'semi', desc: '设计/代工/封测分层倍数。', when: '芯片设计、晶圆、封测。', engineHint: 'PE+PS估值' },
  { id: 'semi-book-to-bill', name: '订单出货比', family: 'semi', desc: 'book-to-bill 判断设备景气。', when: '半导体设备。', engineHint: 'DCF+订单管线' },
  { id: 'wafer-asp', name: '晶圆 ASP 周期', family: 'semi', desc: 'ASP 与稼动率驱动代工盈利。', when: '晶圆制造。' },
  { id: 'auto-content', name: '单车价值量', family: 'semi', desc: '电动智能化单车电子价值量。', when: '汽车电子与零部件。', engineHint: 'EV/EBITDA+件量' },
  { id: 'unit-volume', name: '件量×单件毛利', family: 'semi', desc: '出货件量驱动 EV/EBITDA。', when: '快递、汽车件、部分制造。', engineHint: 'EV/EBITDA+件量' },

  // ── Energy / utilities / infra ───────────────────────────────────────
  { id: 'power-tariff', name: '电价/利用小时', family: 'utility', desc: '电价机制与利用小时决定现金流。', when: '火电、水电、新能源运营。', engineHint: 'DCF+稳定现金流' },
  { id: 'regulated-roe', name: '监管 ROE', family: 'utility', desc: '准许收益率约束下的合理市值。', when: '管网、水务、部分燃气。' },
  { id: 'toll-road-dcf', name: '收费权 DCF', family: 'utility', desc: '车流量与收费年限贴现。', when: '交运基建特许经营。' },
  { id: 'port-throughput', name: '港口吞吐量', family: 'utility', desc: '箱量/吨位与费率。', when: '港口与航运服务。' },
  { id: 'oil-gas-nav', name: '储量 NAV', family: 'utility', desc: '油气储量按油价情景折现。', when: '上游油气。' },

  // ── Sum-of-parts / special ────────────────────────────────────────────
  { id: 'sotp-conglomerate', name: '综合企业 SOTP', family: 'sotp', desc: '分部独立估值后加总并扣持有折价。', when: '多主业集团。', engineHint: 'SOTP分部估值' },
  { id: 'holdco-discount', name: '控股折价', family: 'sotp', desc: '控股公司相对子公司市值折价。', when: '投资控股与多层持股。' },
  { id: 'stub-equity', name: '存根权益', family: 'sotp', desc: '剥离上市子公司后剩余业务隐含价。', when: '有显著上市子公司的集团。' },
  { id: 'net-cash', name: '净现金地板', family: 'sotp', desc: '净现金/可变现金融资产作价格地板。', when: '现金丰厚但主业低估的公司。' },
  { id: 'liquidation', name: '清算价值', family: 'sotp', desc: '有序清算假设下的资产回收。', when: '深度破净、退出或重组情景。' },

  // ── Risk / MoS overlays (still paradigms for decision framing) ───────
  { id: 'mos-30', name: '30% 安全边际', family: 'risk', desc: '相对保守内在价值至少三成折扣。', when: 'FinDigest 买入门禁默认参考。' },
  { id: 'mos-cyclical', name: '周期加码边际', family: 'risk', desc: '周期顶部要求更高折扣。', when: '周期高潮或杠杆扩张期。' },
  { id: 'competence-circle', name: '能力圈过滤', family: 'risk', desc: '看不懂则不估或默认太难理解。', when: '复杂金融工程、早期 biotech。' },
  { id: 'small-cap-mos', name: '小盘加码边际', family: 'risk', desc: '小市值要求更大安全边际。', when: '市值偏小、流动性一般。' },
  { id: 'governance-haircut', name: '治理折价', family: 'risk', desc: '关联交易、质押、诚信瑕疵直接折价。', when: '治理风险显性时。' },
  { id: 'key-man', name: '关键人风险', family: 'risk', desc: '创始人/核心科研依赖进入风险清单。', when: '管理层洞察联动。' },
  { id: 'policy-beta', name: '政策敏感折价', family: 'risk', desc: '集采、教培、地产调控等政策 beta。', when: '强监管行业。' },
  { id: 'fx-earnings', name: '汇率盈利暴露', family: 'risk', desc: '海外收入与成本币种错配。', when: '出口制造与港股中概。' },

  // ── Sector-specific extras to reach ~100 coherent set ────────────────
  { id: 'baijiu-channel', name: '白酒渠道库存', family: 'consumer', desc: '批价、库存与动销决定短期利润质量。', when: '高端与次高端白酒。', engineHint: 'DCF+品牌溢价' },
  { id: 'dairy-asp', name: '乳品结构升级', family: 'consumer', desc: '产品结构升级对 ASP 与毛利率。', when: '液态奶与奶粉。' },
  { id: 'retail-sss', name: '同店增长 SSS', family: 'consumer', desc: '同店增速估连锁扩张质量。', when: '餐饮、零售、酒店。' },
  { id: 'gaming-pipeline', name: '游戏版号管线', family: 'consumer', desc: '版号与新游贡献情景。', when: '游戏与内容。', engineHint: 'DCF+用户价值' },
  { id: 'nev-delivery', name: '新能源车交付', family: 'auto', desc: '交付量 × 单车毛利路径。', when: '新能源车企。', engineHint: 'DCF+产能' },
  { id: 'battery-gwh', name: '电池 GWh 出货', family: 'auto', desc: '出货量与装机份额。', when: '动力电池与材料。', engineHint: 'DCF+产能' },
  { id: 'pv-chain', name: '光伏一体化价差', family: 'auto', desc: '硅料-硅片-电池-组件价差。', when: '光伏制造链。' },
  { id: 'defense-budget', name: '军工预算可见度', family: 'defense', desc: '预算与型号批产节奏。', when: '航空航天与军工电子。', engineHint: 'DCF+稳定现金流' },
  { id: 'edu-policy', name: '教育政策情景', family: 'consumer', desc: '监管情景下的收入结构重估。', when: '职业教育与剩余培训资产。' },
  { id: 'agri-hog', name: '猪周期头均利润', family: 'cyclical', desc: '头均盈利与能繁母猪决定周期。', when: '养殖。', engineHint: 'DCF+周期调整' },
]

export const PARADIGM_FAMILIES = [
  { id: 'multiples', name: '倍数法' },
  { id: 'dcf', name: '现金流贴现' },
  { id: 'quality', name: '质量与护城河' },
  { id: 'cyclical', name: '周期' },
  { id: 'bank', name: '银行' },
  { id: 'insurance', name: '保险' },
  { id: 'broker', name: '券商' },
  { id: 'real_estate', name: '地产 NAV' },
  { id: 'biotech', name: '医药生物' },
  { id: 'platform', name: '平台与互联网' },
  { id: 'hk_adr', name: '港股 / ADR' },
  { id: 'semi', name: '半导体与件量' },
  { id: 'utility', name: '公用与能源' },
  { id: 'sotp', name: '分部加总' },
  { id: 'risk', name: '风险与安全边际' },
  { id: 'consumer', name: '消费专项' },
  { id: 'auto', name: '汽车与新能源' },
  { id: 'defense', name: '军工' },
]

export const VALUATION_PARADIGM_COUNT = VALUATION_PARADIGMS.length

const byId = new Map(VALUATION_PARADIGMS.map((p) => [p.id, p]))
const byEngine = new Map()
for (const p of VALUATION_PARADIGMS) {
  if (!p.engineHint) continue
  if (!byEngine.has(p.engineHint)) byEngine.set(p.engineHint, [])
  byEngine.get(p.engineHint).push(p)
}

export function getParadigmById(id) {
  return byId.get(id) || null
}

export function paradigmsForEngineModel(modelName) {
  return byEngine.get(modelName) || []
}

/** Primary paradigm for an INDUSTRY_MODELS.model string */
export function primaryParadigmForModel(modelName) {
  const list = paradigmsForEngineModel(modelName)
  return list[0] || getParadigmById('dcf-conservative')
}

export function paradigmsByFamily(familyId) {
  return VALUATION_PARADIGMS.filter((p) => p.family === familyId)
}

export function searchParadigms(q, limit = 20) {
  const s = String(q || '')
    .trim()
    .toLowerCase()
  if (!s) return VALUATION_PARADIGMS.slice(0, limit)
  const hit = VALUATION_PARADIGMS.filter(
    (p) =>
      p.name.toLowerCase().includes(s) ||
      p.desc.toLowerCase().includes(s) ||
      p.when.toLowerCase().includes(s) ||
      p.family.includes(s) ||
      p.id.includes(s),
  )
  return hit.slice(0, limit)
}
