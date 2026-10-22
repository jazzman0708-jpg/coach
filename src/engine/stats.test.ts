import { describe, expect, it } from 'vitest'
import { RULES } from '../data/rules'
import { bestRecords, shoulderWaistRatio, waistPoints, weeklyAverage, weeklyRows, weightPoints } from './stats'
import type { BodyLog, WorkoutSession } from './types'

const body = (date: string, weightKg?: number, waistCm?: number): BodyLog => ({ id: date, date, weightKg, waistCm, at: '' })

describe('통계', () => {
  it('체중 주 평균은 월요일 기준 주로 묶고, 그 주 기록의 가운데 날에 찍는다', () => {
    const pts = weightPoints([body('2026-10-20', 70), body('2026-10-21', 69), body('2026-10-23', 69), body('2026-10-26', 68), body('2026-10-10', 72)], '2026-10-15')
    expect(pts.map((p) => p.y)).toEqual([70, 69, 69, 68])
    const avg = weeklyAverage(pts)
    expect(avg.map((p) => p.x)).toEqual(['2026-10-21', '2026-10-26'])
    expect(avg[0].y).toBeCloseTo(69.33, 2)
  })

  it('허리는 주간 기록과 월간 측정을 합치고 같은 날은 주간 기록을 쓴다', () => {
    const monthly = [{ id: 'm', date: '2026-10-20', waistCm: 85, shoulderCm: 110, photoIds: {} }]
    expect(waistPoints([body('2026-10-20', undefined, 84), body('2026-10-27', undefined, 83.5)], monthly, '2026-10-01').map((p) => p.y)).toEqual([84, 83.5])
    expect(shoulderWaistRatio(monthly)[0].y).toBeCloseTo(1.294, 3)
  })

  it('주간 합계: 유산소 환산 분, 근력 횟수, 부위 세트', () => {
    const sessions: WorkoutSession[] = [
      { id: 'a', date: '2026-10-20', startedAt: '', programVersion: 1, kind: 'cardio', exercises: [], cardio: { kind: 'cycling_light', durationSec: 1200, laps: [] }, status: 'done' },
      {
        id: 'b', date: '2026-10-21', startedAt: '', programVersion: 1, kind: 'strength', status: 'done',
        exercises: [{ exerciseId: 'sink_pushup', prescribed: { sets: 3, target: 8, restSec: 90 }, sets: [{ value: 8, at: '' }, { value: 8, at: '' }] }],
      },
    ]
    const rows = weeklyRows({ today: '2026-10-25', weeks: 2, sessions, drinks: [], sleep: [], rules: RULES })
    expect(rows.map((r) => r.week)).toEqual(['2026-10-12', '2026-10-19'])
    expect(rows[1]).toMatchObject({ cardioMin: 40, strengthSessions: 1 })
    expect(rows[1].sets.chest).toBe(2)
  })

  it('종목별 최고 기록은 한 세트 최고와 세션 합계 최고를 따로 본다', () => {
    const s = (date: string, values: number[]): WorkoutSession => ({
      id: date, date, startedAt: '', programVersion: 1, kind: 'strength', status: 'done',
      exercises: [{ exerciseId: 'sink_pushup', prescribed: { sets: 3, target: 8, restSec: 90 }, sets: values.map((value) => ({ value, at: '' })) }],
    })
    const [r] = bestRecords([s('2026-10-19', [12, 8, 8]), s('2026-10-21', [10, 10, 10])])
    expect(r).toMatchObject({ bestSet: 12, bestSetDate: '2026-10-19', bestTotal: 30, bestTotalDate: '2026-10-21', sessions: 2 })
  })
})
