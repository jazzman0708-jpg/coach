import { describe, expect, it } from 'vitest'
import { DRINK_BY_ID } from '../data/drinks'
import { INITIAL_PROGRAM } from '../data/initialProgram'
import { RULES } from '../data/rules'
import { alcoholByDay, alcoholGrams, drinkLimits, drinkingStatus, logKcal } from './alcohol'
import type { DrinkLog } from './types'

const soju = (date: string, count = 1): DrinkLog => ({
  id: date,
  date,
  items: [{ drinkId: 'soju_bottle', count }],
  at: `${date}T21:00:00`,
})

describe('알코올 계산', () => {
  it('소주 1병(360 mL, 16.5%)은 알코올 약 46.9 g, 14 g 기준 약 3.35잔', () => {
    const g = alcoholGrams(360, 16.5)
    expect(g).toBeCloseTo(46.87, 1)
    expect(g / 14).toBeCloseTo(3.35, 2)
  })

  it('열량은 라벨이 없으면 알코올 g × 7 kcal', () => {
    expect(logKcal(soju('2026-10-20'), DRINK_BY_ID, RULES)).toBeCloseTo(328, 0)
  })

  it('얼굴이 빨개지는 체질이면 기준이 절반', () => {
    expect(drinkLimits(false, RULES)).toMatchObject({ weekly: 8, perOccasion: 3 })
    expect(drinkLimits(true, RULES)).toMatchObject({ weekly: 4, perOccasion: 1.5 })
  })
})

describe('음주 가능 여부', () => {
  const week = (logs: DrinkLog[]) => alcoholByDay(logs, '2026-10-19', 7, DRINK_BY_ID, RULES)
  const goal = { ...INITIAL_PROGRAM.drinkingGoal, maxOccasionsPerWeek: 2 }

  it('근력 운동일은 금주', () => {
    const r = drinkingStatus({ date: '2026-10-21', kind: 'strength', week: week([]), flush: false, goal, rules: RULES })
    expect(r.value.allowed).toBe(false)
    expect(r.basis[0]).toMatchObject({ type: 'evidence', refs: ['parr2014#mps'] })
    expect(r.basis[0]).toHaveProperty('extrapolation')
  })

  it('근력 운동일이 아니고 기준 안이면 가능', () => {
    const r = drinkingStatus({ date: '2026-10-22', kind: 'cardio', week: week([soju('2026-10-20')]), flush: false, goal, rules: RULES })
    expect(r.value).toMatchObject({ allowed: true, level: 'ok', occasions: 1 })
  })

  it('목표 횟수(주 2회)를 채웠으면 주의', () => {
    const logs = [soju('2026-10-20'), soju('2026-10-22')]
    const r = drinkingStatus({ date: '2026-10-24', kind: 'cardio', week: week(logs), flush: false, goal, rules: RULES })
    expect(r.value.level).toBe('caution')
    expect(r.value.headline).toContain('2회')
  })

  it('주간 기준을 넘으면 주의', () => {
    const logs = [soju('2026-10-20', 2), soju('2026-10-21')]
    const r = drinkingStatus({ date: '2026-10-24', kind: 'rest', week: week(logs), flush: false, goal, rules: RULES })
    expect(r.value.weekDrinks).toBeGreaterThan(8)
    expect(r.value.headline).toContain('8잔')
  })

  it('홍조 체질이면 소주 2병으로 주간 기준(4잔)을 넘는다', () => {
    const logs = [soju('2026-10-20'), soju('2026-10-22')]
    const r = drinkingStatus({ date: '2026-10-22', kind: 'cardio', week: week(logs), flush: true, goal, rules: RULES })
    expect(r.value.weeklyLimit).toBe(4)
    expect(r.value.level).toBe('caution')
  })
})
