import type { PasswordAnalysis, SecurityProtocol } from '../types'

const WIFI_TERMS = [
  'password', 'passw0rd', 'qwerty', 'admin', 'internet', 'wifi', 'wireless', 'router',
  '12345678', '123456789', '87654321', 'letmein', 'welcome', 'iloveyou', 'abc12345',
  'كلمةالمرور', 'انترنت', 'واي فاي', 'الشبكة', 'مرحبا', 'السعودية', 'الرياض',
]

const ARABIC_TRANSLITERATIONS = ['marhaba', 'alsalam', 'riyadh', 'saudi', 'habibi', 'mohammed', 'abdullah']

export const OFFLINE_RATES: Record<SecurityProtocol, number> = {
  WPA3: 10,
  'WPA2/WPA3': 1_000,
  WPA2: 100_000,
  WPA: 300_000,
  WEP: 1_000_000,
  Open: 1,
  Unknown: 100_000,
}

function hasCommonWifiPattern(password: string, ssid: string) {
  const normalized = password.toLocaleLowerCase().replace(/[\s_-]/g, '')
  const normalizedSsid = ssid.toLocaleLowerCase().replace(/[\s_-]/g, '')
  return WIFI_TERMS.some((term) => normalized.includes(term.replace(/\s/g, ''))) ||
    ARABIC_TRANSLITERATIONS.some((term) => normalized.includes(term)) ||
    (normalizedSsid.length >= 4 && normalized.includes(normalizedSsid))
}

