import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  Check,
  FileJson,
  LoaderCircle,
  LocateFixed,
  Plus,
  Radar,
  RadioTower,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Wifi,
  X,
} from 'lucide-react'
import { demoNetworks } from '../lib/demo'
import { networkFromScan, normalizeSecurity } from '../lib/networks'
import {
  getLocalScannerEndpoint,
  getScanCapability,
  getScanEndpoint,
  requestScan,
  scanErrorTitle,
  setScanEndpoint,
} from '../lib/scanApi'
import type { ScanNetwork, SecurityProtocol, WifiNetwork } from '../types'

interface ScanModalProps {
  onClose: () => void
  onAdd: (networks: WifiNetwork[], replaceDemo?: boolean) => void
}

type Tab = 'scan' | 'manual' | 'import'

export function ScanModal({ onClose, onAdd }: ScanModalProps) {
  const [tab, setTab] = useState<Tab>('scan')
  const [status, setStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [errorTitle, setErrorTitle] = useState('')
  const [found, setFound] = useState<WifiNetwork[]>([])
  const [scanCapability, setScanCapability] = useState(getScanCapability)
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set())
  const [endpointDraft, setEndpointDraft] = useState(() => {
    const endpoint = getScanEndpoint()
    return endpoint === '/api/scan' ? getLocalScannerEndpoint() : endpoint
  })
  const [endpointError, setEndpointError] = useState('')
  const [setupOpen, setSetupOpen] = useState(!scanCapability.available)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', closeWithEscape)
    return () => window.removeEventListener('keydown', closeWithEscape)
  }, [onClose])

  const scan = async () => {
    setStatus('scanning')
    setError('')
    setErrorTitle('')
    try {
      const payload = await requestScan()
      const networks = payload.networks.map(networkFromScan)
      setFound(networks)
      setOwnedIds(new Set(networks.filter((network) => network.connected).map((network) => network.id)))
      setStatus('done')
    } catch (caught) {
      setStatus('error')
      setErrorTitle(scanErrorTitle(caught))
      setError(caught instanceof Error ? caught.message : 'تعذّر إكمال المسح.')
    }
  }

  const connectScanner = (event: FormEvent) => {
    event.preventDefault()
    setEndpointError('')
    try {
      const endpoint = setScanEndpoint(endpointDraft)
      setEndpointDraft(endpoint)
      const capability = getScanCapability()
      setScanCapability(capability)
      if (!capability.available) {
        setEndpointError(capability.reason || 'هذا العنوان غير متاح في هذه الصفحة.')
        return
      }
      setSetupOpen(false)
      void scan()
    } catch (caught) {
      setEndpointError(caught instanceof Error ? caught.message : 'عنوان Backend غير صالح.')
    }
  }

  const addFound = () => {
    onAdd(found.map((network) => ({ ...network, owned: ownedIds.has(network.id) })), true)
    onClose()
  }

  const loadDemo = () => {
    onAdd(demoNetworks.map((network) => ({ ...network, id: `${network.id}-${Date.now()}` })), false)
    onClose()
  }

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const rows = Array.isArray(parsed) ? parsed : parsed.networks
      if (!Array.isArray(rows)) throw new Error('يجب أن يحتوي الملف على مصفوفة networks.')
      const imported = rows.slice(0, 100).map((item: ScanNetwork) => networkFromScan(item))
      setFound(imported)
      setOwnedIds(new Set(imported.map((network) => network.id)))
      setStatus('done')
      setTab('scan')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ملف JSON غير صالح.')
      setStatus('error')
      setTab('scan')
    }
  }

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="scan-title">
      <button className="modal-backdrop" onClick={onClose} aria-label="إغلاق" />
      <section className="modal-card scan-modal">
        <header className="modal-header">
          <div>
            <span className="eyebrow"><Radar size={15} /> جرد الشبكات</span>
            <h2 id="scan-title">إضافة شبكة للتدقيق</h2>
            <p>المسح يقرأ معلومات البث العامة فقط.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="إغلاق"><X size={21} /></button>
        </header>

        <div className="modal-tabs" role="tablist">
          <button className={tab === 'scan' ? 'active' : ''} onClick={() => setTab('scan')}><Radar size={16} /> مسح محلي</button>
          <button className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}><Plus size={16} /> إضافة يدويًا</button>
          <button className={tab === 'import' ? 'active' : ''} onClick={() => setTab('import')}><FileJson size={16} /> استيراد</button>
        </div>

        {tab === 'scan' && (
          <div className="scan-content">
            {status === 'idle' && scanCapability.available && (
              <div className="scan-idle">
                <span className="radar-visual"><Radar size={42} /><i /><i /></span>
                <h3>ابحث عن الشبكات المحيطة</h3>
                <p>سيطلب مرصاد المعلومات من Backend المسح عبر <code>{scanCapability.endpoint}</code>. المتصفح وحده لا يملك صلاحية قراءة محولات Wi‑Fi.</p>
                <button className="button primary" onClick={scan}><LocateFixed size={18} /> بدء المسح عبر Backend</button>
              </div>
            )}

            {status === 'idle' && !scanCapability.available && (
              <div className="scan-unavailable">
                <span className="radar-visual"><Radar size={42} /></span>
                <h3>لم يتم ربط Backend المسح بعد</h3>
                <p>{scanCapability.reason}</p>
                <p className="scan-next-step">للمسح الحقيقي شغّل مساعد المسح محليًا ثم اربط عنوانه أدناه. يمكنك أيضًا الإضافة اليدوية أو استيراد JSON دون أي Backend.</p>
              </div>
            )}

            {(status === 'idle' || status === 'error') && (
              <ScannerSetup
                endpoint={endpointDraft}
                open={setupOpen}
                error={endpointError}
                onToggle={() => { setSetupOpen((current) => !current); setEndpointError('') }}
                onEndpointChange={setEndpointDraft}
                onSubmit={connectScanner}
              />
            )}

            {status === 'scanning' && (
              <div className="scan-idle scanning">
                <span className="radar-visual"><Radar size={42} /><i /><i /></span>
                <h3>جارٍ البحث…</h3>
                <p>قد يستغرق ذلك بضع ثوانٍ. لن نحاول الاتصال بأي شبكة.</p>
                <LoaderCircle className="spin" size={24} />
              </div>
            )}

            {status === 'error' && (
              <div className="scan-error">
                <span><Wifi size={24} /></span>
                <div><strong>{errorTitle || 'تعذّر تنفيذ المسح'}</strong><p>{error}</p></div>
                <button className="button secondary small" onClick={scan}><RefreshCw size={15} /> إعادة</button>
              </div>
            )}

            {status === 'done' && found.length === 0 && (
              <div className="empty-inline"><Wifi size={28} /><strong>لم تُرصد شبكات</strong><p>تأكد من تشغيل Wi‑Fi ثم أعد المحاولة.</p></div>
            )}

            {status === 'done' && found.length > 0 && (
              <>
                <div className="found-heading"><div><strong>عُثر على {found.length} شبكة</strong><p>حدد فقط الشبكات التي تملكها لتفعيل اختبار كلمة المرور.</p></div><ShieldCheck size={21} /></div>
                <div className="found-list">
                  {found.map((network) => (
                    <label key={network.id} className="found-network">
                      <input
                        type="checkbox"
                        checked={ownedIds.has(network.id)}
                        onChange={() => setOwnedIds((current) => {
                          const next = new Set(current)
                          if (next.has(network.id)) next.delete(network.id)
                          else next.add(network.id)
                          return next
                        })}
                      />
                      <span className="found-radio"><RadioTower size={18} /></span>
                      <span><strong>{network.ssid}</strong><small>{network.security} · إشارة {network.signal}% · قناة {network.channel || '—'}</small></span>
                      <i>{ownedIds.has(network.id) && <Check size={14} />}</i>
                    </label>
                  ))}
                </div>
                <button className="button primary full" onClick={addFound}>إضافة إلى شبكاتي</button>
              </>
            )}

            {(status === 'idle' || status === 'error') && (
              <button className="demo-link" onClick={loadDemo}>أو حمّل بيانات تجريبية لمعاينة الواجهة</button>
            )}
          </div>
        )}

        {tab === 'manual' && <ManualNetwork onAdd={(network) => { onAdd([network], true); onClose() }} />}

        {tab === 'import' && (
          <div className="import-panel">
            <span className="import-icon"><FileJson size={34} /></span>
            <h3>استيراد نتيجة مسح JSON</h3>
            <p>استخدم ملفًا مصدّرًا من <code>npm run scan</code> أو مصفوفة تحتوي <code>ssid</code> و<code>security</code> و<code>signal</code>.</p>
            <input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={importJson} />
            <button className="button primary" onClick={() => fileRef.current?.click()}><FileJson size={17} /> اختيار ملف</button>
            <div className="privacy-strip"><ShieldCheck size={17} /> تتم قراءة الملف داخل المتصفح ولا يتم رفعه.</div>
          </div>
        )}
      </section>
    </div>
  )
}

