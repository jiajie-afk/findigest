/**
 * Offline ranking: CCTV 时政要闻 above sports / lifestyle.
 * Usage: node scripts/smoke_cctv_news.mjs
 */
import {
  hydrateChannelItems,
  isAllowedCctvArticleUrl,
  parseCctvJsonp,
  parseXwlbDayHtml,
  rankCctvItems,
  scoreCctvItem,
  collectCctvNews,
  XWLB_DAY_URL,
  xwlbDayKeys,
} from '../lib/cctvNews.js'

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    failed += 1
    console.error('FAIL:', msg)
  } else {
    console.log('OK  ', msg)
  }
}

const NOW = Date.parse('2026-08-19T15:00:00+08:00')

const jsonp = `news({"data":{"total":3,"list":[
  {"id":"A1","title":"习近平会见外方代表团","brief":"会谈","url":"https://news.cctv.com/2026/08/19/ARTIabc.shtml","keywords":"习近平","focus_date":"2026-08-19 10:00:00"},
  {"id":"A2","title":"韩国足协曾不当招待中国足协工作人员？官方回应","brief":"调查","url":"https://news.cctv.com/2026/08/19/ARTIdef.shtml","keywords":"足协","focus_date":"2026-08-19 14:11:16"},
  {"id":"A3","title":"javascript:alert(1)","brief":"x","url":"javascript:alert(1)","keywords":"","focus_date":"2026-08-19 09:00:00"}
]}})`

const list = parseCctvJsonp(jsonp)
assert(list.length === 3, `parse jsonp: 3 rows, got ${list.length}`)

const china = { id: 'china', label: '国内', weight: 10 }
const rows = hydrateChannelItems(list, china)
assert(rows.length === 2, `hydrate drops javascript url, got ${rows.length}`)
assert(!rows.some((r) => r.url.startsWith('javascript')), 'no javascript: urls')

assert(isAllowedCctvArticleUrl('https://news.cctv.com/2026/08/19/ARTIabc.shtml'), 'cctv article url ok')
assert(isAllowedCctvArticleUrl('https://tv.cctv.com/2026/08/19/VIDEabc.shtml'), '新闻联播节目页 url ok')
assert(!isAllowedCctvArticleUrl('https://so.eastmoney.com/news/s?keyword=x'), 'eastmoney url rejected')
assert(!isAllowedCctvArticleUrl('https://news.cctv.com/'), 'bare portal rejected')

const xi = scoreCctvItem(rows[0], { now: NOW, channelWeight: 10, index: 0 })
const sports = scoreCctvItem(rows[1], { now: NOW, channelWeight: 10, index: 1 })
assert(xi.score > sports.score, `xi ${xi.score} > sports ${sports.score}`)
assert(xi.score >= 52, `xi is 要闻-tier, got ${xi.score}`)

const ranked = rankCctvItems(
  [
    ...rows,
    {
      id: 'B1',
      title: '老街巷换装开市引客来 烟火气推高消费',
      brief: '美食节',
      url: 'https://news.cctv.com/2026/08/19/ARTIfood.shtml',
      keywords: '烟火气 美食节',
      focus_date: '2026-08-19 12:58:55',
      channel: 'china',
      channelLabel: '国内',
      channelWeight: 10,
      index: 2,
    },
    {
      id: 'B2',
      title: '中国人民银行开展公开市场操作',
      brief: '央行逆回购',
      url: 'https://news.cctv.com/2026/08/19/ARTIpbc.shtml',
      keywords: '央行',
      focus_date: '2026-08-19 09:30:00',
      channel: 'economy',
      channelLabel: '经济',
      channelWeight: 9,
      index: 0,
    },
  ],
  { now: NOW, limit: 10 },
)

