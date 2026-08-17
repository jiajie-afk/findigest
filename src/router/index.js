import { createRouter, createWebHistory } from 'vue-router'
import { getSession } from '@/services/vault.js'
import { resolvePostAuthPath } from '@/store/user.js'

const routes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/Landing.vue'),
    meta: { title: '私人研究台', hideNav: true, public: true },
  },
  {
    path: '/auth',
    name: 'auth',
    component: () => import('@/views/Auth.vue'),
    meta: { title: '登录', hideNav: true, public: true },
  },
  {
    path: '/onboarding/edition',
    name: 'edition',
    component: () => import('@/views/EditionPicker.vue'),
    meta: { title: '选择版本', hideNav: true, requiresAuth: true, editionGate: true },
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
    name: 'pricing',
    component: () => import('@/views/Pricing.vue'),
    meta: { title: '开通 Pro', hideNav: true, public: true },
  },
  {
    path: '/workspace',
    name: 'dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '完整分析', requiresAuth: true },
  },
  { path: '/portfolio', name: 'portfolio', component: () => import('@/views/Portfolio.vue'), meta: { title: '持仓', requiresAuth: true } },
  { path: '/stock/:code', name: 'stock', component: () => import('@/views/Stock.vue'), meta: { title: '个股', requiresAuth: true } },
  { path: '/events', name: 'events', component: () => import('@/views/Events.vue'), meta: { title: '事件', requiresAuth: true } },
  { path: '/reports', name: 'reports', component: () => import('@/views/Reports.vue'), meta: { title: '报告', requiresAuth: true } },
  { path: '/passport', name: 'passport', component: () => import('@/views/ProfilePassport.vue'), meta: { title: '画像说明书', requiresAuth: true } },
  { path: '/settings', name: 'settings', component: () => import('@/views/Settings.vue'), meta: { title: '设置', requiresAuth: true } },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/Admin.vue'),
    meta: { title: '管理台', hideNav: true, public: true },
  },
  {
    path: '/limits',
    name: 'limits',
    component: () => import('@/views/KnownLimits.vue'),
    meta: { title: '已知局限', hideNav: true, public: true },
  },
  {
    path: '/preview/prodesk',
    name: 'preview-prodesk',
    component: () => import('@/views/PreviewProDesk.vue'),
    meta: { title: 'Pro Desk 预览', public: true },
  },
  {
    path: '/preview/basic',
    name: 'preview-basic',
    component: () => import('@/views/PreviewBasicDesk.vue'),
    meta: { title: '基础版预览', public: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const loggedIn = !!getSession()?.accountId
  if (to.meta.requiresAuth && !loggedIn) {
    return { path: '/auth', query: { redirect: to.fullPath } }
  }
  if (to.name === 'auth' && loggedIn) {
    return { path: resolvePostAuthPath(to.query.redirect) }
  }
  // Edition picker only when Settings explicitly requests change (?change=1)
  if (loggedIn && to.name === 'edition' && to.query.change !== '1') {
    return { path: '/app' }
  }
  return true
})

router.afterEach((to) => {
  document.title =
    to.name === 'landing'
      ? 'FinDigest · 私人研究台'
      : to.meta.title
        ? `${to.meta.title} · FinDigest`
        : 'FinDigest'
})

export default router