function hasSequence(password: string) {
  const value = password.toLocaleLowerCase()
  const sequences = ['0123456789', '9876543210', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl']
  return sequences.some((sequence) => {
    for (let index = 0; index <= sequence.length - 4; index += 1) {
      if (value.includes(sequence.slice(index, index + 4))) return true
    }
    return false
  })
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds > 3.154e14) return 'أكثر من 10 ملايين سنة'
  if (seconds < 1) return 'أقل من ثانية'
  if (seconds < 60) return `${Math.ceil(seconds)} ثانية`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} دقيقة`
  if (seconds < 86_400) return `${Math.ceil(seconds / 3600)} ساعة`
  if (seconds < 2_592_000) return `${Math.ceil(seconds / 86_400)} يومًا`
  if (seconds < 31_536_000) return `${Math.ceil(seconds / 2_592_000)} شهرًا`
  const years = seconds / 31_536_000
  if (years > 10_000) return 'أكثر من 10 آلاف سنة'
  return `${new Intl.NumberFormat('ar-SA', { maximumFractionDigits: years < 10 ? 1 : 0 }).format(years)} سنة`
}

function mapLevel(score: number): PasswordAnalysis['level'] {
  if (score >= 85) return 'excellent'
  if (score >= 65) return 'good'
  if (score >= 35) return 'attention'
  return 'critical'
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function translateWarning(warning: string) {
  const value = warning.toLowerCase()
  if (!value) return ''
  if (value.includes('key') || value.includes('keyboard')) return 'تتضمن نمطًا متجاورًا على لوحة المفاتيح.'
  if (value.includes('repeat')) return 'التكرار المنتظم سهل التوقع.'
  if (value.includes('sequence')) return 'التسلسلات المعروفة سهلة التوقع.'
  if (value.includes('year') || value.includes('date')) return 'التواريخ والسنوات من أول الأنماط التي تُجرّب.'
  if (value.includes('name') || value.includes('common') || value.includes('word')) return 'تتضمن كلمة أو اسمًا شائعًا يسهل توقعه.'
  return 'اكتشف المحلل نمطًا معروفًا يقلل قوة العبارة.'
}

function translateSuggestion(suggestion: string) {
  const value = suggestion.toLowerCase()
  if (value.includes('word')) return 'أضف كلمات عشوائية غير مترابطة لزيادة الطول.'
  if (value.includes('repeat')) return 'تجنب الكلمات والمحارف المتكررة.'
  if (value.includes('sequence')) return 'تجنب التسلسلات الأبجدية والرقمية.'
  if (value.includes('year') || value.includes('date')) return 'تجنب السنوات والتواريخ المرتبطة بك.'
  if (value.includes('capital') || value.includes('uppercase')) return 'لا تعتمد على تحويل أول حرف أو كل الحروف إلى كبيرة فقط.'
  if (value.includes('substitution')) return 'استبدال الحروف بأرقام شائعة مثل a→4 لا يضيف حماية كافية.'
  return 'زد الطول واستخدم كلمات أو محارف عشوائية غير مترابطة.'
}

export async function analyzePassword(password: string, ssid: string, security: SecurityProtocol): Promise<PasswordAnalysis> {
  // The comparatively large dictionary is fetched only when an audit starts, keeping startup fast.
  const { default: zxcvbn } = await import('zxcvbn')
  const result = zxcvbn(password, [...WIFI_TERMS, ...ARABIC_TRANSLITERATIONS, ssid])
  const common = hasCommonWifiPattern(password, ssid)
  const sequence = hasSequence(password)
  const repeated = /(.)\1{2,}/u.test(password) || /^(.{1,4})\1{2,}$/u.test(password)
  const hasLower = /[a-z\p{Ll}]/u.test(password)
  const hasUpper = /[A-Z\p{Lu}]/u.test(password)
  const hasNumbers = /\d/u.test(password)
  const hasSymbols = /[^\p{L}\d\s]/u.test(password)
  const wifiValidLength = password.length >= 8 && password.length <= 63

  let score = result.score * 22 + 8
  if (password.length >= 16) score += 7
  if (password.length >= 20) score += 5
  if (common) score -= 24
  if (sequence) score -= 14
  if (repeated) score -= 12
  if (!wifiValidLength) score = Math.min(score, 18)
  score = Math.max(0, Math.min(100, Math.round(score)))

  const guesses = Math.max(1, result.guesses)
  const offlineRate = OFFLINE_RATES[security]
  const crackSeconds = guesses / offlineRate / 2
  const entropyBits = Math.max(0, Math.log2(guesses))
  const findings: string[] = []
  const suggestions: string[] = []

  if (!wifiValidLength) findings.push(password.length < 8 ? 'أقصر من الحد الأدنى لعبارة WPA (8 محارف).' : 'أطول من الحد القياسي لعبارة WPA (63 محرفًا).')
  if (common) findings.push('تتضمن كلمة أو اسم شبكة يسهل توقعه.')
  if (sequence) findings.push('تحتوي تسلسلًا معروفًا مثل 1234 أو qwerty.')
  if (repeated) findings.push('تحتوي محارف أو مقاطع متكررة.')
  if (password.length < 16) findings.push('الطول أقل من توصيتنا البالغة 16 محرفًا.')
  if (result.feedback.warning) findings.push(translateWarning(result.feedback.warning))

  if (password.length < 16) suggestions.push('استخدم 16 محرفًا على الأقل، ويفضل 20 أو أكثر.')
  if (!(hasLower && hasUpper && hasNumbers && hasSymbols)) suggestions.push('امزج حروفًا وأرقامًا ورموزًا، أو استخدم عبارة طويلة من كلمات عشوائية.')
  if (common || sequence || repeated) suggestions.push('ابتعد عن أسماء الأشخاص والمدن والشبكة والتواريخ والتسلسلات.')
  if (security === 'WEP' || security === 'WPA') suggestions.push('حدّث إعداد الراوتر إلى WPA2-AES أو WPA3؛ قوة العبارة وحدها لا تصلح بروتوكولًا قديمًا.')
  if (security === 'Open') suggestions.push('فعّل WPA3 أو WPA2-AES؛ الشبكة المفتوحة لا تحمي حركة الاتصال.')
  if (result.feedback.suggestions.length) suggestions.push(...result.feedback.suggestions.map(translateSuggestion))
  if (!suggestions.length) suggestions.push('العبارة قوية. احتفظ بها في مدير كلمات مرور ولا تعد استخدامها.')

  return {
    score,
    level: mapLevel(score),
    guesses,
    entropyBits,
    offlineRate,
    crackSeconds,
    crackTime: security === 'WPA3' ? `تقدير محافظ: ${formatDuration(crackSeconds)}` : formatDuration(crackSeconds),
    onlineTime: formatDuration(guesses / 10 / 2),
    label: score >= 85 ? 'ممتازة' : score >= 65 ? 'جيدة' : score >= 35 ? 'تحتاج تحسينًا' : 'ضعيفة جدًا',
    findings: unique(findings),
    suggestions: unique(suggestions),
    checks: {
      length: password.length >= 16,
      mixedCase: hasLower && hasUpper,
      numbers: hasNumbers,
      symbols: hasSymbols,
      noCommonPattern: !common && !sequence && !repeated,
    },
  }
}

export function generateStrongPassword(length = 22) {
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const numbers = '23456789'
  const symbols = '!@#$%&*+-=?'
  const all = lower + upper + numbers + symbols
  const required = [lower, upper, numbers, symbols].map((set) => randomFrom(set))
  const rest = Array.from({ length: Math.max(16, length) - required.length }, () => randomFrom(all))
  const chars = [...required, ...rest]
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = secureRandom(index + 1)
    ;[chars[index], chars[swap]] = [chars[swap], chars[index]]
  }
  return chars.join('')
}

function secureRandom(max: number) {
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const values = new Uint32Array(1)
  do crypto.getRandomValues(values)
  while (values[0] >= limit)
  return values[0] % max
}

function randomFrom(set: string) {
  return set[secureRandom(set.length)]
}

export { formatDuration }
