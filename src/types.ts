export type SecurityProtocol = 'WPA3' | 'WPA2/WPA3' | 'WPA2' | 'WPA' | 'WEP' | 'Open' | 'Unknown'
export type AuditLevel = 'excellent' | 'good' | 'attention' | 'critical' | 'untested'

export interface NetworkAudit {
  score: number
  level: Exclude<AuditLevel, 'untested'>
  guesses: number
  crackTime: string
  testedAt: string
  findings: string[]
}

export interface WifiNetwork {
  id: string
  ssid: string
  bssid?: string
  signal: number
  channel: number
  frequency?: number
  security: SecurityProtocol
  connected?: boolean
  owned: boolean
  audit?: NetworkAudit
  isDemo?: boolean
}

export interface ScanNetwork {
  ssid: string
  bssid?: string
  signal?: number
  channel?: number
  frequency?: number
  security?: string
  connected?: boolean
}

export interface PasswordAnalysis {
  score: number
  level: Exclude<AuditLevel, 'untested'>
  guesses: number
  entropyBits: number
  offlineRate: number
  crackSeconds: number
  crackTime: string
  onlineTime: string
  label: string
  findings: string[]
  suggestions: string[]
  checks: {
    length: boolean
    mixedCase: boolean
    numbers: boolean
    symbols: boolean
    noCommonPattern: boolean
  }
}

export type ViewId = 'overview' | 'networks' | 'password' | 'report' | 'privacy'
