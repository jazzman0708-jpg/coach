import type { LocalDate, Weekday } from './types'

// 날짜 계산. "논리적 하루": boundaryHour(기본 05시) 이전은 전날로 본다.
// 자정을 넘겨 자는 생활에서 자정으로 자르면 하루 기록이 둘로 쪼개지기 때문이다.

const pad = (n: number) => String(n).padStart(2, '0')

export function toLocalDate(d: Date): LocalDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseLocalDate(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function logicalDate(at: Date, boundaryHour: number): LocalDate {
  return toLocalDate(new Date(at.getTime() - boundaryHour * 3_600_000))
}

export function addDays(date: LocalDate, n: number): LocalDate {
  const d = parseLocalDate(date)
  d.setDate(d.getDate() + n)
  return toLocalDate(d)
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000)
}

export function weekdayOf(date: LocalDate): Weekday {
  return parseLocalDate(date).getDay() as Weekday
}

/** 그 주의 월요일 */
export function weekStart(date: LocalDate): LocalDate {
  return addDays(date, -((weekdayOf(date) + 6) % 7))
}

/** 논리적 날짜의 'HH:MM' 시각. boundaryHour 이전 시각(예: 01:30 취침)은 다음 달력 날짜다. */
export function timeOnLogicalDate(date: LocalDate, hhmm: string, boundaryHour: number): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = parseLocalDate(date)
  if (h < boundaryHour) d.setDate(d.getDate() + 1)
  d.setHours(h, m, 0, 0)
  return d
}

export const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'] as const

export function formatKoreanDate(date: LocalDate): string {
  const d = parseLocalDate(date)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_LABEL[d.getDay()]})`
}
