import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { scanWifi } from './tools/wifi-scan.mjs'

function localWifiScanner(): Plugin {
  const handler = async (_request: unknown, response: { statusCode: number; setHeader: (key: string, value: string) => void; end: (body: string) => void }) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    try {
      const result = await scanWifi()
      response.statusCode = 200
      response.end(JSON.stringify(result))
    } catch (error) {
      response.statusCode = 503
      response.end(JSON.stringify({
        error: error instanceof Error ? error.message : 'تعذّر فحص الشبكات.',
        code: 'SCAN_UNAVAILABLE',
      }))
    }
  }

  return {
    name: 'mersad-local-wifi-scanner',
    configureServer(server) {
      server.middlewares.use('/api/scan', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/scan', handler)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), localWifiScanner()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // zxcvbn's dictionaries are intentionally isolated in a lazy chunk loaded only during analysis.
    chunkSizeWarningLimit: 900,
  },
})
