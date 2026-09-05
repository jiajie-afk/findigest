import { createRouter, createWebHistory } from 'vue-router'
import { getSession, ensureLocalGuestSession, isGuestSession } from '@/services/vault.js'
import { resolvePostAuthPath } from '@/store/user.js'

const routes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/Landing.vue'),
    meta: { title: '价值投资的研究台', hideNav: true, public: true },
  },
  {
    path: '/auth',
    name: 'auth',
    component: () => import('@/views/Auth.vue'),
    meta: { title: '登录', hideNav: true, public: true },
  },
  {
    path: '/onboarding/edition',
    redirect: '/app?edition=pro',
  },
  {
    path: '/app',
    name: 'butler',
    component: () => import('@/views/ButlerHome.vue'),
    meta: { title: '今日', requiresAuth: true },
  },
  {
    path: '/more',
    name: 'more',
    component: () => import('@/views/MoreHub.vue'),
    meta: { title: '我的', requiresAuth: true },
  },
  {
    path: '/pricing',
    redirect: '/app?edition=pro',
  },
  {
    path: '/workspace',
    name: 'dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '工作区', requiresAuth: true },
  },
  { path: '/portfolio', name: 'portfolio', component: () => import('@/views/Portfolio.vue'), meta: { title: '持仓', requiresAuth: true } },
  { path: '/stock/:code', name: 'stock', component: () => import('@/views/Stock.vue'), meta: { title: '个股', requiresAuth: true } },
  { path: '/events', name: 'events', component: () => import('@/views/Events.vue'), meta: { title: '事件', requiresAuth: true } },
  { path: '/reports', name: 'reports', component: () => import('@/views/Reports.vue'), meta: { title: '报告', requiresAuth: true } },
  { path: '/passport', name: 'passport', component: () => import('@/views/ProfilePassport.vue'), meta: { title: '画像说明书', requiresAuth: true } },
  { path: '/settings', name: 'settings', component: () => import('@/views/Settings.vue'), meta: { title: '设置', requiresAuth: true } },
  {
    path: '/ops',
    name: 'ops',
    component: () => import('@/views/OpsConsole.vue'),
    meta: { title: '控制台', hideNav: true, public: true },
  },
  { path: '/admin', redirect: '/ops' },
  {
    path: '/limits',
    name: 'limits',
    component: () => import('@/views/KnownLimits.vue'),
    meta: { title: '已知局限', hideNav: true, public: true },
  },
  {
    path: '/connect/:broker(eastmoney|ths)',
    name: 'broker-connect',
    component: () => import('@/views/BrokerConnect.vue'),
    props: true,
    meta: { title: '券商官方登录', hideNav: true, public: true },
  },
  {
    path: '/preview/prodesk',
    redirect: '/app?edition=pro',
  },
  {
    path: '/preview/basic',
    redirect: '/app?edition=pro',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  let session = getSession()
  if (to.meta.requiresAuth && !session?.accountId) {
    session = ensureLocalGuestSession()
  }
  const loggedIn = !!session?.accountId
  const guest = isGuestSession(session)
  if (to.name === 'auth' && loggedIn && !guest) {
    return { path: resolvePostAuthPath(to.query.redirect) }
  }
  return true
})

router.afterEach((to) => {
  document.title =
    to.name === 'landing'
      ? 'FinDigest · 价值投资的研究台'
      : to.meta.title
        ? `${to.meta.title} · FinDigest`
        : 'FinDigest'
})

export default router
