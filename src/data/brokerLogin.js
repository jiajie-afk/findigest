/**
 * Broker entry points for holdings import.
 *
 * FinDigest cannot mint a broker QR code or accept broker credentials.
 * Scan-to-login, when offered, stays inside the broker's own trade client.
 */
export const BROKER_LOGINS = [
  {
    id: 'eastmoney',
    label: '东方财富',
    webOpens: true,
    qrOnWeb: false,
    webLoginLabel: '打开东方财富个人中心',
    loginUrl: 'https://passport2.eastmoney.com/pub/login?backurl=https%3A%2F%2Fwww.eastmoney.com%2F',
    scanApp: '东方财富证券',
    hintScan:
      '登录区只支持资金账号；左侧二维码是下载 App，不会登录。请打开电脑上的东方财富证券交易窗口；若窗口给出二维码，用「东方财富证券」App 扫。否则用资金账号登录，登录后打开持仓表再同步。',
    hintWeb:
      '这是东方财富个人中心登录，登录后返回东方财富网站。它不是证券交易账户，也不会自动读取证券持仓。',
    webSteps: [
      '登录东方财富个人中心，完成后会返回东方财富网站。',
      '该登录仅用于网站个人中心，不会把证券持仓授权给 FinDigest。',
      '若要导入证券持仓，请使用本页的粘贴、CSV 或截图导入。',
    ],
    webBlocked: '',
    desktop: [
      '打开东方财富电脑端交易窗口（不是行情主界面）。',
      '若交易窗口给出二维码，用「东方财富证券」App 扫；否则用资金账号登录。',
      '打开持仓 / 资金股份，全选复制或导出 CSV，回到本页同步。',
    ],
  },
  {
    id: 'ths',
    label: '同花顺',
    webOpens: false,
    qrOnWeb: false,
    loginUrl: '',
    holdingsUrl: '',
    scanApp: '同花顺',
    hintScan:
      'FinDigest 不把同花顺网页交易作为同步路径。请打开同花顺电脑端，点「交易」或按 F12，按你的券商提供的扫码或资金账号方式登录。登录后复制持仓表，回到这里粘贴或上传 CSV。',
    hintWeb: '',
    webBlocked:
      'FinDigest 不再打开同花顺网页交易：它不是稳定的持仓同步接口。官网「登录」是同花顺通行证个人中心，读不到券商持仓。请在电脑交易端登录，再把持仓表粘贴回来。',
    desktop: [
      '打开同花顺电脑端 → 交易 / F12，选你的开户券商。',
      '按你的开户券商提供的扫码或资金账号方式登录。',
      '打开持仓，复制表格或另存 CSV，回到本页粘贴 / 上传。',
    ],
  },
  {
    id: 'tiger',
    label: '老虎证券',
    webOpens: false,
    qrOnWeb: false,
    loginUrl: '',
    holdingsUrl: '',
    scanApp: 'Tiger Trade',
    hintScan:
      'FinDigest 不把老虎 Web 交易作为同步路径。官方 Web 登录是手机号/密码或验证，不提供可由 FinDigest 接管的登录二维码。请在 Tiger Trade App 打开持仓，导出或截图后回到这里上传 / 粘贴。',
    hintWeb: '',
    webBlocked:
      'FinDigest 不再打开老虎网页交易：它不是稳定的持仓同步接口。能打开的官方登录页是账号中心，不是持仓扫码。请用 Tiger Trade App 导出持仓，或复制表格回来。',
    desktop: [
      '打开 Tiger Trade App 或电脑客户端持仓页。',
      '导出 CSV，或复制持仓表。',
      '港股代码会识别为 HK。回到本页粘贴 / 上传。',
    ],
  },
]

export function brokerById(id) {
  return BROKER_LOGINS.find((b) => b.id === id) || BROKER_LOGINS[0]
}
