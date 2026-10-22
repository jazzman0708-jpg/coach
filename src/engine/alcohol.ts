import type { Rules } from '../data/rules'
import { addDays } from './day'
import type { DayKind } from './schedule'
import type { Basis, DrinkLog, DrinkPreset, DrinkingGoal, Explained, LocalDate } from './types'

/** 에탄올 밀도 (g/mL, 물리 상수) */
export const ETHANOL_G_PER_ML = 0.789

export function alcoholGrams(ml: number, abvPct: number) {
  return ml * (abvPct / 100) * ETHANOL_G_PER_ML
}

export function logGrams(log: DrinkLog, catalog: Record<string, DrinkPreset>) {
  return log.items.reduce((sum, it) => {
    const d = catalog[it.drinkId]
    return d ? sum + alcoholGrams(d.ml, d.abvPct) * it.count : sum
  }, 0)
}

export function logKcal(log: DrinkLog, catalog: Record<string, DrinkPreset>, rules: Rules) {
  const kcalPerGram = rules.alcohol.kcalPerGram.value ?? 7
  return log.items.reduce((sum, it) => {
    const d = catalog[it.drinkId]
    if (!d) return sum
    const each = d.labelKcal ?? alcoholGrams(d.ml, d.abvPct) * kcalPerGram
    return sum + each * it.count
  }, 0)
}

export interface Limits {
  weekly: number
  perOccasion: number
  basis: Basis[]
}

export function drinkLimits(flush: boolean | undefined, rules: Rules): Limits {
  const a = rules.alcohol
  const factor = flush ? (a.flushFactor.value ?? 0.5) : 1
  const basis = [a.weeklyMax.basis, a.perOccasionMax.basis, a.gramsPerDrink.basis]
  if (flush) basis.push(a.flushFactor.basis)
  return { weekly: (a.weeklyMax.value ?? 8) * factor, perOccasion: (a.perOccasionMax.value ?? 3) * factor, basis }
}

export interface DayAlcohol {
  date: LocalDate
  grams: number
  drinks: number
  kcal: number
}

/** 주어진 기간(시작일부터 days일)의 날짜별 음주량. 표준잔 = 알코올 g ÷ 14 */
export function alcoholByDay(
  logs: DrinkLog[],
  from: LocalDate,
  days: number,
  catalog: Record<string, DrinkPreset>,
  rules: Rules,
): DayAlcohol[] {
  const perDrink = rules.alcohol.gramsPerDrink.value ?? 14
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i)
    const dayLogs = logs.filter((l) => l.date === date)
    const grams = dayLogs.reduce((s, l) => s + logGrams(l, catalog), 0)
    const kcal = dayLogs.reduce((s, l) => s + logKcal(l, catalog, rules), 0)
    return { date, grams, drinks: grams / perDrink, kcal }
  })
}

export interface DrinkingStatus {
  allowed: boolean
  level: 'no' | 'ok' | 'caution'
  headline: string
  weekDrinks: number
  weeklyLimit: number
  occasions: number
  goalOccasions: number
  todayDrinks: number
  perOccasionLimit: number
}

export function drinkingStatus(input: {
  date: LocalDate
  kind: DayKind
  week: DayAlcohol[]
  flush: boolean | undefined
  goal: DrinkingGoal
  rules: Rules
}): Explained<DrinkingStatus> {
  const { date, kind, week, flush, goal, rules } = input
  const limits = drinkLimits(flush, rules)
  const weekDrinks = week.reduce((s, d) => s + d.drinks, 0)
  const occasions = week.filter((d) => d.grams > 0).length
  const todayDrinks = week.find((d) => d.date === date)?.drinks ?? 0
  const base = {
    weekDrinks,
    weeklyLimit: limits.weekly,
    occasions,
    goalOccasions: goal.maxOccasionsPerWeek,
    todayDrinks,
    perOccasionLimit: limits.perOccasion,
  }
  const data = [
    { label: '이번 주 음주', value: `${weekDrinks.toFixed(1)}잔 / 기준 ${limits.weekly}잔 (1잔 = 알코올 14 g)` },
    { label: '이번 주 횟수', value: `${occasions}회 / 목표 ${goal.maxOccasionsPerWeek}회` },
  ]
  const flushNote = flush === undefined ? ' 얼굴 홍조 여부를 설정에 입력하면 기준이 맞춰집니다.' : ''

  if (kind === 'strength' && rules.alcohol.noDrinkOnStrengthDay.value) {
    return {
      value: { ...base, allowed: false, level: 'no', headline: '금주 — 근력 운동일' },
      why: { summary: '오늘은 근력 운동일이라 금주합니다. 운동 후 음주는 근단백 합성을 떨어뜨립니다.', data },
      basis: [rules.alcohol.noDrinkOnStrengthDay.basis],
    }
  }
  if (weekDrinks >= limits.weekly) {
    return {
      value: { ...base, allowed: true, level: 'caution', headline: `이번 주 기준 ${limits.weekly}잔에 도달` },
      why: { summary: `이번 주 이미 ${weekDrinks.toFixed(1)}잔을 마셔 적정 음주 기준에 도달했습니다.${flushNote}`, data },
      basis: [...limits.basis, goal.basis],
    }
  }
  if (todayDrinks === 0 && occasions >= goal.maxOccasionsPerWeek) {
    return {
      value: { ...base, allowed: true, level: 'caution', headline: `이번 주 목표 ${goal.maxOccasionsPerWeek}회를 채움` },
      why: { summary: `이번 주 이미 ${occasions}번 마셨습니다. 내 목표는 주 ${goal.maxOccasionsPerWeek}회 이하입니다.${flushNote}`, data },
      basis: [goal.basis, ...limits.basis],
    }
  }
  if (todayDrinks > limits.perOccasion) {
    return {
      value: { ...base, allowed: true, level: 'caution', headline: `오늘 1회 기준 ${limits.perOccasion}잔 초과` },
      why: { summary: `오늘 ${todayDrinks.toFixed(1)}잔으로 1회 기준(${limits.perOccasion}잔)을 넘었습니다.${flushNote}`, data },
      basis: limits.basis,
    }
  }
  const left = Math.max(0, limits.weekly - weekDrinks)
  return {
    value: { ...base, allowed: true, level: 'ok', headline: `마셔도 되는 날 — 주간 기준까지 ${left.toFixed(1)}잔` },
    why: { summary: `근력 운동일이 아니고 이번 주 기준 안입니다. 1회는 ${limits.perOccasion}잔 이하가 기준입니다.${flushNote}`, data },
    basis: [...limits.basis, goal.basis],
  }
}
