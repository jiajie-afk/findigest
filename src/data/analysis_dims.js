export const ANALYSIS_DIMS = {
  // 1. 机构评级 (20%) — 分析师评级、目标价、研报
  ratings:{weight:.20,label:'机构评级',icon:'🏦',evaluate:function(news){
    var score=0,evidence=[],grade='无信号';
    news.forEach(function(n){
      var t=n.t+' '+(n.c||'');
      // 评级调整
      if(/上调.*评级|评级.*上调|调升/.test(t)){score+=3;evidence.push('评级上调');}
      if(/下调.*评级|评级.*下调|调降/.test(t)){score-=3;evidence.push('评级下调');}
      if(/首次覆盖|首予.*买入/.test(t)){score+=2;evidence.push('首次覆盖买入');}
      if(/维持.*买入|重申.*买入/.test(t)){score+=1.5;evidence.push('维持买入');}
      if(/维持.*增持|重申.*增持/.test(t)){score+=1;evidence.push('维持增持');}
      if(/中性|持有|观望/.test(t)&&/评级/.test(t)){evidence.push('中性评级');}
      if(/减持|卖出|回避/.test(t)&&/评级/.test(t)){score-=2;evidence.push('减持/卖出评级');}
      // 目标价
      var tp=t.match(/目标价[：:]*\s*(\d+\.?\d*)/);
      if(tp){var v=parseFloat(tp[1]);if(v>0){score+=2;evidence.push('目标价¥'+v);}}
      // 机构买入/卖出
      if(/主力买入|机构买入|资金流入|北向.*买入/.test(t)){score+=2;evidence.push('机构资金流入');}
      if(/主力卖出|机构卖出|资金流出|北向.*卖出/.test(t)){score-=2;evidence.push('机构资金流出');}
      if(/大宗交易.*溢价/.test(t)){score+=1;evidence.push('大宗交易溢价');}
      if(/大宗交易.*折价/.test(t)){score-=1;evidence.push('大宗交易折价');}
    });
    if(score>=8)grade='强烈看多';else if(score>=4)grade='看多';else if(score>=1)grade='偏多';else if(score>=-1)grade='中性';else if(score>=-4)grade='偏空';else grade='看空';
    return{score:Math.max(-30,Math.min(30,score)),grade:grade,evidence:evidence.slice(0,5)};
  }},

  // 2. 基本面 (15%) — 财务健康、盈利能力（优先用结构化 fin）
  fundamental:{weight:.15,label:'基本面',icon:'📊',evaluate:function(news, fin){
    var score=0,evidence=[],grade='无信号';
    if(fin){
      if(fin.roe!=null){var v=+fin.roe;if(v>=20){score+=3;evidence.push('ROE'+v+'%（优秀·财报）');}else if(v>=15){score+=2;evidence.push('ROE'+v+'%（良好·财报）');}else if(v>=10){score+=1;evidence.push('ROE'+v+'%（财报）');}else if(v>0&&v<5){score-=1.5;evidence.push('ROE'+v+'%偏低（财报）');}}
      if(fin.grossMargin!=null){var v=+fin.grossMargin;if(v>=60){score+=2;evidence.push('毛利率'+v+'%（财报）');}else if(v>=40){score+=1;evidence.push('毛利率'+v+'%（财报）');}else if(v<20){score-=1;evidence.push('毛利率'+v+'%偏低（财报）');}}
      if(fin.netMargin!=null){var v=+fin.netMargin;if(v>=25){score+=1.5;evidence.push('净利率'+v+'%（财报）');}else if(v>0&&v<5){score-=1;evidence.push('净利率'+v+'%偏低（财报）');}}
      if(fin.debtRatio!=null){var v=+fin.debtRatio;if(v>70){score-=2;evidence.push('资产负债率'+v+'%高（财报）');}else if(v<40){score+=1;evidence.push('资产负债率'+v+'%健康（财报）');}}
      if(fin.profitGrowth!=null){var v=+fin.profitGrowth;if(v>=50){score+=2.5;evidence.push('利润增速'+v+'%（财报）');}else if(v>=20){score+=1.5;evidence.push('利润增速'+v+'%（财报）');}else if(v<0){score-=2;evidence.push('利润负增长'+v+'%（财报）');}}
    }
    news.forEach(function(n){
      var t=n.t+' '+(n.c||'');
      if(/毛利率.*\d/.test(t)&&!fin?.grossMargin){var m=t.match(/毛利率.*?(\d+\.?\d*)/);if(m){var v=parseFloat(m[1]);if(v>=60){score+=3;evidence.push('毛利率'+v+'%（优秀）');}else if(v>=40){score+=1.5;evidence.push('毛利率'+v+'%');}else if(v<20){score-=1.5;evidence.push('毛利率'+v+'%（偏低）');}}}
      if(/ROE.*\d/.test(t)&&!fin?.roe){var m=t.match(/ROE.*?(\d+\.?\d*)/);if(m){var v=parseFloat(m[1]);if(v>=20){score+=3;evidence.push('ROE'+v+'%（优秀）');}else if(v>=15){score+=2;evidence.push('ROE'+v+'%（良好）');}else if(v>=10){score+=1;evidence.push('ROE'+v+'%');}else if(v<5){score-=1.5;evidence.push('ROE'+v+'%（偏低）');}}}
      if(/净利率.*\d/.test(t)&&!fin?.netMargin){var m=t.match(/净利率.*?(\d+\.?\d*)/);if(m){var v=parseFloat(m[1]);if(v>=25){score+=2;evidence.push('净利率'+v+'%（优秀）');}else if(v<5){score-=1;evidence.push('净利率'+v+'%（偏低）');}}}
      if(/资产负债率.*\d/.test(t)&&!fin?.debtRatio){var m=t.match(/资产负债率.*?(\d+\.?\d*)/);if(m){var v=parseFloat(m[1]);if(v>70){score-=2;evidence.push('资产负债率'+v+'%（高风险）');}else if(v<40){score+=1.5;evidence.push('资产负债率'+v+'%（健康）');}}}
      if(/营收.*(?:增长|增速|同比).*\d/.test(t)){var m=t.match(/(?:增长|增速|同比).*?(-?\d+\.?\d*)/);if(m){var v=parseFloat(m[1]);if(v>=30){score+=2;evidence.push('营收增长'+v+'%（高速）');}else if(v>=15){score+=1;evidence.push('营收增长'+v+'%');}else if(v<0){score-=2;evidence.push('营收负增长'+v+'%');}}}
      if(/净利润.*(?:增长|增速|同比).*\d/.test(t)&&fin?.profitGrowth==null){var m=t.match(/(?:增长|增速|同比).*?(-?\d+\.?\d*)/);if(m){var v=parseFloat(m[1]);if(v>=50){score+=3;evidence.push('净利润增长'+v+'%（高速）');}else if(v>=20){score+=1.5;evidence.push('净利润增长'+v+'%');}else if(v<0){score-=2;evidence.push('净利润负增长'+v+'%');}}}
      if(/经营现金流.*增长|现金流充沛/.test(t)){score+=2;evidence.push('现金流改善');}
      if(/经营现金流.*下降|现金流恶化/.test(t)){score-=2;evidence.push('现金流恶化');}
      if(/预增|大幅增长|超预期|业绩.*增长/.test(t)){score+=2;evidence.push('业绩增长');}
      if(/预减|业绩.*下滑|低于预期/.test(t)){score-=2;evidence.push('业绩下滑');}
      if(/扭亏为盈/.test(t)){score+=3;evidence.push('扭亏为盈');}
      if(/亏损.*扩大|由盈转亏/.test(t)){score-=3;evidence.push('亏损扩大');}
    });
    if(score>=6)grade='优秀';else if(score>=2)grade='良好';else if(score>=-2)grade='一般';else grade='承压';
    return{score:Math.max(-30,Math.min(30,score)),grade:grade,evidence:evidence.slice(0,5)};
  }},

  // 3. 估值 (15%) — 估值水平、安全边际（优先用结构化 fin）
  valuation:{weight:.15,label:'估值',icon:'💰',evaluate:function(news, fin){
    var score=0,evidence=[],grade='无信号';
    if(fin){
      if(fin.pe_ttm!=null&&+fin.pe_ttm>0){var v=+fin.pe_ttm;if(v<15){score+=3;evidence.push('PE '+v+'倍（低估·财报）');}else if(v<25){score+=1.5;evidence.push('PE '+v+'倍（合理·财报）');}else if(v>80){score-=3;evidence.push('PE '+v+'倍（高估·财报）');}else if(v>50){score-=1.5;evidence.push('PE '+v+'倍偏高（财报）');}}
      if(fin.marginOfSafety!=null){var v=+fin.marginOfSafety;if(v>=30){score+=3;evidence.push('安全边际'+v+'%（充足·模型）');}else if(v>=10){score+=1;evidence.push('安全边际'+v+'%（模型）');}else if(v<0){score-=2;evidence.push('安全边际'+v+'%不足（模型）');}}
      if(fin.pb!=null&&+fin.pb>0){var v=+fin.pb;if(v<1){score+=1.5;evidence.push('PB '+v+'（破净倾向·财报）');}else if(v>8){score-=1;evidence.push('PB '+v+'偏高（财报）');}}
    }
    news.forEach(function(n){
      var t=n.t+' '+(n.c||'');
      if(/市盈率.*\d/.test(t)&&!fin?.pe_ttm){var m=t.match(/市盈率.*?(\d+\.?\d*)/);if(m){var v=parseFloat(m[1]);if(v>0&&v<15){score+=3;evidence.push('PE '+v+'倍（显著低估）');}else if(v<25){score+=1.5;evidence.push('PE '+v+'倍（合理）');}else if(v>80){score-=3;evidence.push('PE '+v+'倍（严重高估）');}else if(v>50){score-=1.5;evidence.push('PE '+v+'倍（偏高）');}}}
      if(/PE.*\d/.test(t)&&!/市盈率/.test(t)&&!fin?.pe_ttm){var m=t.match(/PE.*?(\d+\.?\d*)/);if(m){var v=parseFloat(m[1]);if(v>0&&v<15)score+=2;else if(v>50)score-=2;}}
      if(/安全边际/.test(t)&&fin?.marginOfSafety==null){var m=t.match(/安全边际.*?(-?\d+\.?\d*)/);if(m){var v=parseFloat(m[1]);if(v>=30){score+=3;evidence.push('安全边际'+v+'%（充足）');}else if(v>=10){score+=1;evidence.push('安全边际'+v+'%');}else if(v<0){score-=2;evidence.push('安全边际不足'+v+'%');}}}
      if(/估值泡沫|泡沫化/.test(t)){score-=2;evidence.push('估值泡沫风险');}
      if(/股息率.*\d/.test(t)){var m=t.match(/股息率.*?(\d+\.?\d*)/);if(m){var v=parseFloat(m[1]);if(v>=4){score+=2;evidence.push('股息率'+v+'%（高股息）');}else if(v>=2){score+=1;}}}
      if(/回购/.test(t)){score+=1.5;evidence.push('公司回购（管理层看好）');}
    });
    if(score>=4)grade='低估';else if(score>=1)grade='合理偏低';else if(score>=-1)grade='合理';else grade='偏高';
    return{score:Math.max(-30,Math.min(30,score)),grade:grade,evidence:evidence.slice(0,5)};
  }},

  // 4. 护城河 (10%) — 竞争优势、行业地位
  moat:{weight:.10,label:'护城河',icon:'🏰',evaluate:function(news){
    var score=0,evidence=[],grade='无信号';
    news.forEach(function(n){
      var t=n.t+' '+(n.c||'');
      if(/行业龙头|龙头企业|市占率第一|全球领先/.test(t)){score+=2;evidence.push('行业龙头地位');}
      if(/市占率.*提升|份额.*扩大/.test(t)){score+=1.5;evidence.push('市场份额提升');}
      if(/市占率.*下降|份额.*萎缩/.test(t)){score-=1.5;evidence.push('市场份额下降');}
      if(/垄断|寡头|护城河|壁垒/.test(t)){score+=2;evidence.push('竞争壁垒');}
      if(/品牌价值|品牌溢价|知名品牌/.test(t)){score+=1;evidence.push('品牌优势');}
      if(/技术壁垒|专利.*数量|核心.*技术/.test(t)){score+=1.5;evidence.push('技术壁垒');}
      if(/竞争加剧|价格战|替代品/.test(t)){score-=1.5;evidence.push('竞争加剧');}
      if(/独家|唯一|不可替代/.test(t)){score+=2;evidence.push('不可替代性');}
    });
    if(score>=5)grade='强护城河';else if(score>=2)grade='有壁垒';else if(score>=-2)grade='一般';else grade='护城河弱';
    return{score:Math.max(-30,Math.min(30,score)),grade:grade,evidence:evidence.slice(0,5)};
  }},

  // 5. 增长性 (10%) — 收入增长、利润增长、新业务
  growth:{weight:.10,label:'增长性',icon:'📈',evaluate:function(news){
    var score=0,evidence=[],grade='无信号';
    news.forEach(function(n){
      var t=n.t+' '+(n.c||'');
      // 收入增长 — 兼容"增长"和"增速"
      if(/营收.*(?:增长|增速).*\d/.test(t)){var m=t.match(/(?:增长|增速).*?(-?\d+\.?\d*)/);if(m){var v=parseFloat(m[1]);if(v>=30){score+=3;evidence.push('营收增长'+v+'%（高速）');}else if(v>=15){score+=1.5;evidence.push('营收增长'+v+'%');}else if(v<0){score-=2;evidence.push('营收负增长');}}}
      // 利润增长 — 兼容"增长"和"增速"
      if(/净利润.*(?:增长|增速).*\d/.test(t)){var m=t.match(/(?:增长|增速).*?(-?\d+\.?\d*)/);if(m){var v=parseFloat(m[1]);if(v>=50){score+=3;evidence.push('净利润增长'+v+'%（高速）');}else if(v>=20){score+=1.5;evidence.push('净利润增长'+v+'%');}else if(v<0){score-=2;evidence.push('净利润负增长');}}}
      // 新业务/新赛道
      if(/新业务|第二曲线|新增长点|新赛道/.test(t)){score+=1.5;evidence.push('新业务拓展');}
      if(/新产品|新.*发布|技术.*突破/.test(t)){score+=1;evidence.push('产品创新');}
      // 大订单/合同
      if(/大订单|中标.*亿|战略合作/.test(t)){score+=2;evidence.push('大订单/战略合作');}
      // 产能扩张
      if(/产能.*扩张|扩产|新建.*产线/.test(t)){score+=1;evidence.push('产能扩张');}
      if(/产能过剩|去产能/.test(t)){score-=1;evidence.push('产能过剩风险');}
    });
    if(score>=6)grade='高增长';else if(score>=2)grade='稳健增长';else if(score>=-2)grade='平稳';else grade='增长承压';
    return{score:Math.max(-30,Math.min(30,score)),grade:grade,evidence:evidence.slice(0,5)};
  }},

  // 6. 资金面 (10%) — 主力资金、融资融券、北向资金
  capital:{weight:.10,label:'资金面',icon:'💸',evaluate:function(news){
    var score=0,evidence=[],grade='无信号';
    news.forEach(function(n){
      var t=n.t+' '+(n.c||'');
      if(/主力.*净买入|主力.*流入/.test(t)){score+=2;evidence.push('主力资金净买入');}
      if(/主力.*净卖出|主力.*流出/.test(t)){score-=2;evidence.push('主力资金净卖出');}
      if(/北向.*买入|外资.*买入/.test(t)){score+=1.5;evidence.push('北向资金买入');}
      if(/北向.*卖出|外资.*卖出/.test(t)){score-=1.5;evidence.push('北向资金卖出');}
      if(/融资.*增加|融资余额.*上升/.test(t)){score+=1;evidence.push('融资余额增加（看多）');}
      if(/融券.*增加|融券余额.*上升/.test(t)){score-=1;evidence.push('融券余额增加（看空）');}
      if(/放量|成交量.*放大/.test(t)){evidence.push('放量');}
      if(/缩量|成交量.*萎缩/.test(t)){evidence.push('缩量');}
    });
    if(score>=4)grade='资金流入';else if(score>=1)grade='偏流入';else if(score>=-1)grade='中性';else grade='资金流出';
    return{score:Math.max(-30,Math.min(30,score)),grade:grade,evidence:evidence.slice(0,5)};
  }},

  // 7. 催化剂 (10%) — 即将发生的正面事件
  catalyst:{weight:.10,label:'催化剂',icon:'⚡',evaluate:function(news){
    var score=0,evidence=[],grade='无信号';
    news.forEach(function(n){
      var t=n.t+' '+(n.c||'');
      if(/半年报|年报|季报/.test(t)&&/披露|发布|公布/.test(t)){score+=2;evidence.push('财报即将披露');}
      if(/股东大会/.test(t)){score+=0.5;evidence.push('股东大会召开');}
      if(/产品.*发布|新品.*上市/.test(t)){score+=2;evidence.push('新品发布催化');}
      if(/政策.*利好|补贴|扶持/.test(t)){score+=2;evidence.push('政策利好');}
      if(/并购|收购|重组/.test(t)){score+=2;evidence.push('并购重组催化');}
      if(/定增|增发|配股/.test(t)){score-=1;evidence.push('再融资（稀释风险）');}
      if(/解禁/.test(t)){score-=1.5;evidence.push('限售股解禁');}
      if(/股权激励|员工持股/.test(t)){score+=1;evidence.push('股权激励（利益绑定）');}
    });
    if(score>=4)grade='多催化';else if(score>=1)grade='有催化';else if(score>=-1)grade='中性';else grade='负面催化';
    return{score:Math.max(-30,Math.min(30,score)),grade:grade,evidence:evidence.slice(0,5)};
  }},

  // 8. 风险评估 (10%) — 负面事件、监管、黑天鹅
  risk:{weight:.10,label:'风险',icon:'⚠️',evaluate:function(news){
    var score=0,evidence=[],grade='无信号';
    news.forEach(function(n){
      var t=n.t+' '+(n.c||'');
      if(/立案调查|行政处罚|退市风险|ST|暴雷|重大违规/.test(t)){score-=5;evidence.push('重大风险事件');}
      if(/诉讼|仲裁|纠纷/.test(t)){score-=1.5;evidence.push('诉讼/纠纷');}
      if(/处罚|罚款|监管.*约谈/.test(t)){score-=2;evidence.push('监管处罚');}
      if(/大股东.*减持|高管.*减持/.test(t)){score-=1.5;evidence.push('大股东/高管减持');}
      if(/商誉.*减值|商誉.*风险/.test(t)){score-=2;evidence.push('商誉减值风险');}
      if(/债务.*违约|信用.*风险/.test(t)){score-=3;evidence.push('债务/信用风险');}
      // 正面
      if(/风险.*解除|摘帽|撤销.*处罚/.test(t)){score+=2;evidence.push('风险解除');}
      if(/增持|回购/.test(t)){score+=1;evidence.push('增持/回购（风险缓解）');}
    });
    if(score<=-6)grade='高风险';else if(score<=-3)grade='中高风险';else if(score<=0)grade='中低风险';else grade='低风险';
    return{score:Math.max(-30,Math.min(30,score)),grade:grade,evidence:evidence.slice(0,5)};
  }},

  // 9. 市场情绪 (5%) — 股吧、散户、技术形态（股吧/论坛降权，券商/机构加权）
  sentiment:{weight:.05,label:'情绪',icon:'💭',evaluate:function(news){
    var score=0,evidence=[],grade='无信号';
    var bullK=0,bearK=0;
    news.forEach(function(n){
      var t=n.t+' '+(n.c||'');
      // 股吧/论坛来源大幅降权 — 噪音大、情绪化、易操控
      var src=(n.s||'');
      var w=1;
      if(src.indexOf('股吧')>=0||src.indexOf('论坛')>=0||src.indexOf('TGB')>=0)w=0.3;
      else if(src.indexOf('机构')>=0||src.indexOf('研报')>=0||src.indexOf('券商')>=0)w=2;
      if(/看多|加仓|抄底|满仓|看涨/.test(t)){bullK++;score+=0.5*w;}
      if(/看空|割肉|清仓|跑路|看跌/.test(t)){bearK++;score-=0.5*w;}
      // 散户过度乐观是反向指标（仅高权重来源才触发）
      if(/全仓|梭哈|必涨|要翻倍/.test(t)&&w>0.5){score-=1;evidence.push('散户过度乐观（反向指标）');}
      // 技术面
      if(/突破.*压力|站上.*均线|放量.*上涨/.test(t)){score+=1;evidence.push('技术面偏多');}
      if(/跌破.*支撑|破位|放量.*下跌/.test(t)){score-=1;evidence.push('技术面偏空');}
    });
    evidence.unshift('看多'+bullK+'条 vs 看空'+bearK+'条');
    if(score>=2)grade='偏乐观';else if(score>=-2)grade='中性';else grade='偏悲观';
    return{score:Math.max(-30,Math.min(30,score)),grade:grade,evidence:evidence.slice(0,5)};
  }},

  // 10. 宏观环境 (5%) — 政策、利率、行业周期
  macro:{weight:.05,label:'宏观',icon:'🌍',evaluate:function(news){
    var score=0,evidence=[],grade='无信号';
    news.forEach(function(n){
      var t=n.t+' '+(n.c||'');
      if(/降息|降准|宽松|流动性充裕/.test(t)){score+=1.5;evidence.push('货币宽松');}
      if(/加息|收紧|流动性.*收紧/.test(t)){score-=1.5;evidence.push('货币收紧');}
      if(/政策.*利好|产业.*政策|补贴/.test(t)){score+=1.5;evidence.push('产业政策利好');}
      if(/政策.*收紧|监管.*加强/.test(t)){score-=1.5;evidence.push('政策收紧');}
      if(/经济.*复苏|PMI.*回升/.test(t)){score+=1;evidence.push('经济复苏');}
      if(/经济.*下行|衰退/.test(t)){score-=1;evidence.push('经济下行');}
      if(/中美.*利好|贸易.*缓和/.test(t)){score+=1;evidence.push('外部环境改善');}
      if(/中美.*恶化|贸易.*摩擦|制裁/.test(t)){score-=1;evidence.push('外部环境恶化');}
    });
    if(score>=2)grade='有利';else if(score>=-2)grade='中性';else grade='不利';
    return{score:Math.max(-30,Math.min(30,score)),grade:grade,evidence:evidence.slice(0,5)};
  }}
}
