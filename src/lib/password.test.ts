import { describe, expect, it } from 'vitest'
import { analyzePassword, formatDuration } from './password'

describe('password analyser', () => {
  it('flags short and common Wi-Fi passwords', async () => {
    const result = await analyzePassword('wifi1234', 'Home', 'WPA2')
    expect(result.score).toBeLessThan(35)
    expect(result.level).toBe('critical')
    expect(result.label).toBe('ضعيفة')
    expect(result.findings.some((finding) => finding.includes('توقع'))).toBe(true)
  })

  it('rewards long random-looking passwords', async () => {
    const result = await analyzePassword('T9!mQ2#vL8@pX4$kR7&zN5', 'Studio', 'WPA2')
    expect(result.score).toBeGreaterThanOrEqual(85)
    expect(result.label).toBe('قوية جدًا')
    expect(result.checks.length).toBe(true)
    expect(result.checks.noCommonPattern).toBe(true)
  })

  it('penalises passwords containing the SSID', async () => {
    const result = await analyzePassword('Bayt_5G-2026!', 'Bayt_5G', 'WPA2')
    expect(result.findings.some((finding) => finding.includes('اسم شبكة'))).toBe(true)
  })

  it('uses a slower conservative rate for WPA3', async () => {
    const wpa2 = await analyzePassword('T9!mQ2#vL8@pX4$kR7', 'Test', 'WPA2')
    const wpa3 = await analyzePassword('T9!mQ2#vL8@pX4$kR7', 'Test', 'WPA3')
    expect(wpa3.crackSeconds).toBeGreaterThan(wpa2.crackSeconds)
  })
})

describe('duration formatter', () => {
  it('formats short durations in Arabic', () => {
    expect(formatDuration(35)).toContain('ثانية')
    expect(formatDuration(120)).toContain('دقيقة')
  })
})
