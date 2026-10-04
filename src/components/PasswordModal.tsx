import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Check,
  CheckCircle2,
  Clipboard,
  Clock3,
  Eye,
  EyeOff,
  Gauge,
  KeyRound,
  Lightbulb,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react'
import { analyzePassword, formatLargeNumber, generateStrongPassword, simulateTargetedGuessing } from '../lib/password'
import { protocolLabel, protocolScore } from '../lib/networks'
import type { GuessSimulation, NetworkAudit, PasswordAnalysis, WifiNetwork } from '../types'

interface PasswordModalProps {
  network: WifiNetwork
  onClose: () => void
  onSave: (networkId: string, audit: NetworkAudit) => void
}

const scoreColors = {
  excellent: '#21c991',
  good: '#7ed26c',
  attention: '#f4b84a',
  critical: '#f16d69',
}

export function PasswordModal({ network, onClose, onSave }: PasswordModalProps) {
  const [password, setPassword] = useState('')
  const [relatedWords, setRelatedWords] = useState('')
  const [visible, setVisible] = useState(false)
  const [result, setResult] = useState<PasswordAnalysis | null>(null)
  const [simulation, setSimulation] = useState<GuessSimulation | null>(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', closeWithEscape)
    return () => window.removeEventListener('keydown', closeWithEscape)
  }, [onClose])

  const liveChecks = useMemo(() => ({
    length: password.length >= 16,
    mixed: /[a-z\p{Ll}]/u.test(password) && /[A-Z\p{Lu}]/u.test(password),
    number: /\d/u.test(password),
    symbol: /[^\p{L}\d\s]/u.test(password),
  }), [password])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!password) return
    setLoading(true)
    try {
      // Yield once so the busy state is painted before the bounded local work.
      await new Promise((resolve) => window.setTimeout(resolve, 0))
      const analysis = await analyzePassword(password, network.ssid, network.security, relatedWords)
      const guessRun = simulateTargetedGuessing(password, network.ssid, relatedWords)
      setResult(analysis)
      setSimulation(guessRun)
      onSave(network.id, {
        score: analysis.score,
        level: analysis.level,
        guesses: analysis.guesses,
        possibleCombinations: analysis.possibleCombinations,
        entropyBits: analysis.entropyBits,
        guessResistance: analysis.guessResistance,
        crackTime: analysis.crackTime,
        testedAt: new Date().toISOString(),
        findings: analysis.findings,
      })
    } finally {
      setLoading(false)
    }
  }

  const createPassword = () => {
    const value = generateStrongPassword()
    setGenerated(value)
    setPassword(value)
    setResult(null)
    setSimulation(null)
    setVisible(true)
  }

  const copyGenerated = async () => {
    if (!generated) return
    await navigator.clipboard.writeText(generated)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="password-title">
      <button className="modal-backdrop" onClick={onClose} aria-label="إغلاق" />
      <section className="modal-card password-modal">
        <header className="modal-header">
          <div>
            <span className="eyebrow"><KeyRound size={15} /> اختبار محلي وآمن</span>
            <h2 id="password-title">تدقيق كلمة مرور <bdi>{network.ssid}</bdi></h2>
            <p>{network.security} · لا تُحفظ الكلمة ولا تُرسل عبر الإنترنت</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={21} /></button>
        </header>

        <div className="privacy-strip">
          <ShieldCheck size={18} />
          <span><strong>تخمين محلي مضبوط:</strong> تُنشئ الأداة حتى 50 ألف تخمين موجّه وتقارنها بالعبارة المرجعية داخل ذاكرة جهازك فقط؛ لا ترسل أي محاولة إلى الشبكة ولا تسجّل الدخول.</span>
        </div>

        <form onSubmit={submit} className="password-form">
          <label htmlFor="wifi-password">العبارة المرجعية لاختبار مقاومتها</label>
          <div className="password-field">
            <input
              id="wifi-password"
              type={visible ? 'text' : 'password'}
              value={password}
              onChange={(event) => { setPassword(event.target.value); setResult(null); setSimulation(null); setGenerated('') }}
              placeholder="أدخل العبارة لإجراء تحليل ومحاكاة دقيقة"
              autoComplete="new-password"
              autoFocus
              dir="ltr"
            />
            <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
              {visible ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <label htmlFor="related-password-words">كلمات مرتبطة بالسياق (اختياري)</label>
          <input
            id="related-password-words"
            className="related-words-input"
            value={relatedWords}
            onChange={(event) => { setRelatedWords(event.target.value); setResult(null); setSimulation(null) }}
            placeholder="مثال: اسم المالك، المدينة، اسم الحيوان"
            dir="auto"
            autoComplete="off"
          />
          <p className="field-help">افصل الكلمات بفواصل. ستُستخدم للمقارنة المحلية فقط ولن تُحفظ.</p>
          <div className="live-checks">
            <CheckItem passed={liveChecks.length} text="16 محرفًا أو أكثر" />
            <CheckItem passed={liveChecks.mixed} text="حروف متنوعة" />
            <CheckItem passed={liveChecks.number} text="أرقام" />
            <CheckItem passed={liveChecks.symbol} text="رموز" />
          </div>
          <button className="button primary full" disabled={!password || loading} type="submit">
            {loading ? <><LoaderCircle className="spin" size={19} /> جارٍ التحليل والتخمين…</> : <><Gauge size={19} /> تحليل وتشغيل 50 ألف تخمين</>}
          </button>
        </form>

        {result && simulation && <AnalysisResult result={result} simulation={simulation} security={network.security} />}

        <div className="generator-card">
          <div className="generator-head">
            <span className="generator-icon"><Sparkles size={19} /></span>
            <div>
              <strong>تحتاج كلمة مرور جديدة؟</strong>
              <p>ولّد كلمة عشوائية قوية جدًا على جهازك باستخدام مولد آمن.</p>
            </div>
            <button className="button secondary small" type="button" onClick={createPassword}><RefreshCw size={15} /> توليد</button>
          </div>
          {generated && (
            <div className="generated-value">
              <code dir="ltr">{generated}</code>
              <button onClick={copyGenerated} type="button" aria-label="نسخ كلمة المرور">
                {copied ? <Check size={18} /> : <Clipboard size={18} />}
                {copied ? 'تم النسخ' : 'نسخ'}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function CheckItem({ passed, text }: { passed: boolean; text: string }) {
  return <span className={passed ? 'passed' : ''}>{passed ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{text}</span>
}

function authenticationLabel(security: WifiNetwork['security']) {
  return protocolLabel(security)
}

function AnalysisResult({ result, simulation, security }: { result: PasswordAnalysis; simulation: GuessSimulation; security: WifiNetwork['security'] }) {
  const scoreColor = scoreColors[result.level]
  const simulationAttempts = formatLargeNumber(simulation.matchedAt || simulation.attempted)
  const metricRows = [
    ['الطول', `${result.metrics.length} محرف`],
    ['تنوع الأحرف', `${result.metrics.diversity}%`],
    ['المساحة النظرية', `${formatLargeNumber(result.possibleCombinations)} احتمال`],
    ['سياق مرتبط', `${result.metrics.contextualMatches} مطابقة`],
    ['مقاومة التخمين', result.guessResistance],
  ]
  return (
    <section className="analysis-result" aria-live="polite">
      <div className="result-summary">
        <div className="result-ring" style={{ '--score-angle': `${result.score * 3.6}deg`, '--score-color': scoreColor } as React.CSSProperties}>
          <div><strong>{result.score}</strong><small>/ 100</small></div>
        </div>
        <div className="result-copy">
          <span className={`status-pill ${result.level}`}><ShieldCheck size={14} /> {result.label}</span>
          <h3>نتيجة تحليل العبارة السرية</h3>
          <p>مقاومة التخمين: <b>{result.guessResistance}</b> · نحو {formatLargeNumber(result.guesses)} تخمين متوقع</p>
        </div>
      </div>

      <div className={`guess-simulation ${simulation.matched ? 'matched' : 'resisted'}`}>
        <span className="guess-simulation-icon">{simulation.matched ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}</span>
        <div className="guess-simulation-copy">
          <span>نتيجة التخمين المحلي الفعلي</span>
          <strong>{simulation.matched
            ? `تمت مطابقة العبارة عند التخمين رقم ${simulationAttempts}`
            : `لم تظهر العبارة ضمن ${simulationAttempts} تخمين موجّه`}</strong>
          <p>{simulation.matched
            ? `الاستراتيجية: ${simulation.matchedBy}. غيّر العبارة لأنها ظهرت في قائمة قصيرة قابلة للتوقع.`
            : 'هذه نتيجة النطاق المختبَر فقط، وليست دليلًا على استحالة التخمين بقائمة أكبر.'}</p>
        </div>
        <div className="guess-run-stats">
          <span><bdi>{formatLargeNumber(simulation.guessesPerSecond)}</bdi><small>تخمين/ث</small></span>
          <span><bdi>{simulation.elapsedMs < 1 ? '< 1' : simulation.elapsedMs.toFixed(1)}</bdi><small>مللي ثانية</small></span>
        </div>
      </div>

      <div className="analysis-metrics">
        {metricRows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>

      <div className="time-grid">
        <div>
          <span><Clock3 size={16} /> زمن التخمين المتوقع</span>
          <strong>{result.crackTime}</strong>
          <small>{Intl.NumberFormat('ar-SA').format(result.offlineRate)} محاولة/ث · {security}</small>
        </div>
        <div>
          <span><ShieldAlert size={16} /> نموذج محدود نظري</span>
          <strong>{result.onlineTime}</strong>
          <small>5 محاولات/ث، بلا اتصال أو محاولة فعلية</small>
        </div>
        <div>
          <span><ShieldCheck size={16} /> قوة المصادقة</span>
          <strong>{authenticationLabel(security)}</strong>
          <small>{security} · {protocolScore(security)}/100</small>
        </div>
      </div>

      <p className="model-explanation"><strong>النموذج الحسابي:</strong> {result.model} الإنتروبي الفعّال {result.entropyBits.toFixed(1)} bit، ومساحة المحارف {result.characterPoolSize} محرفًا تقريبًا.</p>

      {(result.findings.length > 0 || result.suggestions.length > 0) && (
        <div className="advice-grid">
          {result.findings.length > 0 && (
            <div className="findings">
              <strong><ShieldAlert size={17} /> لماذا قد تضعف؟</strong>
              <ul>{result.findings.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          <div className="suggestions">
            <strong><Lightbulb size={17} /> ما الذي يقويها؟</strong>
            <ul>{result.suggestions.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      )}
      <p className="estimate-note">المطابقة الفعلية أعلاه محصورة بالعبارة المرجعية داخل الذاكرة. الأزمنة الأطول تقديرات حسابية وليست وعدًا بالكسر؛ لا تُرسل الأداة التخمينات إلى الراوتر ولا تنفذ أي محاولة تسجيل دخول.</p>
    </section>
  )
}
