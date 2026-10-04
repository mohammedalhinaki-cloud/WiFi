import {
  BarChart3,
  FileText,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Wifi,
  X,
} from 'lucide-react'
import type { ViewId } from '../types'
import { Brand } from './Brand'

const items: { id: ViewId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
  { id: 'networks', label: 'شبكاتي', icon: Wifi },
  { id: 'password', label: 'مختبر كلمة المرور', icon: KeyRound },
  { id: 'report', label: 'تقرير الأمان', icon: FileText },
]

interface SidebarProps {
  view: ViewId
  onView: (view: ViewId) => void
  onScan: () => void
  open: boolean
  onClose: () => void
  networkCount: number
}

export function Sidebar({ view, onView, onScan, open, onClose, networkCount }: SidebarProps) {
  const navigate = (id: ViewId) => {
    onView(id)
    onClose()
  }

  return (
    <>
      {open && <button className="sidebar-backdrop" onClick={onClose} aria-label="إغلاق القائمة" />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-head">
          <Brand />
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="إغلاق القائمة"><X size={20} /></button>
        </div>

        <button className="scan-primary" onClick={onScan}>
          <Plus size={19} />
          <span>فحص شبكة جديدة</span>
        </button>

        <nav className="main-nav" aria-label="القائمة الرئيسية">
          <span className="nav-caption">الرئيسية</span>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
                <Icon size={19} />
                <span>{item.label}</span>
                {item.id === 'networks' && <span className="nav-count">{networkCount}</span>}
              </button>
            )
          })}
          <span className="nav-caption nav-caption-spaced">الإعدادات</span>
          <button className={view === 'privacy' ? 'active' : ''} onClick={() => navigate('privacy')}>
            <LockKeyhole size={19} />
            <span>الخصوصية والأمان</span>
          </button>
        </nav>

        <div className="sidebar-trust">
          <span className="trust-icon"><ShieldCheck size={20} /></span>
          <div>
            <strong>المعالجة محلية</strong>
            <p>لا تغادر كلمات المرور جهازك أبدًا.</p>
          </div>
        </div>
        <div className="sidebar-version"><BarChart3 size={14} /> إصدار 1.0 · مفتوح المصدر</div>
      </aside>
    </>
  )
}
