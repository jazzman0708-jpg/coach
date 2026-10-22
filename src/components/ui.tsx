import { type ReactNode, useEffect } from 'react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Page({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        {right}
      </header>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-2xl border border-line bg-card p-4', className)}>{children}</section>
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{children}</h2>
      {right}
    </div>
  )
}

type Variant = 'primary' | 'soft' | 'danger' | 'ghost'

export function Button({
  children,
  onClick,
  variant = 'soft',
  size = 'md',
  disabled,
  className,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: Variant
  size?: 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-accent-ink',
        variant === 'soft' && 'bg-soft text-ink',
        variant === 'danger' && 'bg-bad/15 text-bad',
        variant === 'ghost' && 'text-muted',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2.5',
        size === 'lg' && 'px-5 py-3.5 text-lg',
        size === 'xl' && 'w-full py-6 text-2xl',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'ok' | 'warn' | 'bad' | 'accent' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        tone === 'muted' && 'bg-soft text-muted',
        tone === 'ok' && 'bg-ok/15 text-ok',
        tone === 'warn' && 'bg-warn/15 text-warn',
        tone === 'bad' && 'bg-bad/15 text-bad',
        tone === 'accent' && 'bg-accent/15 text-accent',
      )}
    >
      {children}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T | undefined
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  size?: 'md' | 'lg'
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-xl border font-semibold',
            size === 'md' ? 'px-3 py-2 text-sm' : 'px-3 py-4 text-base',
            value === o.value ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-soft text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 한 손 조작용 큰 −/+ 숫자 입력 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  unit,
  big,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  unit?: string
  big?: boolean
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        aria-label="줄이기"
        onClick={() => onChange(clamp(value - step))}
        className={cx('rounded-2xl bg-soft font-bold', big ? 'h-20 w-20 text-4xl' : 'h-12 w-12 text-2xl')}
      >
        −
      </button>
      <div className="flex-1 text-center">
        <span className={cx('tabular font-bold', big ? 'text-6xl' : 'text-3xl')}>{value}</span>
        {unit && <span className="ml-1 text-muted">{unit}</span>}
      </div>
      <button
        type="button"
        aria-label="늘리기"
        onClick={() => onChange(clamp(value + step))}
        className={cx('rounded-2xl bg-soft font-bold', big ? 'h-20 w-20 text-4xl' : 'h-12 w-12 text-2xl')}
      >
        +
      </button>
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-card px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-muted">
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export const inputClass = 'w-full rounded-xl border border-line bg-soft px-3 py-2.5 text-ink outline-none focus:border-accent'

export function NumberInput({
  value,
  onChange,
  step = 0.1,
  placeholder,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  step?: number
  placeholder?: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      placeholder={placeholder}
      className={inputClass}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  )
}

export function Loading() {
  return <div className="p-8 text-center text-muted">불러오는 중…</div>
}

export function ProgressBar({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'ok' | 'warn' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-soft">
      <div
        className={cx('h-full rounded-full', tone === 'accent' && 'bg-accent', tone === 'ok' && 'bg-ok', tone === 'warn' && 'bg-warn')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
