import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { handleProxyHttp } from './lib/proxyCore.js'
import { mountVercelHandler } from './lib/viteApiAdapter.js'
import authHandler from './api/auth.js'
import holdingsLocalHandler from './api/holdingsLocal.js'
import vaultHandler from './api/vault.js'
import billingHandler from './api/billing.js'
import adminHandler from './api/admin.js'
import usageHandler from './api/usage.js'
import cctvNewsHandler from './api/cctv-news.js'

/** Same /api/proxy allowlist handler for Vite dev + preview (matches Vercel). */
function findigestApiProxy() {
  const mount = (server) => {
    server.middlewares.use((req, res, next) => {
      const url = req.url || ''
      if (!url.startsWith('/api/proxy')) return next()
      handleProxyHttp(req, res, { method: req.method, url }).catch((err) => {
        if (!res.headersSent) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              status: 500,
              code: 'proxy_internal',
              message: err?.message || 'proxy error',
            }),
          )
        }
      })
    })
    server.middlewares.use(
      mountVercelHandler(authHandler, {
        match: (url) => url.startsWith('/api/auth'),
      }),
    )
    server.middlewares.use(
      mountVercelHandler(vaultHandler, {
        match: (url) => url.startsWith('/api/vault'),
      }),
    )
    server.middlewares.use(
      mountVercelHandler(billingHandler, {
        match: (url) => url.startsWith('/api/billing'),
      }),
    )
    server.middlewares.use(
      mountVercelHandler(adminHandler, {
        match: (url) => url.startsWith('/api/admin'),
      }),
    )
    server.middlewares.use(
      mountVercelHandler(usageHandler, {
        match: (url) => url.startsWith('/api/usage'),
      }),
    )
    server.middlewares.use(
      mountVercelHandler(holdingsLocalHandler, {
        match: (url) => url.startsWith('/api/holdings-local'),
      }),
    )
    server.middlewares.use(
      mountVercelHandler(cctvNewsHandler, {
        match: (url) => url.startsWith('/api/cctv-news'),
      }),
    )
  }
  return {
    name: 'findigest-api-proxy',
    configureServer: mount,
    configurePreviewServer: mount,
  }
}

export default defineConfig(({ mode }) => {
  // Ensure ALIYUN_* / EMAIL_* from .env are on process.env for /api/auth in Vite.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v
  }

  return {
    // GitHub Pages 子路径：BASE_PATH=/FinDigest/ npm run build
    base: process.env.BASE_PATH || '/',
    plugins: [vue(), findigestApiProxy()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      open: true,
      watch: {
        ignored: ['**/video_work/**'],
      },
    },
    preview: {
      port: 4173,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const norm = id.replace(/\\/g, '/')
            if (norm.includes('/node_modules/')) {
              if (norm.includes('/echarts')) return 'vendor-echarts'
              if (
                norm.includes('/vue/') ||
                norm.includes('/vue-router/') ||
                norm.includes('/pinia/') ||
                norm.includes('/@vue/')
              ) {
                return 'vendor-vue'
              }
            }
            if (norm.includes('/src/data/stock_financials')) return 'data-financials'
            if (norm.includes('/src/data/consensus_data')) return 'data-consensus'
            if (norm.includes('/src/data/current_prices')) return 'data-prices'
            if (norm.includes('/src/services/profiling')) return 'profiling'
          },
        },
      },
      minify: true,
      sourcemap: false,
      chunkSizeWarningLimit: 500,
    },
  }
})
