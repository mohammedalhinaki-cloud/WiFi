import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Bell,
  Check,
  ChevronLeft,
  CircleAlert,
  Download,
  FileCheck2,
  FileText,
  Fingerprint,
  Gauge,
  KeyRound,
  LayoutDashboard,
  Lightbulb,
  LockKeyhole,
  Menu,
  Plus,
  Printer,
  RadioTower,
  ScanLine,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  TriangleAlert,
  Wifi,
  Zap,
} from 'lucide-react'
import { Brand } from './components/Brand'
import { NetworkCard } from './components/NetworkCard'
import { PasswordModal } from './components/PasswordModal'
import { ScanModal } from './components/ScanModal'
import { Sidebar } from './components/Sidebar'
import { demoNetworks } from './lib/demo'
import { overallNetworkScore, protocolScore } from './lib/networks'
import type { NetworkAudit, ViewId, WifiNetwork } from './types'

const STORAGE_KEY = 'mersad.wifi.networks.v1'

function getInitialNetworks(): WifiNetwork[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // Corrupt local state is safely ignored.
  }
  return demoNetworks
}

export default function App() {
  const [view, setView] = useState<ViewId>('overview')
  const [networks, setNetworks] = useState<WifiNetwork[]>(getInitialNetworks)
  const [scanOpen, setScanOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [auditTarget, setAuditTarget] = useState<WifiNetwork | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(networks))
  }, [networks])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const stats = useMemo(() => {
    const owned = networks.filter((network) => network.owned)
    const audited = owned.filter((network) => network.audit)
    const scores = owned.map(overallNetworkScore)
    const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0
    // A protocol-only score is useful before a password audit, but it must not
    // be presented as a fully verified network result.
    const secure = owned.filter((network) => Boolean(network.audit) && overallNetworkScore(network) >= 70).length
    const attention = owned.filter((network) => overallNetworkScore(network) < 70 || !network.audit).length
    return { total: owned.length, audited: audited.length, average, secure, attention }
  }, [networks])

  const addNetworks = (incoming: WifiNetwork[], replaceDemo = false) => {
    setNetworks((current) => {
      const base = replaceDemo ? current.filter((network) => !network.isDemo) : current
      const map = new Map(base.map((network) => [network.id, network]))
      for (const network of incoming) map.set(network.id, network)
      return [...map.values()]
    })
    setToast(`تمت إضافة ${incoming.length} ${incoming.length === 1 ? 'شبكة' : 'شبكات'}`)
  }

  const saveAudit = (networkId: string, audit: NetworkAudit) => {
    setNetworks((current) => current.map((network) => network.id === networkId ? { ...network, audit } : network))
  }

  const claimNetwork = (network: WifiNetwork) => {
    const claimed = { ...network, owned: true }
    setNetworks((current) => current.map((item) => item.id === network.id ? claimed : item))
    setAuditTarget(claimed)
  }

  const clearData = () => {
    if (!window.confirm('سيتم حذف قائمة الشبكات وملخصات التدقيق المحفوظة على هذا الجهاز. هل تريد المتابعة؟')) return
    setNetworks([])
    localStorage.removeItem(STORAGE_KEY)
    setToast('تم حذف البيانات المحلية')
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} onView={setView} onScan={() => setScanOpen(true)} open={sidebarOpen} onClose={() => setSidebarOpen(false)} networkCount={networks.length} />

      <main className="main-content">
        <MobileHeader onMenu={() => setSidebarOpen(true)} onScan={() => setScanOpen(true)} />
        <Topbar onMenu={() => setSidebarOpen(true)} onPrivacy={() => setView('privacy')} />

        <div className="page-content">
          {view === 'overview' && <Overview networks={networks} stats={stats} onScan={() => setScanOpen(true)} onAudit={setAuditTarget} onClaim={claimNetwork} onView={setView} />}
          {view === 'networks' && <NetworksView networks={networks} onScan={() => setScanOpen(true)} onAudit={setAuditTarget} onClaim={claimNetwork} />}
          {view === 'password' && <PasswordLab networks={networks.filter((network) => network.owned)} onAudit={setAuditTarget} onScan={() => setScanOpen(true)} />}
          {view === 'report' && <ReportView networks={networks.filter((network) => network.owned)} stats={stats} />}
          {view === 'privacy' && <PrivacyView onClear={clearData} />}
        </div>
      </main>

      <MobileNav view={view} onView={setView} onScan={() => setScanOpen(true)} />
      {scanOpen && <ScanModal onClose={() => setScanOpen(false)} onAdd={addNetworks} />}
      {auditTarget && <PasswordModal network={auditTarget} onClose={() => setAuditTarget(null)} onSave={saveAudit} />}
      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </div>
  )
}