interface ScannerSetupProps {
  endpoint: string
  open: boolean
  error: string
  onToggle: () => void
  onEndpointChange: (endpoint: string) => void
  onSubmit: (event: FormEvent) => void
}

function ScannerSetup({ endpoint, open, error, onToggle, onEndpointChange, onSubmit }: ScannerSetupProps) {
  return (
    <div className={`scanner-setup ${open ? 'open' : ''}`}>
      <button className="scanner-setup-toggle" type="button" onClick={onToggle}>
        <ServerCog size={16} />
        <span>{open ? 'إخفاء إعدادات Backend' : 'تغيير عنوان Backend المسح'}</span>
      </button>
      {open && (
        <form className="scanner-setup-form" onSubmit={onSubmit}>
          <label htmlFor="scan-endpoint">عنوان Backend أو مساعد المسح</label>
          <div className="scanner-endpoint-row">
            <input
              id="scan-endpoint"
              dir="ltr"
              value={endpoint}
              onChange={(event) => onEndpointChange(event.target.value)}
              spellCheck={false}
              inputMode="url"
              aria-describedby="scan-endpoint-help"
            />
            <button className="button soft small" type="submit">حفظ وتجربة</button>
          </div>
          <p id="scan-endpoint-help">للاستخدام مع GitHub Pages شغّل المساعد مع <code>WIFI_SCAN_ORIGINS=https://&lt;owner&gt;.github.io</code>، ثم استخدم العنوان <code>{getLocalScannerEndpoint()}</code>. لا يسمح المساعد افتراضيًا إلا لأصول التطوير المحلية.</p>
          {error && <strong className="scanner-setup-error">{error}</strong>}
        </form>
      )}
    </div>
  )
}

