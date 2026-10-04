import { describe, expect, it } from 'vitest'
import { analyzePassword, formatDuration, generateStrongPassword, simulateTargetedGuessing } from './password'

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
    expect(wpa3.model).toContain('SAE')
  })

  it('analyses related words, sequences, repetition, and the search space', async () => {
    const result = await analyzePassword('ParisParis2024', 'Studio', 'WPA2', 'Paris, owner')
    expect(result.metrics.contextualMatches).toBeGreaterThan(0)
    expect(result.metrics.repeated).toBe(true)
    expect(result.metrics.predictable).toBe(true)
    expect(result.possibleCombinations).toBeGreaterThan(0)
    expect(result.searchSpaceBits).toBeGreaterThan(0)
    expect(result.suggestions.length).toBeGreaterThan(0)
  })

  it('generates a fresh WPA-compatible password with Web Crypto', () => {
    const generated = generateStrongPassword(24)
    expect(generated).toHaveLength(24)
    expect(generated).toMatch(/[a-z]/)
    expect(generated).toMatch(/[A-Z]/)
    expect(generated).toMatch(/[2-9]/)
    expect(generated).toMatch(/[!@#$%&*+\-=?]/)
  })

  it('runs concrete context-aware guesses against the in-memory reference', () => {
    const result = simulateTargetedGuessing('Home_5G@123', 'Home_5G', '', 5_000)
    expect(result.matched).toBe(true)
    expect(result.matchedAt).toBeGreaterThan(0)
    expect(result.matchedAt).toBeLessThanOrEqual(5_000)
    expect(result.matchedBy).toContain('سياقي')
    expect(result.guessesPerSecond).toBeGreaterThan(0)
  })

  it('stops an unmatched simulation exactly at its configured budget', () => {
    const result = simulateTargetedGuessing('Truly-Random-Reference-99!', 'Studio', '', 500)
    expect(result.matched).toBe(false)
    expect(result.attempted).toBe(500)
    expect(result.maxGuesses).toBe(500)
  })
})

describe('duration formatter', () => {
  it('formats short durations in Arabic', () => {
    expect(formatDuration(35)).toContain('ثانية')
    expect(formatDuration(120)).toContain('دقيقة')
  })
})
