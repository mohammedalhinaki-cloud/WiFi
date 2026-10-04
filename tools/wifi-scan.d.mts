export interface ScanResult {
  networks: Array<{
    ssid: string
    bssid?: string
    signal: number
    channel: number
    frequency?: number
    security: string
    connected: boolean
  }>
  scannedAt: string
  source: string
  notice: string
}
export function scanWifi(): Promise<ScanResult>
