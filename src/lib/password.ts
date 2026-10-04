import type { PasswordAnalysis, SecurityProtocol } from '../types'

/**
 * This is deliberately a local, explainable layer on top of zxcvbn. The
 * library estimates how a password would fare against a dictionary/rule-based
 * guesser; the checks below add Wi-Fi-specific context without ever trying a
 * password against a router or sending it anywhere.
 */
const WIFI_TERMS = [
  'password', 'passw0rd', 'qwerty', 'admin', 'internet', 'wifi', 'wireless', 'router',
  '123456', '12345678', '123456789', '87654321', 'letmein', 'welcome', 'iloveyou', 'abc12345',
  'كلمةالمرور', 'كلمة المرور', 'انترنت', 'واي فاي', 'الشبكة', 'مرحبا', 'السعودية', 'الرياض',
]

const ARABIC_TRANSLITERATIONS = ['marhaba', 'alsalam', 'riyadh', 'saudi', 'habibi', 'mohammed', 'abdullah']
const KEYBOARD_SEQUENCES = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'ضصثقفغعهخح', 'شسيبلاتنم']
const SYMBOL_POOL_SIZE = 33
const MIN_WIFI_LENGTH = 8
const MAX_WIFI_LENGTH = 63

function characterCount(value: string) {
  return Array.from(value).length
}

function utf8Length(value: string) {
  return new TextEncoder().encode(value).length
}

function isPortableWifiPassphrase(value: string) {
  // WPA passphrases are specified as 8–63 printable ASCII characters.
  // Some routers accept Unicode after vendor-specific UTF-8 conversion, but
  // that is not portable between access points or clients.
  return /^[\x20-\x7e]+$/u.test(value) && characterCount(value) >= MIN_WIFI_LENGTH && characterCount(value) <= MAX_WIFI_LENGTH
}

/**
 * These are modelling assumptions, not measurements of a particular router.
 * The expected time is calculated as guesses / 2 / rate (50% chance of a
 * guess being reached). WPA3 is intentionally described as a conservative,
 * rate-limited model because SAE does not expose the same offline attack model
 * as WPA2-PSK.
 */
export const ATTACK_MODELS: Record<SecurityProtocol, { rate: number; label: string; note: string }> = {
  WPA3: {
    rate: 5,
    label: '5 محاولات/ث',
    note: 'نموذج جلسة محافظ ومحدود لـ SAE؛ لا يفترض مادة تحقق للتخمين غير المتصل.',
  },
  'WPA2/WPA3': {
    rate: 100_000,
    label: '100 ألف محاولة/ث',
    note: 'نموذج أسوأ حالة لمسار WPA2-PSK في وضع انتقالي؛ يختلف حسب تفاوض العميل والإعدادات.',
  },
  WPA2: {
    rate: 100_000,
    label: '100 ألف محاولة/ث',
    note: 'نموذج تخمين غير متصل تقريبي لـ WPA2-PSK، وليس اتصالًا بالراوتر.',
  },
  WPA: {
    rate: 300_000,
    label: '300 ألف محاولة/ث',
    note: 'معدل حسابي تقريبي لبروتوكول قديم؛ حدّث الحماية بدل الاعتماد عليه.',
  },
  WEP: {
    rate: 1_000_000,
    label: 'مليون محاولة/ث',
    note: 'الرقم لا يجعل WEP آمنًا؛ WEP بروتوكول مكسور ويجب استبداله.',
  },
  Open: {
    rate: 1,
    label: 'محاولة/ث',
    note: 'الشبكة المفتوحة لا تستخدم كلمة مرور للمصادقة.',
  },
  Unknown: {
    rate: 10_000,
    label: '10 آلاف محاولة/ث',
    note: 'معدل افتراضي عند عدم معرفة نوع الحماية.',
  },
}

// Backwards-compatible numeric view for callers that only need the model rate.
export const OFFLINE_RATES: Record<SecurityProtocol, number> = Object.fromEntries(
  Object.entries(ATTACK_MODELS).map(([protocol, model]) => [protocol, model.rate]),
) as Record<SecurityProtocol, number>

