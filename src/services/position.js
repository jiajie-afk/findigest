export function calculatePosition(sent, fin) {
  // 1. 基础仓位：多维度综合
  var base = 10 // 起步10%

  // 评分维度加减仓
  var t = sent.total || 0
  if (t >= 30) base += 10 // 强烈看多 +10%
  else if (t >= 15) base += 5 // 偏多 +5%
  else if (t <= -20) base -= 5 // 偏空 -5%
  else if (t <= -30) base -= 8 // 强烈看空 -8%

  // 基本面加减仓
  if (fin) {
    if (fin.roe >= 20) base += 5 // 优秀ROE
    else if (fin.roe >= 15) base += 3
    else if (fin.roe < 8 && fin.roe > 0) base -= 3

    if (fin.pe_ttm > 0 && fin.pe_ttm < 15) base += 4 // 低估
    else if (fin.pe_ttm >= 15 && fin.pe_ttm < 25) base += 1
    else if (fin.pe_ttm >= 50) base -= 3 // 高估
    else if (fin.pe_ttm >= 100) base -= 6

    if (fin.marginOfSafety != null) {
      if (fin.marginOfSafety >= 30) base += 5 // 安全边际充足
      else if (fin.marginOfSafety >= 10) base += 2
      else if (fin.marginOfSafety < 0) base -= 4 // 安全边际不足
    }

    if (fin.grossMargin >= 50) base += 2 // 护城河强
    if (fin.debtRatio > 70) base -= 3 // 高负债
  }

  // 维度评分加减仓
  if (sent.dimScores) {
    var ds = sent.dimScores
    if (ds.ratings && ds.ratings.score > 5) base += 3
    if (ds.catalyst && ds.catalyst.score > 5) base += 3
    if (ds.risk && ds.risk.score < -5) base -= 4
  }

  // 置信度调整
  if (sent.confidence >= 70) base += 2
  else if (sent.confidence < 40) base -= 3

  var pct = Math.max(3, Math.min(35, Math.round(base)))

  // 2. 止损位
  var stopLoss = -8
  if (fin && fin.pe_ttm > 80) stopLoss = -5
  else if (fin && fin.pe_ttm > 50) stopLoss = -6
  else if (fin && fin.pe_ttm > 0 && fin.pe_ttm < 15) stopLoss = -10 // 低估可以给更多空间
  if (t <= -25) stopLoss = Math.max(stopLoss + 2, -4) // 消息面极差，收紧

  // 3. 止盈位
  var takeProfit = 15
  if (fin && fin.marginOfSafety >= 30) takeProfit += 10
  if (fin && fin.marginOfSafety >= 50) takeProfit += 10
  if (t >= 20) takeProfit += 5
  if (fin && fin.profitGrowth >= 30) takeProfit += 5

  // 4. 持有周期
  var holdPeriod = '1-3个月'
  if (pct >= 25 && t >= 20) holdPeriod = '3-6个月'
  else if (t <= -10) holdPeriod = '观察1-2周'
  else if (t <= 5 && t >= -5) holdPeriod = '1-2个月'

  var rationale = []
  if (pct >= 25) rationale.push('高置信')
  else if (pct >= 15) rationale.push('中等置信')
  else rationale.push('低置信/试探')
  if (fin && fin.roe >= 15) rationale.push('ROE优秀')
  if (fin && fin.pe_ttm > 0 && fin.pe_ttm < 20) rationale.push('估值合理')
  if (t >= 15) rationale.push('消息面积极')

  return {
    pct: pct,
    stopLoss: stopLoss,
    takeProfit: takeProfit,
    holdPeriod: holdPeriod,
    rationale: rationale.join('，'),
  }
}
