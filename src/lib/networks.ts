import type { ScanNetwork, SecurityProtocol, WifiNetwork } from '../types'

export function normalizeSecurity(value = 'Unknown'): SecurityProtocol {
  const security = value.toUpperCase()
  if (!security || security === 'OPEN' || security === '--') return 'Open'
  if ((security.includes('WPA3') || security.includes('SAE')) && security.includes('WPA2')) return 'WPA2/WPA3'
  if (security.includes('WPA3') || security.includes('SAE')) return 'WPA3'
  if (security.includes('WPA2')) return 'WPA2'
  if (security.includes('WPA') && !security.includes('WPA2')) return 'WPA'
  if (security.includes('WEP')) return 'WEP'
  return 'Unknown'
}

export function maskBssid(bssid?: string) {
  if (!bssid) return undefined
  const parts = bssid.split(/[:-]/)
  if (parts.length < 6) return '••:••:••:••:••:••'
  return `••:••:••:${parts.slice(-3).join(':').toUpperCase()}`
}

export function networkFromScan(item: ScanNetwork): WifiNetwork {
  const idSource = `${item.ssid}|${item.bssid || item.channel || crypto.randomUUID()}`
  let hash = 0
  for (const char of idSource) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  return {
    id: `net-${Math.abs(hash).toString(36)}`,
    ssid: String(item.ssid || 'شبكة مخفية').slice(0, 64),
    bssid: maskBssid(item.bssid),
    signal: Math.max(0, Math.min(100, Number(item.signal) || 0)),
    channel: Math.max(0, Number(item.channel) || 0),
    frequency: item.frequency ? Number(item.frequency) : undefined,
    security: normalizeSecurity(item.security),
    connected: Boolean(item.connected),
    owned: false,
  }
}

export function bandLabel(network: WifiNetwork) {
  if (network.frequency && network.frequency >= 5925) return '6 GHz'
  if ((network.frequency && network.frequency >= 4900) || network.channel > 14) return '5 GHz'
  return '2.4 GHz'
}

export function signalLabel(signal: number) {
  if (signal >= 80) return 'ممتازة'
  if (signal >= 60) return 'جيدة'
  if (signal >= 40) return 'متوسطة'
  return 'ضعيفة'
}

export function protocolScore(security: SecurityProtocol) {
  switch (security) {
    case 'WPA3': return 100
    case 'WPA2/WPA3': return 88
    case 'WPA2': return 76
    case 'WPA': return 28
    case 'WEP': return 8
    case 'Open': return 0
    default: return 45
  }
}

export function protocolLabel(security: SecurityProtocol) {
  switch (security) {
    case 'WPA3': return 'قوية جدًا'
    case 'WPA2/WPA3': return 'قوية'
    case 'WPA2': return 'جيدة'
    case 'WPA':
    case 'WEP': return 'ضعيفة'
    case 'Open': return 'منعدمة'
    default: return 'غير معروفة'
  }
}

export function overallNetworkScore(network: WifiNetwork) {
  const protocol = protocolScore(network.security)
  if (!network.audit) return protocol
  return Math.round(protocol * 0.4 + network.audit.score * 0.6)
}
