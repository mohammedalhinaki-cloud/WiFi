import { Check, ChevronLeft, CircleAlert, LockKeyhole, MoreHorizontal, Router, ShieldCheck, Wifi } from 'lucide-react'
import { bandLabel, overallNetworkScore, protocolLabel, signalLabel } from '../lib/networks'
import type { AuditLevel, WifiNetwork } from '../types'

const levelCopy: Record<AuditLevel, string> = {
  excellent: 'محميّة بقوة',
  good: 'حماية جيدة',
  attention: 'تحتاج انتباهًا',
  critical: 'خطر مرتفع',
  untested: 'لم تُختبر بعد',
}

function SignalBars({ value }: { value: number }) {
  return (
    <span className="signal-bars" title={`قوة الإشارة ${value}%`} aria-label={`قوة الإشارة ${value}%`}>
      {[24, 42, 64, 82].map((threshold, index) => <i key={threshold} className={value >= threshold ? 'on' : ''} style={{ height: `${5 + index * 3}px` }} />)}
    </span>
  )
}

interface NetworkCardProps {
  network: WifiNetwork
  onAudit: (network: WifiNetwork) => void
  onClaim: (network: WifiNetwork) => void
  compact?: boolean
}

export function NetworkCard({ network, onAudit, onClaim, compact = false }: NetworkCardProps) {
  const level = network.audit?.level || 'untested'
  const score = overallNetworkScore(network)
  const needsProtocolUpdate = ['Open', 'WEP', 'WPA'].includes(network.security)

  return (
    <article className={`network-card level-${level} ${compact ? 'network-card-compact' : ''}`}>
      <div className="network-card-top">
        <div className="network-identity">
          <span className="network-icon"><Router size={22} /></span>
          <div>
            <div className="network-name-row">
              <h3>{network.ssid}</h3>
              {network.connected && <span className="connected-dot" title="متصل الآن" />}
              {network.isDemo && <span className="demo-tag">تجريبي</span>}
            </div>
            <p>{network.bssid || 'عنوان الجهاز محجوب'}</p>
          </div>
        </div>
        <button className="icon-button subtle" aria-label={`خيارات ${network.ssid}`}><MoreHorizontal size={20} /></button>
      </div>

      <div className="network-meta">
        <span><SignalBars value={network.signal} /> {signalLabel(network.signal)}</span>
        <span><Wifi size={14} /> {bandLabel(network)}</span>
        <span><LockKeyhole size={14} /> {network.security}</span>
      </div>

      <div className="network-score-row">
        <div className="mini-score" style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties}>
          <span>{score}</span>
        </div>
        <div className="score-copy">
          <strong>{needsProtocolUpdate ? 'البروتوكول غير آمن' : levelCopy[level]}</strong>
          <p>{needsProtocolUpdate ? `استبدل ${network.security} بـ WPA2 أو WPA3` : network.audit ? `آخر تدقيق ${relativeTime(network.audit.testedAt)}` : `إعدادات المصادقة: ${protocolLabel(network.security)} · اختبر العبارة المرجعية محليًا`}</p>
        </div>
        <span className={`level-icon ${level}`}>
          {level === 'excellent' || level === 'good' ? <Check size={17} /> : level === 'untested' ? <ShieldCheck size={17} /> : <CircleAlert size={17} />}
        </span>
      </div>

      {network.owned ? (
        <button className="network-action" onClick={() => onAudit(network)}>
          {network.audit ? 'إعادة اختبار كلمة المرور' : 'اختبار كلمة المرور'}
          <ChevronLeft size={17} />
        </button>
      ) : (
        <button className="network-action claim" onClick={() => onClaim(network)}>
          تأكيد أنني أملك هذه الشبكة
          <ChevronLeft size={17} />
        </button>
      )}
    </article>
  )
}

function relativeTime(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `منذ ${minutes} د`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `منذ ${hours} س`
  return `منذ ${Math.round(hours / 24)} يوم`
}
