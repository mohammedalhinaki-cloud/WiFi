import http from 'node:http'
import process from 'node:process'
import { scanWifi } from './wifi-scan.mjs'

const port = Number(process.env.WIFI_SCAN_PORT || 8787)
const host = process.env.WIFI_SCAN_HOST || '127.0.0.1'
const configuredOrigins = (process.env.WIFI_SCAN_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

if (configuredOrigins.includes('*')) {
  console.warn('WIFI_SCAN_ORIGINS يجب أن يحتوي أصولًا صريحة، وليس *. سيتم رفضه.')
}

function isLoopbackOrigin(origin) {
  try {
    const hostname = new URL(origin).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}

function corsOrigin(requestOrigin) {
  // The helper is loopback-only, but a permissive CORS response would still
  // let any web page inventory a visitor's nearby SSIDs. Local development is
  // allowed by default; GitHub Pages and other remote origins must be named
  // explicitly in WIFI_SCAN_ORIGINS.
  if (!requestOrigin) return ''
  if (configuredOrigins.length) return configuredOrigins.includes(requestOrigin) ? requestOrigin : ''
  return isLoopbackOrigin(requestOrigin) ? requestOrigin : ''
}

function sendJson(response, statusCode, payload, origin = '', allowPrivateNetwork = false) {
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Vary', 'Origin, Access-Control-Request-Private-Network')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Accept')
  // Chromium may send this preflight when an HTTPS static page calls a
  // loopback helper. Only grant it after the origin passed corsOrigin().
  if (allowPrivateNetwork && origin) response.setHeader('Access-Control-Allow-Private-Network', 'true')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.statusCode = statusCode
  response.end(statusCode === 204 ? undefined : JSON.stringify(payload))
}

const server = http.createServer(async (request, response) => {
  const origin = corsOrigin(request.headers.origin)
  const wantsPrivateNetwork = request.headers['access-control-request-private-network'] === 'true'
  if (request.headers.origin && !origin) {
    sendJson(response, 403, { error: 'هذا المصدر غير مصرح له بالوصول إلى مساعد المسح.', code: 'ORIGIN_NOT_ALLOWED' })
    return
  }

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {}, origin, wantsPrivateNetwork)
    return
  }

  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  if (url.pathname !== '/api/scan') {
    sendJson(response, 404, { error: 'المسار غير موجود.', code: 'NOT_FOUND' }, origin)
    return
  }
  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'يسمح Endpoint المسح بطلبات GET فقط.', code: 'METHOD_NOT_ALLOWED' }, origin)
    return
  }

  try {
    const result = await scanWifi()
    sendJson(response, 200, result, origin)
  } catch (error) {
    sendJson(response, 503, {
      error: error instanceof Error ? error.message : 'تعذّر فحص الشبكات.',
      code: 'SCAN_UNAVAILABLE',
    }, origin)
  }
})

server.listen(port, host, () => {
  console.log(`Wi-Fi scan API listening at http://${host}:${port}/api/scan`)
  console.log('This process reads public Wi-Fi broadcast metadata only; it never connects to networks.')
})

function stop() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
