# FinDigest 浏览器扩展（持仓导入）

必须先在**券商交易端**登录，才能读持仓。不采集、不存储券商账号密码。

扫码只能发生在券商自己的电脑交易窗口 + 对应证券 App。FinDigest 和东财网页都**不会**出现可用的登录二维码。

- 东方财富个人中心：https://passport2.eastmoney.com/pub/login?backurl=https%3A%2F%2Fwww.eastmoney.com%2F 。此登录不会提供证券持仓；持仓仍需在证券交易端打开后读取
- 同花顺：网页交易目前打不开。用电脑端交易 / F12 + 同花顺 App 扫码，再复制持仓表
- 老虎：国内打不开网页交易。用 Tiger Trade App 导出或复制持仓

## 安装（Chrome / Edge）

1. 打开 `chrome://extensions` 或 `edge://extensions`
2. 开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选择本仓库的 `extension/` 目录
4. 固定扩展图标到工具栏。若已装过，点「重新加载」

## 使用

1. 按上面的方式登录券商并打开持仓页
2. 东财网页资金股份页可点「读取本页持仓」→「发送到 FinDigest」
3. 发送目标选 `findigest.cn`
4. 在 FinDigest 校对表勾选后确认导入

读不到时：复制网页/客户端表格，在 FinDigest「粘贴表格」导入。
