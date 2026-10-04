import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearScanEndpoint,
  getScanEndpoint,
  isGitHubPagesHost,
  requestScan,
  ScanApiError,
  setScanEndpoint,
} from './scanApi'

afterEach(() => {
  clearScanEndpoint()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('scan API boundary', () => {
  it('recognises GitHub Pages hosts', () => {
    expect(isGitHubPagesHost('owner.github.io')).toBe(true)
    expect(isGitHubPagesHost('GITHUB.IO.')).toBe(true)
    expect(isGitHubPagesHost('localhost')).toBe(false)
  })

  it('rejects an HTML SPA fallback before treating it as JSON', async () => {
    vi.stubGlobal('window', { location: { protocol: 'https:', hostname: 'owner.github.io' } })
    vi.stubGlobal('fetch', vi.fn())

    await expect(requestScan()).rejects.toMatchObject({
      code: 'SCAN_STATIC_HOST',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('supports a runtime scanner endpoint for a static deployment', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      location: { protocol: 'https:', hostname: 'owner.github.io' },
      localStorage: {
        getItem: (key: string) => values.get(key) || null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    })

    expect(setScanEndpoint('http://127.0.0.1:8787/api/scan')).toBe('http://127.0.0.1:8787/api/scan')
    expect(getScanEndpoint()).toBe('http://127.0.0.1:8787/api/scan')
    clearScanEndpoint()
    expect(getScanEndpoint()).toBe('/api/scan')
  })

  it('does not persist endpoint credentials or fragments', () => {
    expect(() => setScanEndpoint('https://user:secret@scanner.example/api/scan')).toThrow('بلا بيانات دخول')
    expect(() => setScanEndpoint('https://scanner.example/api/scan#debug')).toThrow('بلا بيانات دخول')
  })

  it('reports a markup response without exposing a JSON parse exception', async () => {
    vi.stubGlobal('window', { location: { protocol: 'http:', hostname: 'localhost' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!DOCTYPE html>', {
      status: 200,
      // A proxy can incorrectly label a fallback page as JSON; inspect both
      // the declared type and the first body character.
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })))

    let error: unknown
    try {
      await requestScan()
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(ScanApiError)
    if (!(error instanceof ScanApiError)) throw error
    expect(error.code).toBe('SCAN_NOT_JSON')
    expect(error.message).toContain('HTML')
  })

  it('rejects a non-JSON content type even if its body is not HTML', async () => {
    vi.stubGlobal('window', { location: { protocol: 'http:', hostname: 'localhost' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('scanner unavailable', {
      status: 503,
      headers: { 'content-type': 'text/plain' },
    })))

    await expect(requestScan()).rejects.toMatchObject({ code: 'SCAN_NOT_JSON' })
  })

  it('accepts a JSON scan payload', async () => {
    vi.stubGlobal('window', { location: { protocol: 'http:', hostname: 'localhost' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ networks: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })))

    await expect(requestScan()).resolves.toMatchObject({ networks: [] })
  })
})