function ManualNetwork({ onAdd }: { onAdd: (network: WifiNetwork) => void }) {
  const [ssid, setSsid] = useState('')
  const [security, setSecurity] = useState<SecurityProtocol>('WPA3')
  const [channel, setChannel] = useState('36')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!ssid.trim()) return
    onAdd({
      id: crypto.randomUUID(),
      ssid: ssid.trim().slice(0, 64),
      signal: 0,
      channel: Number(channel) || 0,
      security: normalizeSecurity(security),
      owned: true,
    })
  }

  return (
    <form className="manual-form" onSubmit={submit}>
      <div className="form-field"><label htmlFor="ssid">اسم الشبكة (SSID)</label><input id="ssid" value={ssid} onChange={(event) => setSsid(event.target.value)} placeholder="مثال: Home_5G" autoFocus /></div>
      <div className="form-row">
        <div className="form-field"><label htmlFor="security">نوع الحماية</label><select id="security" value={security} onChange={(event) => setSecurity(event.target.value as SecurityProtocol)}><option>WPA3</option><option>WPA2/WPA3</option><option>WPA2</option><option>WPA</option><option>WEP</option><option>Open</option><option>Unknown</option></select></div>
        <div className="form-field"><label htmlFor="channel">القناة</label><input id="channel" inputMode="numeric" value={channel} onChange={(event) => setChannel(event.target.value)} /></div>
      </div>
      <label className="ownership-confirm"><input type="checkbox" required /><span>أؤكد أنني أملك هذه الشبكة أو لدي إذن صريح لتدقيقها.</span></label>
      <button className="button primary full" disabled={!ssid.trim()}><Plus size={17} /> إضافة الشبكة</button>
    </form>
  )
}
