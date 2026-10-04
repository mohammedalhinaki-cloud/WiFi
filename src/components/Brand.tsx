import { RadioTower } from 'lucide-react'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="مرصاد">
      <span className="brand-mark" aria-hidden="true">
        <RadioTower size={compact ? 20 : 23} strokeWidth={2.4} />
        <span className="brand-pulse" />
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>مِرْصاد</strong>
          <small>أمان شبكتك بوضوح</small>
        </span>
      )}
    </div>
  )
}
