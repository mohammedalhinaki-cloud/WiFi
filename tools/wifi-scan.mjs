import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const execFileAsync = promisify(execFile)
const EXEC_OPTIONS = { timeout: 20_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true }

function splitEscaped(line, separator = ':') {
  const fields = []
  let current = ''
  let escaped = false
  for (const char of line) {
    if (escaped) {
      current += char
      escaped = false
    } else if (char === '\\') {
      escaped = true
    } else if (char === separator) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

function normalizeSecurity(raw = '') {
  const value = raw.toUpperCase()
  if (!value || value === '--' || value.includes('OPEN')) return 'Open'
  if (value.includes('WPA3') || value.includes('SAE')) return value.includes('WPA2') ? 'WPA2/WPA3' : 'WPA3'
  if (value.includes('WPA2')) return 'WPA2'
  if (value.includes('WPA1') || value === 'WPA') return 'WPA'
  if (value.includes('WEP')) return 'WEP'
  return raw.trim() || 'Unknown'
}

function deduplicate(networks) {
  const unique = new Map()
  for (const network of networks) {
    const key = network.bssid || `${network.ssid}|${network.channel}`
    const existing = unique.get(key)
    if (!existing || network.signal > existing.signal) unique.set(key, network)
  }
  return [...unique.values()].sort((a, b) => b.signal - a.signal)
}

async function scanLinux() {
  let stdout
  try {
    ;({ stdout } = await execFileAsync(
      'nmcli',
      ['-t', '-f', 'IN-USE,SSID,BSSID,SIGNAL,CHAN,FREQ,SECURITY', 'device', 'wifi', 'list', '--rescan', 'yes'],
      EXEC_OPTIONS,
    ))
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('تعذّر العثور على nmcli. ثبّت NetworkManager أو أضف الشبكات يدويًا.')
    }
    throw new Error(`تعذّر المسح عبر NetworkManager: ${error?.stderr?.trim() || error.message}`)
  }

  const networks = stdout.split(/\r?\n/).filter(Boolean).map((line) => {
    const [active, ssid, bssid, signal, channel, frequency, security] = splitEscaped(line)
    return {
      ssid: ssid || 'شبكة مخفية',
      bssid,
      signal: Number(signal) || 0,
      channel: Number(channel) || 0,
      frequency: Number(frequency) || undefined,
      security: normalizeSecurity(security),
      connected: active === '*',
    }
  })
  return deduplicate(networks)
}

async function scanMacOS() {
  const airport = '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport'
  let stdout
  try {
    ;({ stdout } = await execFileAsync(airport, ['-s'], EXEC_OPTIONS))
  } catch (error) {
    throw new Error('أداة airport غير متاحة في هذا الإصدار من macOS. أضف الشبكات يدويًا أو صدّر نتيجة المسح كملف JSON.')
  }

  const networks = []
  for (const line of stdout.split(/\r?\n/).slice(1)) {
    const match = line.match(/^\s*(.*?)\s+([0-9a-f]{2}(?::[0-9a-f]{2}){5})\s+(-?\d+)\s+([\d,+-]+)\s+\S+\s+\S+\s+(.*)$/i)
    if (!match) continue
    const [, ssid, bssid, rssi, channel, security] = match
    const signal = Math.max(0, Math.min(100, 2 * (Number(rssi) + 100)))
    networks.push({ ssid: ssid || 'شبكة مخفية', bssid, signal, channel: Number.parseInt(channel, 10), security: normalizeSecurity(security), connected: false })
  }
  return deduplicate(networks)
}

function parseWindows(stdout) {
  const networks = []
  let ssid = ''
  let authentication = ''
  let current = null

  for (const line of stdout.split(/\r?\n/)) {
    const ssidMatch = line.match(/^\s*SSID\s+\d+\s*:\s*(.*)$/i) || line.match(/^\s*معرّف SSID\s+\d+\s*:\s*(.*)$/i)
    if (ssidMatch) {
      ssid = ssidMatch[1].trim() || 'شبكة مخفية'
      authentication = ''
      continue
    }
    const authMatch = line.match(/^\s*Authentication\s*:\s*(.*)$/i) || line.match(/^\s*المصادقة\s*:\s*(.*)$/i)
    if (authMatch) {
      authentication = authMatch[1].trim()
      continue
    }
    const bssidMatch = line.match(/^\s*BSSID\s+\d+\s*:\s*([0-9a-f:.-]+)$/i)
    if (bssidMatch) {
      current = { ssid, bssid: bssidMatch[1], signal: 0, channel: 0, security: normalizeSecurity(authentication), connected: false }
      networks.push(current)
      continue
    }
    if (!current) continue
    const signalMatch = line.match(/^\s*(?:Signal|الإشارة)\s*:\s*(\d+)%/i)
    if (signalMatch) current.signal = Number(signalMatch[1])
    const channelMatch = line.match(/^\s*(?:Channel|القناة)\s*:\s*(\d+)/i)
    if (channelMatch) current.channel = Number(channelMatch[1])
  }
  return deduplicate(networks)
}

async function scanWindows() {
  try {
    const { stdout } = await execFileAsync('netsh', ['wlan', 'show', 'networks', 'mode=bssid'], { ...EXEC_OPTIONS, encoding: 'utf8' })
    return parseWindows(stdout)
  } catch (error) {
    throw new Error(`تعذّر المسح عبر netsh: ${error.message}`)
  }
}

export async function scanWifi() {
  let networks
  if (process.platform === 'linux') networks = await scanLinux()
  else if (process.platform === 'darwin') networks = await scanMacOS()
  else if (process.platform === 'win32') networks = await scanWindows()
  else throw new Error(`نظام التشغيل ${process.platform} غير مدعوم للمسح التلقائي.`)

  return {
    networks,
    scannedAt: new Date().toISOString(),
    source: process.platform,
    notice: 'يعرض المسح معلومات البث العامة فقط، ولا يحاول الاتصال أو كشف كلمات المرور.',
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  scanWifi()
    .then((result) => console.log(JSON.stringify(result, null, process.argv.includes('--pretty') ? 2 : 0)))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
