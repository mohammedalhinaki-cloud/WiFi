import http from 'node:http'
import process from 'node:process'
import { scanWifi } from './wifi-scan.mjs'

const port = Number(process.env.WIFI_SCAN_PORT || 8787)
const host = process.env.WIFI_SCAN_HOST || '127.0.0.1'
const configuredOrigins = (process.env.WIFI_SCAN_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

function corsOrigin(requestOrigin) {
  // The server binds to loopback by default and only returns public broadcast
  // metadata. Allowing a browser origin makes it possible to use the static
  // GitHub Pages UI with this local companion process. Set WIFI_SCAN_ORIGINS
  // in shared environments to use an explicit allow-list instead.
  if (!requestOrigin) return '*'
  if (!configuredOrigins.length || configuredOrigins.includes('*')) return requestOrigin
  return configuredOrigins.includes(requestOrigin) ? requestOrigin : ''
}

function sendJson(response, statusCode, payload, origin = '') {
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Vary', 'Origin')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Accept')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.statusCode = statusCode
  response.end(JSON.stringify(payload))
}

const server = http.createServer(async (request, response) => {
  const origin = corsOrigin(request.headers.origin)
  if (request.headers.origin && !origin) {
    sendJson(response, 403, { error: 'هذا المصدر غير مصرح له بالوصول إلى مساعد المسح.', code: 'ORIGIN_NOT_ALLOWED' })
    return
  }

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {}, origin)
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