function Topbar({ onMenu, onPrivacy }: { onMenu: () => void; onPrivacy: () => void }) {
  return (
    <header className="topbar">
      <button className="icon-button desktop-menu" onClick={onMenu} aria-label="فتح القائمة"><Menu size={21} /></button>
      <div className="topbar-status"><span className="live-dot" /> الحماية المحلية تعمل</div>
      <div className="topbar-actions">
        <button className="icon-button notification" aria-label="التنبيهات"><Bell size={19} /><i /></button>
        <button className="profile-button" onClick={onPrivacy} aria-label="الخصوصية والأمان"><span><ShieldCheck size={18} /></span><div><strong>الوضع الخاص</strong><small>دون حساب</small></div><ChevronLeft size={15} /></button>
      </div>
    </header>
  )
}

function MobileHeader({ onMenu, onScan }: { onMenu: () => void; onScan: () => void }) {
  return (
    <header className="mobile-header">
      <button className="icon-button" onClick={onMenu} aria-label="فتح القائمة"><Menu size={21} /></button>
      <Brand compact />
      <button className="icon-button mobile-add" onClick={onScan} aria-label="فحص شبكة"><Plus size={21} /></button>
    </header>
  )
}

interface DashboardStats { total: number; audited: number; average: number; secure: number; attention: number }

function Overview({ networks, stats, onScan, onAudit, onClaim, onView }: {
  networks: WifiNetwork[]
  stats: DashboardStats
  onScan: () => void
  onAudit: (network: WifiNetwork) => void
  onClaim: (network: WifiNetwork) => void
  onView: (view: ViewId) => void
}) {
  const owned = networks.filter((network) => network.owned)
  const recent = [...owned].sort((a, b) => (b.audit?.testedAt || '').localeCompare(a.audit?.testedAt || '')).slice(0, 3)

  return (
    <>
      <section className="page-heading">
        <div>
          <span className="date-kicker">لوحة الأمان · {new Intl.DateTimeFormat('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span>
          <h1>شبكتك تحت السيطرة <span>✦</span></h1>
          <p>راقب إعدادات شبكاتك، واختبر قوة كلمات المرور دون أن تغادر بياناتك جهازك.</p>
        </div>
        <button className="button primary heading-action" onClick={onScan}><ScanLine size={18} /> فحص شبكة جديدة</button>
      </section>

      {networks.some((network) => network.isDemo) && (
        <div className="demo-banner">
          <div><Sparkles size={18} /><span><strong>أنت تشاهد بيانات تجريبية.</strong> ابدأ مسحًا محليًا لاستبدالها بشبكاتك.</span></div>
          <button onClick={onScan}>ابدأ الآن <ArrowLeft size={15} /></button>
        </div>
      )}

      <section className="metric-grid">
        <MetricCard icon={Wifi} label="شبكاتي" value={stats.total} note={`${stats.audited} خضعت لاختبار كلمة المرور`} tone="teal" />
        <MetricCard icon={ShieldCheck} label="محميّة جيدًا" value={stats.secure} note={stats.total ? `${Math.round((stats.secure / stats.total) * 100)}٪ من شبكاتك` : 'أضف أول شبكة'} tone="green" />
        <MetricCard icon={CircleAlert} label="تحتاج انتباهًا" value={stats.attention} note={stats.attention ? 'راجع التوصيات أدناه' : 'لا توجد ملاحظات'} tone="orange" />
        <MetricCard icon={Gauge} label="متوسط الأمان" value={`${stats.average}%`} note={stats.average >= 80 ? 'ممتاز — استمر هكذا' : stats.average >= 60 ? 'جيد، ويمكن تحسينه' : 'يحتاج إلى تحسين'} tone="blue" />
      </section>

      <section className="dashboard-grid">
        <SecurityOverview stats={stats} networks={owned} />
        <QuickAdvice networks={owned} onView={onView} />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><h2>حالة الشبكات</h2><p>ملخص آخر تدقيق لكل شبكة تملكها</p></div>
          <button onClick={() => onView('networks')}>عرض الكل <ChevronLeft size={16} /></button>
        </div>
        {recent.length ? (
          <div className="network-grid">
            {recent.map((network) => <NetworkCard key={network.id} network={network} onAudit={onAudit} onClaim={onClaim} compact />)}
          </div>
        ) : (
          <EmptyState onScan={onScan} />
        )}
      </section>
    </>
  )
}

function MetricCard({ icon: Icon, label, value, note, tone }: { icon: typeof Wifi; label: string; value: number | string; note: string; tone: string }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}><Icon size={21} /></div>
      <div className="metric-label">{label}</div>
      <strong className="metric-value">{value}</strong>
      <small><span className={tone === 'orange' ? 'warm-dot' : 'good-dot'} /> {note}</small>
    </article>
  )
}

