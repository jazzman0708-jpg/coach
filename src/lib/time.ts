import { useEffect, useState } from 'react'

/** 화면을 다시 그리기 위한 현재 시각. 타이머 값 자체는 항상 시작·종료 시각에서 계산한다. */
export function useNow(intervalMs = 250, active = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [intervalMs, active])
  return now
}

export function formatClock(ms: number, withTenths = false) {
  const neg = ms < 0
  const total = Math.abs(ms)
  const m = Math.floor(total / 60_000)
  const s = Math.floor((total % 60_000) / 1000)
  const t = Math.floor((total % 1000) / 100)
  const base = `${neg ? '-' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return withTenths ? `${base}.${t}` : base
}

export const nowIso = () => new Date().toISOString()

export function hhmm(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
