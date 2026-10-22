import { CARDIO_BY_KIND, DRINK_BY_ID } from '../data/drinks'
import { EXERCISES } from '../data/exercises'
import type { Rules } from '../data/rules'
import { logGrams } from './alcohol'
import { moderateEquivalentMin } from './cardio'
import { addDays, weekStart } from './day'
import { sleepHours } from './sleep'
import type { BodyLog, DrinkLog, LocalDate, MonthlyMeasure, Muscle, SleepLog, WorkoutSession } from './types'

// 통계 화면용 집계. 모두 순수 함수.

export interface Point {
  x: LocalDate
  y: number
}

const byDate = <T extends { date: LocalDate }>(a: T, b: T) => a.date.localeCompare(b.date)

export function weightPoints(body: BodyLog[], from: LocalDate): Point[] {
  return body.filter((b) => b.weightKg !== undefined && b.date >= from).sort(byDate).map((b) => ({ x: b.date, y: b.weightKg! }))
}

/** 주(월~일) 평균. x는 그 주에 실제로 잰 날짜들의 가운데 날 (그래프에서 기록 범위를 벗어나지 않게) */
export function weeklyAverage(points: Point[]): Point[] {
  const groups = new Map<LocalDate, Point[]>()
  for (const p of points) {
    const k = weekStart(p.x)
    groups.set(k, [...(groups.get(k) ?? []), p])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, ps]) => {
      const sorted = [...ps].sort((a, b) => a.x.localeCompare(b.x))
      return { x: sorted[Math.floor((sorted.length - 1) / 2)].x, y: ps.reduce((s, v) => s + v.y, 0) / ps.length }
    })
}

/** 허리둘레: 주간 기록과 월간 측정을 합친다 (같은 날이면 주간 기록 우선) */
export function waistPoints(body: BodyLog[], monthly: MonthlyMeasure[], from: LocalDate): Point[] {
  const map = new Map<LocalDate, number>()
  for (const m of monthly) if (m.waistCm !== undefined) map.set(m.date, m.waistCm)
  for (const b of body) if (b.waistCm !== undefined) map.set(b.date, b.waistCm)
  return [...map.entries()].filter(([x]) => x >= from).sort(([a], [b]) => a.localeCompare(b)).map(([x, y]) => ({ x, y }))
}

export function shoulderWaistRatio(monthly: MonthlyMeasure[]): Point[] {
  return monthly
    .filter((m) => m.shoulderCm && m.waistCm)
    .sort(byDate)
    .map((m) => ({ x: m.date, y: m.shoulderCm! / m.waistCm! }))
}

export interface WeekRow {
  week: LocalDate
  cardioMin: number
  strengthSessions: number
  drinks: number
  avgSleep: number | null
  sets: Record<Muscle, number>
}

/** 최근 n주(이번 주 포함) 주간 합계. 오래된 주부터 */
export function weeklyRows(input: {
  today: LocalDate
  weeks: number
  sessions: WorkoutSession[]
  drinks: DrinkLog[]
  sleep: SleepLog[]
  rules: Rules
}): WeekRow[] {
  const { today, weeks, sessions, drinks, sleep, rules } = input
  const perDrink = rules.alcohol.gramsPerDrink.value ?? 14
  const indirect = rules.strength.indirectSetWeight.value ?? 0
  const first = addDays(weekStart(today), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, i) => {
    const week = addDays(first, 7 * i)
    const end = addDays(week, 6)
    const inWeek = <T extends { date: LocalDate }>(xs: T[]) => xs.filter((x) => x.date >= week && x.date <= end)
    const done = inWeek(sessions).filter((s) => s.status === 'done')
    const cardio = done.filter((s) => s.kind === 'cardio' && s.cardio).map((s) => s.cardio!)
    const sets = { delt_side: 0, delt_front: 0, delt_rear: 0, chest: 0, back: 0, abs: 0, legs: 0, arms: 0 } as Record<Muscle, number>
    for (const s of done.filter((s) => s.kind === 'strength')) {
      for (const e of s.exercises) {
        const ex = EXERCISES[e.exerciseId]
        if (!ex) continue
        for (const m of ex.primary) sets[m] += e.sets.length
        for (const m of ex.secondary ?? []) sets[m] += e.sets.length * indirect
      }
    }
    const nights = inWeek(sleep)
    return {
      week,
      cardioMin: Math.round(moderateEquivalentMin(cardio, (k) => CARDIO_BY_KIND[k].met, rules)),
      strengthSessions: done.filter((s) => s.kind === 'strength').length,
      drinks: inWeek(drinks).reduce((a, d) => a + logGrams(d, DRINK_BY_ID), 0) / perDrink,
      avgSleep: nights.length ? nights.reduce((a, n) => a + sleepHours(n), 0) / nights.length : null,
      sets,
    }
  })
}

export interface BestRecord {
  exerciseId: string
  bestSet: number
  bestSetDate: LocalDate
  bestTotal: number
  bestTotalDate: LocalDate
  sessions: number
}

/** 종목별 최고 기록: 한 세트 최고와 한 세션 합계 최고 */
export function bestRecords(sessions: WorkoutSession[]): BestRecord[] {
  const map = new Map<string, BestRecord>()
  for (const s of sessions) {
    if (s.kind !== 'strength' || s.status !== 'done') continue
    for (const e of s.exercises) {
      if (e.sets.length === 0) continue
      const best = Math.max(...e.sets.map((x) => x.value))
      const total = e.sets.reduce((a, x) => a + x.value, 0)
      const r = map.get(e.exerciseId) ?? { exerciseId: e.exerciseId, bestSet: 0, bestSetDate: s.date, bestTotal: 0, bestTotalDate: s.date, sessions: 0 }
      r.sessions++
      if (best > r.bestSet) Object.assign(r, { bestSet: best, bestSetDate: s.date })
      if (total > r.bestTotal) Object.assign(r, { bestTotal: total, bestTotalDate: s.date })
      map.set(e.exerciseId, r)
    }
  }
  return [...map.values()].sort((a, b) => (EXERCISES[a.exerciseId]?.pattern ?? '').localeCompare(EXERCISES[b.exerciseId]?.pattern ?? ''))
}