assert(ranked[0].title.includes('习近平'), `rank1 习近平, got ${ranked[0].title}`)
assert(ranked[1].title.includes('人民银行') || ranked[1].title.includes('央行'), `rank2 央行, got ${ranked[1].title}`)
assert(ranked[0].tier === 's' || ranked[0].tier === 'a', `top tier s/a, got ${ranked[0].tier}`)
assert(ranked.every((x) => x.rank >= 1), 'ranks assigned')

const duped = rankCctvItems(
  [
    { ...rows[0], id: 'X1', channel: 'news', channelWeight: 6, index: 0 },
    { ...rows[0], id: 'X2', channel: 'china', channelWeight: 10, index: 3 },
  ],
  { now: NOW, limit: 5 },
)
assert(duped.length === 1, `same title collapsed, got ${duped.length}`)
assert(duped[0].channelLabel === '国内', 'prefer china channel over 要闻 on same title')

const jingjiWins = rankCctvItems(
  [
    {
      ...rows[0],
      id: 'C1',
      title: '提前还贷挤压信贷 前7个月居民贷款同比多减',
      keywords: '信贷',
      channel: 'china',
      channelLabel: '国内',
      channelWeight: 8,
      index: 0,
    },
    {
      ...rows[0],
      id: 'C2',
      title: '提前还贷挤压信贷 前7个月居民贷款同比多减',
      keywords: '信贷',
      url: 'https://jingji.cctv.com/2026/08/19/ARTIloan.shtml',
      channel: 'jingji',
      channelLabel: '财经',
      channelWeight: 10,
      index: 2,
    },
  ],
  { now: NOW, limit: 5 },
)
assert(jingjiWins.length === 1, `finance/china same title collapsed, got ${jingjiWins.length}`)
assert(jingjiWins[0].channelLabel === '财经', `keep 央视财经 over 国内转载, got ${jingjiWins[0].channelLabel}`)

const chinaOverWorld = rankCctvItems(
  [
    {
      ...rows[0],
      id: 'W1',
      title: '霍尔木兹海峡局势升级',
      keywords: '霍尔木兹',
      channel: 'world',
      channelLabel: '国际',
      channelWeight: 7,
      index: 0,
    },
    {
      ...rows[0],
      id: 'W2',
      title: '霍尔木兹海峡局势升级',
      keywords: '霍尔木兹',
      channel: 'china',
      channelLabel: '国内',
      channelWeight: 10,
      index: 4,
    },
  ],
  { now: NOW, limit: 5 },
)
assert(chinaOverWorld.length === 2, `domestic+world both kept, got ${chinaOverWorld.length}`)
assert(
  chinaOverWorld.some((x) => x.lane === 'domestic') && chinaOverWorld.some((x) => x.lane === 'world'),
  '同一条国内/国际各留一份，国际要闻不被国内转载吃掉',
)

function stubItems(channel, label, weight, n, titleOf) {
  const host = channel === 'jingji' ? 'jingji.cctv.com' : 'news.cctv.com'
  return Array.from({ length: n }, (_, i) => ({
    id: `${channel}-${i}`,
    title: titleOf(i),
    brief: '摘要',
    url: `https://${host}/2026/08/19/ARTI${channel}${i}.shtml`,
    keywords: '',
    focus_date: '2026-08-19 11:00:00',
    channel,
    channelLabel: label,
    channelWeight: weight,
    index: i,
  }))
}

const mixed = rankCctvItems(
  [
    ...stubItems('china', '国内', 10, 24, (i) => `商务部推进县域消费活力 ${i}`),
    ...stubItems('world', '国际', 7, 12, (i) => `某国举行年度阅兵仪式 ${i}`),
    ...stubItems('jingji', '财经', 9, 12, (i) => `理财打新要冷静 观察上市节奏 ${i}`),
  ],
  { now: NOW, limit: 40 },
)
const firstWorld = mixed.findIndex((x) => x.lane === 'world' || x.channel === 'world')
assert(firstWorld > 0, `国际不排在最前, got ${firstWorld}`)
assert(
  mixed.slice(0, firstWorld).every((x) => x.lane === 'domestic' && x.channel !== 'world'),
  '国内栏整段在国际之前',
)
assert(
  mixed.slice(firstWorld).every((x) => x.lane === 'world'),
  '国际栏不再混入国内',
)
const worldN = mixed.filter((x) => x.channel === 'world').length
const financeN = mixed.filter((x) => x.channel === 'jingji' || x.channel === 'economy').length
assert(worldN >= 12, `国际栏独立满编, got ${worldN}`)
assert(financeN >= 8, `财经留在国内栏, got ${financeN}`)
assert(mixed[0].lane === 'domestic', '榜首在国内栏')

