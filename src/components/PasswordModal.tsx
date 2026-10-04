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
import { analyzePassword, generateStrongPassword } from '../lib/password'
import type { NetworkAudit, PasswordAnalysis, WifiNetwork } from '../types'

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
  const [visible, setVisible] = useState(false)
  const [result, setResult] = useState<PasswordAnalysis | null>(null)
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
    await new Promise((resolve) => window.setTimeout(resolve, 260))
    const analysis = await analyzePassword(password, network.ssid, network.security)
    setResult(analysis)
    onSave(network.id, {
      score: analysis.score,
      level: analysis.level,
      guesses: analysis.guesses,
      crackTime: analysis.crackTime,
      testedAt: new Date().toISOString(),
      findings: analysis.findings,
    })
    setLoading(false)
  }

  const createPassword = () => {
    const value = generateStrongPassword()
    setGenerated(value)
    setPassword(value)
    setResult(null)
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
          <span><strong>خصوصية تامة:</strong> أدخل كلمة المرور التي تعرفها فقط. الأداة لا تستخرج كلمات مرور الشبكات.</span>
        </div>

        <form onSubmit={submit} className="password-form">
          <label htmlFor="wifi-password">كلمة مرور الشبكة الحالية</label>
          <div className="password-field">
            <input
              id="wifi-password"
              type={visible ? 'text' : 'password'}
              value={password}
              onChange={(event) => { setPassword(event.target.value); setResult(null); setGenerated('') }}
              placeholder="أدخل كلمة المرور لتحليلها"
              autoComplete="new-password"
              autoFocus
              dir="ltr"
            />
            <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
              {visible ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <div className="live-checks">
            <CheckItem passed={liveChecks.length} text="16 محرفًا أو أكثر" />
            <CheckItem passed={liveChecks.mixed} text="حروف متنوعة" />
            <CheckItem passed={liveChecks.number} text="أرقام" />
            <CheckItem passed={liveChecks.symbol} text="رموز" />
          </div>
          <button className="button primary full" disabled={!password || loading} type="submit">
            {loading ? <><LoaderCircle className="spin" size={19} /> جارٍ التحليل…</> : <><Gauge size={19} /> تحليل القوة الآن</>}
          </button>
        </form>

        {result && <AnalysisResult result={result} security={network.security} />}

        <div className="generator-card">
          <div className="generator-head">
            <span className="generator-icon"><Sparkles size={19} /></span>
            <div>
              <strong>تحتاج كلمة مرور جديدة؟</strong>
              <p>ولّد كلمة عشوائية قوية على جهازك.</p>
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

function AnalysisResult({ result, security }: { result: PasswordAnalysis; security: WifiNetwork['security'] }) {
  const scoreColor = scoreColors[result.level]
  return (
    <section className="analysis-result" aria-live="polite">
      <div className="result-summary">
        <div className="result-ring" style={{ '--score-angle': `${result.score * 3.6}deg`, '--score-color': scoreColor } as React.CSSProperties}>
          <div><strong>{result.score}</strong><small>/ 100</small></div>
        </div>
        <div className="result-copy">
          <span className={`status-pill ${result.level}`}><ShieldCheck size={14} /> {result.label}</span>
          <h3>نتيجة تحليل العبارة السرية</h3>
          <p>إنتروبي تقديري <bdi>{result.entropyBits.toFixed(1)} bit</bdi> · نحو {Intl.NumberFormat('ar-SA', { notation: 'compact', maximumFractionDigits: 1 }).format(result.guesses)} احتمال</p>
        </div>
      </div>

      <div className="time-grid">
        <div>
          <span><Clock3 size={16} /> هجوم افتراضي محلي</span>
          <strong>{result.crackTime}</strong>
          <small>{Intl.NumberFormat('ar-SA').format(result.offlineRate)} محاولة/ث · {security}</small>
        </div>
        <div>
          <span><ShieldAlert size={16} /> محاولة عبر الاتصال</span>
          <strong>{result.onlineTime}</strong>
          <small>عند 10 محاولات/ث دون قفل</small>
        </div>
      </div>

      {(result.findings.length > 0 || result.suggestions.length > 0) && (
        <div className="advice-grid">
          {result.findings.length > 0 && (
            <div className="findings">
              <strong><ShieldAlert size={17} /> ملاحظات</strong>
              <ul>{result.findings.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          )}
          <div className="suggestions">
            <strong><Lightbulb size={17} /> توصيات</strong>
            <ul>{result.suggestions.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      )}
      <p className="estimate-note">الأزمنة تقديرية وليست وعدًا بالكسر؛ تتغير حسب العتاد والبروتوكول وإعدادات الراوتر. لا تنفذ الأداة أي محاولة اتصال أو تخمين فعلية.</p>
    </section>
  )
}