function SecurityOverview({ stats, networks }: { stats: DashboardStats; networks: WifiNetwork[] }) {
  const counts = {
    excellent: networks.filter((network) => overallNetworkScore(network) >= 85).length,
    good: networks.filter((network) => overallNetworkScore(network) >= 65 && overallNetworkScore(network) < 85).length,
    weak: networks.filter((network) => overallNetworkScore(network) < 65).length,
  }
  return (
    <article className="panel security-overview">
      <div className="panel-heading"><div><h2>مؤشر الأمان العام</h2><p>محسوب من البروتوكول وقوة الكلمات المختبرة</p></div><span className="trend-badge"><Activity size={14} /> محلي</span></div>
      <div className="security-body">
        <div className="big-score" style={{ '--score-angle': `${stats.average * 3.6}deg` } as React.CSSProperties}>
          <div><span><ShieldCheck size={24} /></span><strong>{stats.average}</strong><small>من 100</small></div>
        </div>
        <div className="score-details">
          <h3>{stats.average >= 85 ? 'حماية ممتازة' : stats.average >= 65 ? 'وضع أمني جيد' : 'هناك مجال مهم للتحسين'}</h3>
          <p>{stats.attention ? `لديك ${stats.attention} ${stats.attention === 1 ? 'شبكة تحتاج' : 'شبكات تحتاج'} إلى مراجعة.` : 'كل الشبكات المضافة في وضع جيد.'}</p>
          <div className="score-legend">
            <span><i className="excellent" /> ممتازة <b>{counts.excellent}</b></span>
            <span><i className="good" /> جيدة <b>{counts.good}</b></span>
            <span><i className="weak" /> تحتاج مراجعة <b>{counts.weak}</b></span>
          </div>
        </div>
      </div>
      <div className="protocol-line">
        {networks.slice(0, 8).map((network) => <i key={network.id} style={{ height: `${Math.max(18, overallNetworkScore(network))}%` }} title={`${network.ssid}: ${overallNetworkScore(network)}`} />)}
        {!networks.length && Array.from({ length: 6 }).map((_, index) => <i key={index} className="empty" style={{ height: `${28 + index * 7}%` }} />)}
      </div>
    </article>
  )
}