function normalizeForMatching(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function comparable(value: string) {
  return normalizeForMatching(value).replace(/[0134578@$!]/g, (character) => ({
    '0': 'o',
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '8': 'b',
    '@': 'a',
    '$': 's',
    '!': 'i',
  })[character] || character)
}

function splitRelatedWords(value: string) {
  return value
    .split(/[,،;؛|\n]+/u)
    .map((term) => term.trim())
    .filter(Boolean)
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function contextTerms(ssid: string, relatedWords: string) {
  return unique([
    ...WIFI_TERMS,
    ...ARABIC_TRANSLITERATIONS,
    ssid,
    ...splitRelatedWords(relatedWords),
  ]).filter((term) => normalizeForMatching(term).length >= 4)
}

function findContextMatches(password: string, ssid: string, relatedWords: string) {
  const value = comparable(password)
  return contextTerms(ssid, relatedWords)
    .filter((term) => {
      const candidate = comparable(term)
      return candidate.length >= 4 && value.includes(candidate)
    })
    .map((term) => term.trim())
}

function findSequentialRun(password: string) {
  const value = password.toLocaleLowerCase()
  for (let index = 0; index < value.length; index += 1) {
    let ascending = 1
    let descending = 1
    for (let cursor = index + 1; cursor < value.length; cursor += 1) {
      const previous = value.charCodeAt(cursor - 1)
      const current = value.charCodeAt(cursor)
      if (current - previous === 1) ascending += 1
      else break
    }
    for (let cursor = index + 1; cursor < value.length; cursor += 1) {
      const previous = value.charCodeAt(cursor - 1)
      const current = value.charCodeAt(cursor)
      if (previous - current === 1) descending += 1
      else break
    }
    if (ascending >= 4 || descending >= 4) return true
  }

  const compact = value.replace(/\s/gu, '')
  return KEYBOARD_SEQUENCES.some((sequence) => {
    for (let index = 0; index <= sequence.length - 4; index += 1) {
      if (compact.includes(sequence.slice(index, index + 4))) return true
    }
    return false
  })
}

function hasRepetition(password: string) {
  return /(.)\1{2,}/u.test(password) || /^(.{1,6})\1{1,}$/u.test(password) || /(.{2,6})\1/u.test(password)
}

function hasPredictablePattern(password: string) {
  const value = password.toLocaleLowerCase()
  const hasYearOrDate = /(?:19|20)\d{2}/u.test(value) || /\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?/u.test(value)
  const hasAlternation = /^(.)(.)\1\2(?:\1\2)*$/u.test(value)
  const hasStraightPrefix = /^(?:password|admin|wifi|qwerty)[!@#$%^&*_-]?\d{1,6}$/iu.test(password)
  return hasYearOrDate || hasAlternation || hasStraightPrefix
}

function characterProfile(password: string) {
  const lower = /[a-z\p{Ll}]/u.test(password)
  const upper = /[A-Z\p{Lu}]/u.test(password)
  const numbers = /\d/u.test(password)
  const symbols = /[^\p{L}\d\s]/u.test(password)
  const whitespace = /\s/u.test(password)
  const nonAsciiLetter = Array.from(password).some((character) => (character.codePointAt(0) || 0) > 0x7f && /\p{L}/u.test(character))
  const categories = [lower, upper, numbers, symbols, nonAsciiLetter].filter(Boolean).length

  // A transparent approximation of the alphabet available to a guesser.
  // Unicode letters use a conservative 100-character bucket rather than
  // pretending every possible Unicode code point is equally likely.
  const poolSize = (lower ? 26 : 0) + (upper ? 26 : 0) + (numbers ? 10 : 0) +
    (symbols ? SYMBOL_POOL_SIZE : 0) + (nonAsciiLetter ? 100 : 0) + (whitespace ? 1 : 0)

  return {
    lower,
    upper,
    numbers,
    symbols,
    whitespace,
    categories,
    poolSize: Math.max(1, poolSize),
    diversityScore: Math.round((categories / 4) * 100),
  }
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

export function formatLargeNumber(value: number) {
  if (!Number.isFinite(value)) return 'عدد هائل جدًا'
  if (value < 1_000_000) return new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(value)
  return value.toExponential(2).replace('e+', ' × 10^')
}

function mapLevel(score: number): PasswordAnalysis['level'] {
  if (score >= 85) return 'excellent'
  if (score >= 65) return 'good'
  if (score >= 35) return 'attention'
  return 'critical'
}

function labelForLevel(level: PasswordAnalysis['level']) {
  if (level === 'excellent') return 'قوية جدًا'
  if (level === 'good') return 'قوية'
  if (level === 'attention') return 'متوسطة'
  return 'ضعيفة'
}

function resistanceForLevel(level: PasswordAnalysis['level']) {
  if (level === 'excellent') return 'مرتفعة جدًا'
  if (level === 'good') return 'مرتفعة'
  if (level === 'attention') return 'متوسطة'
  return 'منخفضة'
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

export async function analyzePassword(
  password: string,
  ssid: string,
  security: SecurityProtocol,
  relatedWords = '',
): Promise<PasswordAnalysis> {
  // zxcvbn is lazy-loaded and receives data only in this browser context.
  const { default: zxcvbn } = await import('zxcvbn')
  const profile = characterProfile(password)
  const contextMatches = findContextMatches(password, ssid, relatedWords)
  const ssidMatch = comparable(ssid).length >= 4 && comparable(password).includes(comparable(ssid))
  const common = contextMatches.length > 0
  const sequence = findSequentialRun(password)
  const repeated = hasRepetition(password)
  const predictable = hasPredictablePattern(password)
  const passwordLength = characterCount(password)
  const passwordUtf8Bytes = utf8Length(password)
  const wifiValidLength = passwordLength >= MIN_WIFI_LENGTH && passwordLength <= MAX_WIFI_LENGTH
  const portableWifiPassphrase = isPortableWifiPassphrase(password)
  const result = zxcvbn(password, contextTerms(ssid, relatedWords))

  // zxcvbn supplies the dictionary/rule estimate. The explicit penalties make
  // the Wi-Fi-specific reasons visible and keep a long predictable password
  // from receiving an unjustifiably high score.
  let score = result.score * 20 + 5
  if (passwordLength >= 16) score += 8
  if (passwordLength >= 20) score += 7
  if (passwordLength >= 24) score += 4
  if (profile.categories >= 3) score += 4
  if (profile.categories >= 4) score += 4
  if (common) score -= 30
  if (sequence) score -= 24
  if (repeated) score -= 20
  if (predictable) score -= 18
  if (!wifiValidLength) score = Math.min(score, 18)
  score = Math.max(0, Math.min(100, Math.round(score)))

  // This is an upper bound for uniformly random choices from the detected
  // character pool, not a claim about a human-created phrase. The effective
  // estimate below comes from zxcvbn plus the explicit pattern penalties.
  const theoreticalCombinations = Math.pow(profile.poolSize, passwordLength)
  const rawGuesses = Math.max(1, result.guesses)
  // If a custom Wi-Fi heuristic finds a pattern that the general dictionary
  // may not know (for example an Arabic sequence), reduce the effective guess
  // count by its strongest known pattern penalty. Taking the strongest penalty
  // avoids multiplying overlapping warnings twice.
  const patternPenaltyBits = Math.max(
    common ? 16 : 0,
    sequence ? 14 : 0,
    repeated ? 14 : 0,
    predictable ? 10 : 0,
  )
  const effectiveGuesses = rawGuesses / (2 ** patternPenaltyBits)
  const guesses = Number.isFinite(theoreticalCombinations)
    ? Math.max(1, Math.min(effectiveGuesses, theoreticalCombinations))
    : Math.max(1, effectiveGuesses)
  const searchSpaceBits = passwordLength * Math.log2(profile.poolSize)
  const entropyBits = Math.max(0, Math.min(searchSpaceBits, Math.log2(guesses)))
  const attackModel = ATTACK_MODELS[security]
  const crackSeconds = guesses / attackModel.rate / 2
  const onlineRate = 5
  const level = mapLevel(score)
  const findings: string[] = []
  const suggestions: string[] = []

  if (!wifiValidLength) findings.push(passwordLength < MIN_WIFI_LENGTH
    ? `أقصر من الحد الأدنى لعبارة WPA (${MIN_WIFI_LENGTH} محارف).`
    : `أطول من الحد القياسي لعبارة WPA (${MAX_WIFI_LENGTH} محرفًا).`)
  if (!portableWifiPassphrase && wifiValidLength) findings.push('تتضمن محارف غير ASCII؛ قد يقبلها الراوتر الحالي، لكنها ليست عبارة WPA محمولة بين الأجهزة.')
  if (common) findings.push(`${ssidMatch ? 'تتضمن اسم شبكة' : 'تتضمن كلمة شائعة أو كلمة مرتبطة بالسياق'}؛ سيجربها المهاجم مبكرًا.`)
  if (sequence) findings.push('تحتوي تسلسلًا معروفًا مثل 123456 أو abcdef أو نمط لوحة مفاتيح.')
  if (repeated) findings.push('تحتوي محارف أو مقاطع متكررة يسهل التنبؤ بها.')
  if (predictable) findings.push('تحتوي نمطًا متوقعًا مثل سنة أو تاريخ أو تكرار متناوب.')
  if (passwordLength < 16) findings.push('الطول أقل من توصيتنا البالغة 16 محرفًا.')
  if (profile.categories < 3) findings.push('تنوع مجموعات الأحرف محدود؛ المساحة المحتملة للتخمين أصغر.')
  if (result.feedback.warning) findings.push(translateWarning(result.feedback.warning))

  if (passwordLength < 16) suggestions.push('استخدم 16 محرفًا على الأقل، ويفضل 20 أو أكثر.')
  if (!portableWifiPassphrase && wifiValidLength) suggestions.push('لأعلى توافق مع WPA استخدم محارف ASCII قابلة للطباعة فقط، أو تحقق من توثيق الراوتر قبل تغيير العبارة.')
  if (profile.categories < 3) suggestions.push('استخدم مزيجًا من الحروف والأرقام والرموز، أو عبارة طويلة من كلمات عشوائية.')
  if (common || sequence || repeated || predictable) suggestions.push('ابتعد عن أسماء الأشخاص والمدن والشبكة والتواريخ والتسلسلات والتكرار.')
  if (security === 'WEP' || security === 'WPA') suggestions.push('حدّث إعداد الراوتر إلى WPA2-AES أو WPA3؛ قوة العبارة وحدها لا تصلح بروتوكولًا قديمًا.')
  if (security === 'Open') suggestions.push('فعّل WPA3 أو WPA2-AES؛ الشبكة المفتوحة لا تحمي حركة الاتصال.')
  if (result.feedback.suggestions.length) suggestions.push(...result.feedback.suggestions.map(translateSuggestion))
  if (!suggestions.length) suggestions.push('العبارة قوية. احتفظ بها في مدير كلمات مرور ولا تعد استخدامها.')

  return {
    score,
    level,
    guesses,
    possibleCombinations: theoreticalCombinations,
    entropyBits,
    searchSpaceBits,
    characterPoolSize: profile.poolSize,
    offlineRate: attackModel.rate,
    crackSeconds,
    crackTime: formatDuration(crackSeconds),
    onlineTime: formatDuration(guesses / onlineRate / 2),
    label: labelForLevel(level),
    guessResistance: resistanceForLevel(level),
    model: `${attackModel.note} عدد التخمينات الفعالة يبدأ من zxcvbn وتُطبّق عليه أقوى عقوبة للنمط المكتشف (${patternPenaltyBits} bit). الزمن = عدد التخمينات المتوقعة ÷ 2 ÷ ${attackModel.label}.`,
    findings: unique(findings),
    suggestions: unique(suggestions),
    metrics: {
      length: passwordLength,
      utf8Bytes: passwordUtf8Bytes,
      portableWifiPassphrase,
      diversity: profile.diversityScore,
      commonWord: common,
      sequence,
      repeated,
      predictable,
      contextualMatches: contextMatches.length,
    },
    checks: {
      length: password.length >= 16,
      mixedCase: profile.lower && profile.upper,
      numbers: profile.numbers,
      symbols: profile.symbols,
      noCommonPattern: !common && !sequence && !repeated && !predictable,
    },
  }
}

/**
 * Generate a Wi-Fi-compatible password using only Web Crypto. There is no
 * fallback to Math.random: if a secure random source is unavailable, failing
 * is safer than silently producing a predictable password.
 */
export function generateStrongPassword(length = 24) {
  const requestedLength = Number.isFinite(length) ? Math.floor(length) : 24
  const targetLength = Math.min(MAX_WIFI_LENGTH, Math.max(20, requestedLength))
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const numbers = '23456789'
  const symbols = '!@#$%&*+-=?'
  const all = lower + upper + numbers + symbols
  let lastCandidate = ''

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const required = [lower, upper, numbers, symbols].map((set) => randomFrom(set))
    const rest = Array.from({ length: targetLength - required.length }, () => randomFrom(all))
    const chars = [...required, ...rest]
    for (let index = chars.length - 1; index > 0; index -= 1) {
      const swap = secureRandom(index + 1)
      ;[chars[index], chars[swap]] = [chars[swap], chars[index]]
    }
    lastCandidate = chars.join('')
    if (!findSequentialRun(lastCandidate) && !hasRepetition(lastCandidate)) return lastCandidate
  }

  // The fallback is still fully cryptographically random and retains all four
  // required character classes; the loop only rejects an unlikely shape.
  return lastCandidate
}

function secureRandom(max: number) {
  if (!Number.isSafeInteger(max) || max <= 0) throw new Error('حجم عشوائي غير صالح.')
  const cryptoSource = globalThis.crypto
  if (!cryptoSource?.getRandomValues) throw new Error('مصدر عشوائي آمن غير متاح في هذا المتصفح.')

  const limit = Math.floor(0x1_0000_0000 / max) * max
  const values = new Uint32Array(1)
  do cryptoSource.getRandomValues(values)
  while (values[0] >= limit)
  return values[0] % max
}

function randomFrom(set: string) {
  return set[secureRandom(set.length)]
}

export { formatDuration }