const fetched = []
const collected = await collectCctvNews({
  now: NOW,
  fetchText: async (url) => {
    fetched.push(url)
    if (url.includes('china_1.jsonp')) return jsonp.replace(/^news/, 'china')
    return 'empty({"data":{"total":0,"list":[]}})'
  },
})
assert(collected.items[0].title.includes('习近平'), 'collect ranks 习近平 first')
assert(collected.items[0].lane === 'domestic', 'collect 国内栏在前')
assert(collected.groups.domestic.length >= 1, 'groups.domestic filled')
assert(Array.isArray(collected.groups.world), 'groups.world present')
assert(collected.counts.today >= 1, `today count, got ${collected.counts.today}`)
assert(
  fetched.some((u) => u.includes('economy_zixun_1.jsonp')),
  'fetches 央视财经 economy_zixun',
)
assert(
  fetched.some((u) => u.includes('world_1.jsonp')),
  'fetches 国际 world_1',
)
assert(
  fetched.some((u) => u.includes('/lm/xwlb/day/')),
  'fetches 新闻联播 day rundown',
)
assert(
  xwlbDayKeys(NOW).includes('20260819'),
  'xwlb day keys include 当天',
)
assert(XWLB_DAY_URL('20260819').includes('20260819.shtml'), 'xwlb day url')

const xwlbHtml = `
<a href="https://tv.cctv.com/2026/08/19/VIDEfull.shtml" title="《新闻联播》 20260819 19:00">完整版《新闻联播》</a>
<a href="https://tv.cctv.com/2026/08/19/VIDExi.shtml" title="[视频]习近平致电祝贺鲍卡就任匈牙利总统">完整版[视频]习近平致电</a>
<a href="https://tv.cctv.com/2026/08/19/VIDEbrief.shtml" title="[视频]国内联播快讯">国内联播快讯</a>
<a href="https://tv.cctv.com/2026/08/19/VIDEiran.shtml" title="[视频]美总统称不与伊朗进行任何对话">伊朗</a>
<a href="https://tv.cctv.com/2026/08/19/VIDEintl.shtml" title="[视频]国际联播快讯">国际联播快讯</a>
`
const xwlbRows = parseXwlbDayHtml(xwlbHtml, '20260819')
assert(!xwlbRows.some((x) => /《新闻联播》/.test(x.title)), 'skips 完整版整期')
assert(xwlbRows.some((x) => x.title.includes('习近平')), 'keeps 联播分条 习近平')
assert(xwlbRows.filter((x) => x.lane === 'world').length === 2, '国内联播快讯之后为国际段')
assert(
  xwlbRows.find((x) => x.title.includes('国内联播快讯'))?.lane === 'domestic',
  '国内联播快讯留在国内',
)

const withTv = rankCctvItems(
  [
    ...stubItems('china', '国内', 10, 8, (i) => `商务部推进县域消费活力 ${i}`),
    ...xwlbRows,
  ],
  { now: Date.parse('2026-08-19T21:00:00+08:00'), limit: 40 },
)
assert(
  withTv[0].channel === 'xwlb' || withTv[0].title.includes('习近平'),
  `新闻联播分条排在网页县域新闻前, got ${withTv[0].title}`,
)

if (failed) {
  console.error(`cctv news smoke: ${failed} failed`)
  process.exit(1)
}
console.log('cctv news smoke: ok')