function QuickAdvice({ networks, onView }: { networks: WifiNetwork[]; onView: (view: ViewId) => void }) {
  const oldProtocols = networks.filter((network) => protocolScore(network.security) < 70).length
  const untested = networks.filter((network) => !network.audit).length
  const items = [
    oldProtocols ? { icon: TriangleAlert, title: 'بروتوكول قديم', text: `${oldProtocols} شبكة تستخدم حماية قديمة أو مفتوحة.`, tone: 'danger' } : null,
    untested ? { icon: KeyRound, title: 'اختبار معلّق', text: `${untested} شبكة لم تُختبر كلمتها بعد.`, tone: 'warning' } : null,
    { icon: BadgeCheck, title: 'الخصوصية مفعّلة', text: 'كل التحليلات تتم داخل هذا الجهاز.', tone: 'safe' },
  ].filter(Boolean) as { icon: typeof TriangleAlert; title: string; text: string; tone: string }[]

  return (
    <article className="panel quick-advice">
      <div className="panel-heading"><div><h2>ملخص ذكي</h2><p>الأولويات المقترحة الآن</p></div><Lightbulb size={20} /></div>
      <div className="advice-list">
        {items.map(({ icon: Icon, title, text, tone }) => (
          <div className={`advice-item ${tone}`} key={title}><span><Icon size={18} /></span><div><strong>{title}</strong><p>{text}</p></div></div>
        ))}
      </div>
      <button className="button soft full" onClick={() => onView(untested ? 'password' : 'report')}>{untested ? 'إكمال الاختبارات' : 'فتح التقرير'} <ChevronLeft size={16} /></button>
    </article>
  )
}

function NetworksView({ networks, onScan, onAudit, onClaim }: { networks: WifiNetwork[]; onScan: () => void; onAudit: (network: WifiNetwork) => void; onClaim: (network: WifiNetwork) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'owned' | 'attention'>('all')
  const filtered = networks.filter((network) => {
    const matchesQuery = network.ssid.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'owned' && network.owned) || (filter === 'attention' && (overallNetworkScore(network) < 70 || !network.audit))
    return matchesQuery && matchesFilter
  })

  return (
    <>
      <section className="page-heading compact-heading"><div><span className="date-kicker">إدارة الأصول</span><h1>شبكاتي</h1><p>شبكات مرصودة ومملوكة، مع نتيجة منفصلة لكل شبكة.</p></div><button className="button primary heading-action" onClick={onScan}><Plus size={18} /> إضافة شبكة</button></section>
      <div className="toolbar">
        <div className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم الشبكة…" /></div>
        <div className="filter-tabs">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>الكل <b>{networks.length}</b></button>
          <button className={filter === 'owned' ? 'active' : ''} onClick={() => setFilter('owned')}>أملكها</button>
          <button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>تحتاج انتباهًا</button>
        </div>
      </div>
      {filtered.length ? <div className="network-grid wide">{filtered.map((network) => <NetworkCard key={network.id} network={network} onAudit={onAudit} onClaim={onClaim} />)}</div> : <EmptyState onScan={onScan} search={Boolean(query)} />}
    </>
  )
}

function PasswordLab({ networks, onAudit, onScan }: { networks: WifiNetwork[]; onAudit: (network: WifiNetwork) => void; onScan: () => void }) {
  return (
    <>
      <section className="page-heading compact-heading"><div><span className="date-kicker">تحليل مقاومة محلي وقابل للتفسير</span><h1>مختبر كلمة المرور</h1><p>تقييم محلي للعبارة التي تدخلها دون أي اتصال بالشبكة.</p></div></section>
      <section className="lab-hero">
        <div className="lab-copy"><span className="lab-icon"><KeyRound size={28} /></span><h2>اختر الشبكة التي تريد اختبارها</h2><p>أدخل كلمة المرور التي تملكها لتقييم طولها وأنماطها محليًا. لا ينفّذ المختبر محاولات دخول ولا يرسل أي بيانات إلى الراوتر.</p><div className="lab-features"><span><Zap size={16} /> تحليل محلي سريع</span><span><Fingerprint size={16} /> لا رفع للبيانات</span><span><BarChart3 size={16} /> نتيجة قابلة للتفسير</span></div></div>
        <div className="lab-art" aria-hidden="true"><span className="orbit one" /><span className="orbit two" /><Shield size={60} /><i><KeyRound size={19} /></i></div>
      </section>
      <div className="section-heading"><div><h2>الشبكات المؤهلة</h2><p>يظهر هنا فقط ما أكدت ملكيته</p></div></div>
      {networks.length ? <div className="lab-network-list">{networks.map((network) => <button key={network.id} onClick={() => onAudit(network)}><span className="network-icon"><RadioTower size={20} /></span><span><strong>{network.ssid}</strong><small>{network.security} · {network.audit ? `آخر نتيجة ${network.audit.score}/100` : 'لم تُختبر بعد'}</small></span><span className={`lab-score ${network.audit?.level || 'untested'}`}>{network.audit?.score ?? '—'}</span><ChevronLeft size={18} /></button>)}</div> : <EmptyState onScan={onScan} />}
    </>
  )
}

