import type { ScanNetwork } from '../types'

const DEFAULT_SCAN_ENDPOINT = '/api/scan'
const LOCAL_SCANNER_ENDPOINT = 'http://127.0.0.1:8787/api/scan'
const SCAN_ENDPOINT_STORAGE_KEY = 'mersad.wifi.scanEndpoint.v1'
let sessionEndpoint = ''

type ScanApiErrorCode =
  | 'SCAN_STATIC_HOST'
  | 'SCAN_NETWORK'
  | 'SCAN_NOT_JSON'
  | 'SCAN_INVALID_JSON'
  | 'SCAN_HTTP'
  | 'SCAN_INVALID_PAYLOAD'

export interface ScanPayload {
  networks: ScanNetwork[]
  scannedAt?: string
  source?: string
  notice?: string
}

export interface ScanCapability {
  available: boolean
  endpoint: string
  reason?: string
}

export class ScanApiError extends Error {
  readonly code: ScanApiErrorCode

  constructor(code: ScanApiErrorCode, message: string) {
    super(message)
    this.name = 'ScanApiError'
    this.code = code
  }
}

function getStoredEndpoint() {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage?.getItem(SCAN_ENDPOINT_STORAGE_KEY)?.trim() || ''
  } catch {
    return ''
  }
}

/**
 * Returns the endpoint selected at runtime, then the build-time endpoint, and
 * finally the Vite/Node companion route. Runtime configuration is important
 * for the static GitHub Pages build: users can connect it to a scanner running
 * on their own computer without rebuilding the UI.
 */
export function getScanEndpoint() {
  return sessionEndpoint || getStoredEndpoint() || import.meta.env.VITE_WIFI_SCAN_API?.trim() || DEFAULT_SCAN_ENDPOINT
}

export function getLocalScannerEndpoint() {
  return LOCAL_SCANNER_ENDPOINT
}

export function setScanEndpoint(value: string) {
  const endpoint = value.trim()
  if (!endpoint) throw new Error('أدخل عنوان Backend المسح.')
  const isRelativeEndpoint = endpoint.startsWith('/') && !endpoint.startsWith('//')
  const isAbsoluteEndpoint = /^https?:\/\//i.test(endpoint)
  if (!isRelativeEndpoint && !isAbsoluteEndpoint) {
    throw new Error('يجب أن يبدأ العنوان بـ / أو http:// أو https://.')
  }

  sessionEndpoint = endpoint
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem(SCAN_ENDPOINT_STORAGE_KEY, endpoint)
    } catch {
      // Private browsing can deny localStorage. sessionEndpoint still keeps
      // the endpoint available for the current page.
    }
  }
  return endpoint
}

export function clearScanEndpoint() {
  sessionEndpoint = ''
  if (typeof window === 'undefined') return
  try {
    window.localStorage?.removeItem(SCAN_ENDPOINT_STORAGE_KEY)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

function hasConfiguredEndpoint() {
  const endpoint = getScanEndpoint()
  return endpoint !== DEFAULT_SCAN_ENDPOINT
}

export function isGitHubPagesHost(hostname: string) {
  return hostname === 'github.io' || hostname.endsWith('.github.io')
}

/**
 * A browser cannot read nearby Wi-Fi adapters by itself. Scanning is only
 * possible when this page can reach a companion backend/native bridge.
 */
export function getScanCapability(): ScanCapability {
  const endpoint = getScanEndpoint()

  if (typeof window === 'undefined') {
    return {
      available: false,
      endpoint,
      reason: 'يتطلب المسح تشغيل الواجهة داخل متصفح مع Backend محلي.',
    }
  }

  if (window.location.protocol === 'file:') {
    return {
      available: false,
      endpoint,
      reason: 'هذه الصفحة مفتوحة كملف ثابت. شغّل npm run dev أو اربط Backend للمسح.',
    }
  }

  // GitHub Pages serves the SPA fallback as HTML and has no /api/scan route.
  // Do not make a request there unless the deployment explicitly configured a
  // separate scanner endpoint or the user connected the local companion API.
  const isKnownStaticDeployment = import.meta.env.VITE_STATIC_DEPLOYMENT === 'true'
  if (!hasConfiguredEndpoint() && (isKnownStaticDeployment || isGitHubPagesHost(window.location.hostname))) {
    return {
      available: false,
      endpoint,
      reason: 'نسخة GitHub Pages ثابتة ولا تحتوي Backend للمسح. شغّل مساعد المسح محليًا أو اربط Backend مستقلًا.',
    }
  }

  return { available: true, endpoint }
}

export async function requestScan(): Promise<ScanPayload> {
  const capability = getScanCapability()
  if (!capability.available) {
    throw new ScanApiError('SCAN_STATIC_HOST', capability.reason || 'Backend المسح غير متاح في هذه البيئة.')
  }

  let response: Response
  try {
    response = await fetch(capability.endpoint, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new ScanApiError('SCAN_NETWORK', 'تعذّر الوصول إلى Backend المسح. شغّل مساعد المسح أو تحقق من عنوان Backend.')
  }

  const contentType = response.headers.get('content-type') || ''
  const body = await response.text()

  // Calling response.json() directly was the source of the opaque
  // "Unexpected token '<'" error when a static host returned index.html.
  const looksLikeHtml = /^\s*<(?:!doctype\s+html|html[\s>])/i.test(body)
  if ((contentType && !contentType.toLowerCase().includes('json')) || looksLikeHtml) {
    throw new ScanApiError(
      'SCAN_NOT_JSON',
      'عنوان المسح أعاد HTML بدل JSON. غالبًا تم تشغيل النسخة الثابتة دون Backend للمسح.',
    )
  }

  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    throw new ScanApiError('SCAN_INVALID_JSON', 'استجابة Backend المسح ليست JSON صالحًا.')
  }

  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : `أعاد Backend المسح الحالة ${response.status}.`
    throw new ScanApiError('SCAN_HTTP', message)
  }

  if (!isRecord(payload) || !Array.isArray(payload.networks) || !payload.networks.every(isScanNetworkRecord)) {
    throw new ScanApiError('SCAN_INVALID_PAYLOAD', 'استجابة المسح صالحة شكليًا لكنها لا تحتوي networks صالحة.')
  }

  return {
    networks: payload.networks as ScanNetwork[],
    scannedAt: typeof payload.scannedAt === 'string' ? payload.scannedAt : undefined,
    source: typeof payload.source === 'string' ? payload.source : undefined,
    notice: typeof payload.notice === 'string' ? payload.notice : undefined,
  }
}

export function scanErrorTitle(error: unknown) {
  if (error instanceof ScanApiError) {
    if (error.code === 'SCAN_STATIC_HOST') return 'المسح التلقائي غير متاح في هذه النسخة'
    if (error.code === 'SCAN_NOT_JSON' || error.code === 'SCAN_INVALID_JSON') return 'Backend المسح لم يُرجع JSON'
    if (error.code === 'SCAN_HTTP') return 'تعذّر تنفيذ المسح من Backend'
  }
  return 'تعذّر الوصول إلى Backend المسح'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isScanNetworkRecord(value: unknown): value is ScanNetwork {
  return isRecord(value) && typeof value.ssid === 'string'
}
