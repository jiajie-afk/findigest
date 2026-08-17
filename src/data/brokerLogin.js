/**
 * Broker web-trade login / holdings URLs.
 * Holdings live on the trade site after login — quote apps (行情) are not enough.
 */
export const BROKER_LOGINS = [
  {
    id: 'eastmoney',
    label: '东方财富',
    loginUrl: 'https://jywg.18.cn/Login',
    holdingsUrl: 'https://jywg.18.cn/Search/Position',
    hint: '这是证券交易通道，不是看行情的东方财富网。电脑端多数要用资金账号 + 交易密码；若页面有二维码，必须用手机「东方财富证券」App 里的扫一扫，看资讯的「东方财富」和微信都扫不上。登录后打开「查询 → 资金股份」。',
    desktop: [
      '打开东方财富电脑端，进入交易 → 持仓 / 资金股份。',
      '全选表格复制，或导出 CSV。',
      '回到本页用「粘贴表格」或「上传 CSV」。电脑软件不会自动同步过来。',
    ],
  },
  {
    id: 'ths',
    label: '同花顺',
    loginUrl: 'https://eq.10jqka.com.cn/',
    holdingsUrl: 'https://eq.10jqka.com.cn/',
    hint: '用同花顺交易账号登录网页交易。登录后切到持仓 / 股份。',
    desktop: [
      '打开同花顺电脑端，进入交易 → 持仓。',
      '全选复制，或另存为 CSV / Excel（另存 CSV）。',
      '回到本页粘贴或上传。电脑客户端与网页不是同一通道，无法后台直读。',
    ],
  },
  {
    id: 'tiger',
    label: '老虎证券',
    loginUrl: 'https://web.tigerbrokers.com/',
    holdingsUrl: 'https://web.tigerbrokers.com/portfolio',
    hint: '登录网页版后进入 Portfolio / 持仓。',
    desktop: [
      '老虎电脑端打开持仓，复制表格或导出 CSV。',
      '回到本页粘贴 / 上传。',
    ],
  },
]

export function brokerById(id) {
  return BROKER_LOGINS.find((b) => b.id === id) || BROKER_LOGINS[0]
}