function ReportView({ networks, stats }: { networks: WifiNetwork[]; stats: DashboardStats }) {
  const exportReport = () => {
    const safeReport = {
      generatedAt: new Date().toISOString(),
      summary: stats,
      networks: networks.map(({ ssid, security, channel, signal, audit }) => ({ ssid, security, channel, signal, audit })),
      note: 'لا يحتوي هذا التقرير على كلمات مرور أو عناوين BSSID كاملة.',
    }
    const blob = new Blob([JSON.stringify(safeReport, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `mersad-report-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <>
      <section className="page-heading compact-heading print-hidden"><div><span className="date-kicker">تقرير قابل للتصدير</span><h1>تقرير الأمان</h1><p>ملخص تنفيذي لا يتضمن أي كلمة مرور.</p></div><div className="heading-buttons"><button className="button secondary" onClick={() => window.print()}><Printer size={17} /> طباعة</button><button className="button primary" onClick={exportReport}><Download size={17} /> تصدير JSON</button></div></section>
      <section className="report-sheet">
        <header><Brand /><div><strong>تقرير تدقيق Wi‑Fi</strong><span>{new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())}</span></div></header>
        <div className="report-score"><div className="report-grade">{stats.average >= 85 ? 'A' : stats.average >= 70 ? 'B' : stats.average >= 55 ? 'C' : 'D'}</div><div><span>النتيجة الإجمالية</span><strong>{stats.average} / 100</strong><p>{stats.average >= 80 ? 'بنية أمان قوية إجمالًا' : 'ينبغي معالجة البنود ذات الأولوية'}</p></div></div>
        <div className="report-summary"><div><span>الشبكات</span><strong>{stats.total}</strong></div><div><span>تم اختبارها</span><strong>{stats.audited}</strong></div><div><span>آمنة</span><strong>{stats.secure}</strong></div><div><span>تحتاج مراجعة</span><strong>{stats.attention}</strong></div></div>
        <div className="report-table-wrap"><table><thead><tr><th>الشبكة</th><th>البروتوكول</th><th>قوة الكلمة</th><th>النتيجة</th><th>الحالة</th></tr></thead><tbody>{networks.map((network) => { const score = overallNetworkScore(network); return <tr key={network.id}><td><strong>{network.ssid}</strong><small>قناة {network.channel || '—'}</small></td><td>{network.security}</td><td>{network.audit ? `${network.audit.score}/100` : 'غير مختبرة'}</td><td>{score}/100</td><td><span className={`table-status ${network.audit && score >= 70 ? 'safe' : 'warning'}`}>{network.audit && score >= 70 ? <Check size={13} /> : <TriangleAlert size={13} />}{network.audit && score >= 70 ? 'جيدة' : 'مراجعة'}</span></td></tr> })}</tbody></table></div>
        {!networks.length && <div className="empty-inline"><FileText size={30} /><strong>لا توجد بيانات للتقرير</strong></div>}
        <footer><ShieldCheck size={16} /> أُنشئ محليًا بواسطة مرصاد · لا يحتوي على أسرار.</footer>
      </section>
    </>
  )
}

function PrivacyView({ onClear }: { onClear: () => void }) {
  return (
    <>
      <section className="page-heading compact-heading"><div><span className="date-kicker">مصمم للخصوصية</span><h1>الخصوصية والأمان</h1><p>أنت تتحكم في البيانات، ولا حاجة لحساب أو خادم سحابي.</p></div></section>
      <section className="privacy-hero"><div><span><ShieldCheck size={38} /></span><h2>أسرارك تبقى على جهازك</h2><p>تحليل كلمات المرور يتم في ذاكرة المتصفح فقط. لا نرسلها، ولا نسجلها، ولا نضعها في التقارير.</p></div><div className="privacy-grid"><PrivacyFact icon={Smartphone} title="معالجة محلية" text="كل حسابات القوة والتوليد تتم على الجهاز." /><PrivacyFact icon={LockKeyhole} title="دون تتبع" text="لا تحليلات استخدام، لا حساب، ولا ملفات تعريف." /><PrivacyFact icon={FileCheck2} title="تقارير منقّحة" text="التصدير يستبعد كلمات المرور وعناوين الأجهزة الكاملة." /><PrivacyFact icon={ScanLine} title="اختبار معزول" text="تحليل كلمة المرور محلي ولا تُرسل للشبكة." /></div></section>
      <section className="danger-zone"><div><span><Trash2 size={19} /></span><div><strong>حذف بيانات مرصاد المحلية</strong><p>يحذف الشبكات وملخصات نتائج التدقيق المخزنة في هذا المتصفح.</p></div></div><button className="button danger" onClick={onClear}>حذف البيانات</button></section>
      <div className="scope-note"><CircleAlert size={19} /><div><strong>نطاق الاستخدام المسؤول</strong><p>استخدم الأداة فقط مع شبكات تملكها أو لديك تفويض صريح لتدقيقها. مرصاد يحلل العبارة التي تدخلها محليًا؛ لا يلتقط المصافحات، ولا يستخرج كلمة مجهولة، ولا يرسل محاولات للراوتر أو يتجاوز المصادقة.</p></div></div>
    </>
  )
}

function PrivacyFact({ icon: Icon, title, text }: { icon: typeof Smartphone; title: string; text: string }) {
  return <article><span><Icon size={20} /></span><div><strong>{title}</strong><p>{text}</p></div></article>
}

function EmptyState({ onScan, search = false }: { onScan: () => void; search?: boolean }) {
  return <div className="empty-state"><span><Wifi size={32} /></span><h3>{search ? 'لا توجد نتائج مطابقة' : 'لا توجد شبكات بعد'}</h3><p>{search ? 'جرّب اسمًا أو مرشحًا مختلفًا.' : 'ابدأ بمسح محلي أو أضف شبكة تملكها يدويًا.'}</p>{!search && <button className="button primary" onClick={onScan}><Plus size={17} /> إضافة شبكة</button>}</div>
}

function MobileNav({ view, onView, onScan }: { view: ViewId; onView: (view: ViewId) => void; onScan: () => void }) {
  const entries: { id: ViewId; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'networks', label: 'الشبكات', icon: Wifi },
    { id: 'password', label: 'المختبر', icon: KeyRound },
    { id: 'report', label: 'التقرير', icon: FileText },
  ]
  return <nav className="mobile-nav" aria-label="التنقل السفلي">{entries.slice(0, 2).map((entry) => <MobileNavItem key={entry.id} entry={entry} active={view === entry.id} onClick={() => onView(entry.id)} />)}<button className="mobile-scan" onClick={onScan} aria-label="فحص شبكة"><span><Plus size={25} /></span></button>{entries.slice(2).map((entry) => <MobileNavItem key={entry.id} entry={entry} active={view === entry.id} onClick={() => onView(entry.id)} />)}</nav>
}

function MobileNavItem({ entry, active, onClick }: { entry: { label: string; icon: typeof Wifi }; active: boolean; onClick: () => void }) {
  const Icon = entry.icon
  return <button className={active ? 'active' : ''} onClick={onClick}><Icon size={19} /><span>{entry.label}</span></button>
}
