import { describe, expect, it } from 'vitest'
import { maskBssid, networkFromScan, normalizeSecurity, overallNetworkScore } from './networks'

describe('network normalization', () => {
  it('normalizes common security labels', () => {
    expect(normalizeSecurity('WPA2 WPA3 SAE')).toBe('WPA2/WPA3')
    expect(normalizeSecurity('WPA2-PSK')).toBe('WPA2')
    expect(normalizeSecurity('--')).toBe('Open')
  })

  it('masks the vendor portion of BSSID', () => {
    expect(maskBssid('AA:BB:CC:12:34:56')).toBe('••:••:••:12:34:56')
  })

  it('creates a bounded scan record', () => {
    const network = networkFromScan({ ssid: 'Test', signal: 180, channel: 6, security: 'WPA2' })
    expect(network.signal).toBe(100)
    expect(network.owned).toBe(false)
  })

  it('weights password audit more than protocol score', () => {
    const score = overallNetworkScore({
      id: '1', ssid: 'Test', signal: 80, channel: 1, security: 'WPA2', owned: true,
      audit: { score: 100, level: 'excellent', guesses: 1e20, crackTime: 'طويل', testedAt: new Date().toISOString(), findings: [] },
    })
    expect(score).toBe(90)
  })
})
