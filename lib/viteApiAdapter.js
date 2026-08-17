/**
 * Adapt Vercel-style (req,res) handlers for Vite connect middleware.
 */
import { Readable } from 'node:stream'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve({ raw })
      }
    })
    req.on('error', reject)
  })
}

export function mountVercelHandler(handler, { match }) {
  return async (req, res, next) => {
    const url = req.url || ''
    if (!match(url, req.method)) return next()

    try {
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        req.body = await readBody(req)
      } else {
        req.body = {}
      }
      // minimal query parse
      const qi = url.indexOf('?')
      const qs = qi >= 0 ? new URLSearchParams(url.slice(qi + 1)) : new URLSearchParams()
      req.query = Object.fromEntries(qs.entries())

      const fakeRes = {
        statusCode: 200,
        headers: {},
        setHeader(k, v) {
          this.headers[k] = v
          try {
            res.setHeader(k, v)
          } catch {
            /* ignore */
          }
        },
        status(code) {
          this.statusCode = code
          res.statusCode = code
          return this
        },
        json(obj) {
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.statusCode = this.statusCode || 200
            res.end(JSON.stringify(obj))
          }
          return this
        },
        end(data) {
          if (!res.headersSent) {
            res.statusCode = this.statusCode || 200
            res.end(data ?? '')
          }
          return this
        },
      }

      await handler(req, fakeRes)
      if (!res.writableEnded && !res.headersSent) {
        res.statusCode = fakeRes.statusCode || 200
        res.end('')
      }
    } catch (e) {
      console.error('[vite-api]', e)
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'server_error', message: e?.message || 'error' }))
      }
    }
  }
}

export { Readable }
