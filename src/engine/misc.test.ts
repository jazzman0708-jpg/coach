import { describe, expect, it } from 'vitest'
import { CARDIO_BY_KIND } from '../data/drinks'
import { INITIAL_PROGRAM } from '../data/initialProgram'
import { RULES } from '../data/rules'
import { cardioKcal, moderateEquivalentMin } from './cardio'
import { dayKind, strengthSpacing } from './schedule'
import { compareLogs, metTarget, previousLog } from './session'
import { shortSleepWarning, sleepHours } from './sleep'
import type { ExerciseLog, SleepLog, WorkoutSession } from './types'

describe('일정', () => {
  it('월·수·금 근력, 화·목·토 유산소, 일 휴식', () => {
    expect(dayKind('2026-10-19', INITIAL_PROGRAM)).toBe('strength')
    expect(dayKind('2026-10-22', INITIAL_PROGRAM)).toBe('cardio')
    expect(dayKind('2026-10-25', INITIAL_PROGRAM)).toBe('rest')
  })

  const strength = (date: string): WorkoutSession => ({
    id: date, date, startedAt: `${date}T14:30:00`, programVersion: 1, kind: 'strength', exercises: [], status: 'done',
  })

  it('어제 근력 운동을 했으면 48시간 경고, 이틀 전이면 통과', () => {
    expect(strengthSpacing('2026-10-20', [strength('2026-10-19')], RULES).value.ok).toBe(false)
    expect(strengthSpacing('2026-10-21', [strength('2026-10-19')], RULES).value.ok).toBe(true)
    expect(strengthSpacing('2026-10-21', [], RULES).value).toMatchObject({ ok: true, lastDate: null })
  })
})

describe('유산소', () => {
  it('자전거(6.8 MET)는 고강도라 WHO 기준 2배로 센다', () => {
    const metOf = (k: keyof typeof CARDIO_BY_KIND) => CARDIO_BY_KIND[k].met
    const min = moderateEquivalentMin(
      [
        { kind: 'walk_brisk', durationSec: 20 * 60, laps: [] },
        { kind: 'cycling_light', durationSec: 20 * 60, laps: [] },
      ],
      metOf,
      RULES,
    )
    expect(min).toBe(60)
  })

  it('빠르게 걷기 20분, 70 kg → 4.8 × 70 × 1/3 = 112 kcal', () => {
    expect(cardioKcal(4.8, 70, 20 * 60)).toBeCloseTo(112, 1)
  })
})

describe('수면', () => {
  const night = (date: string, hours: number): SleepLog => {
    const bed = new Date(`${date}T23:00:00`)
    return { id: date, date, bedAt: bed.toISOString(), wakeAt: new Date(bed.getTime() + hours * 3_600_000).toISOString() }
  }

  it('자정을 넘겨도 수면 시간이 맞다', () => {
    expect(sleepHours({ bedAt: '2026-10-22T23:30:00+09:00', wakeAt: '2026-10-23T07:30:00+09:00' })).toBe(8)
  })

  it('최근 7일 중 4일 이상 7시간 미만이면 경고', () => {
    const logs = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'].map((d) => night(d, 6))
    expect(shortSleepWarning(logs, '2026-10-22', RULES)?.value.shortNights).toBe(4)
    expect(shortSleepWarning(logs.slice(0, 3), '2026-10-22', RULES)).toBeNull()
  })
})

describe('세션 비교', () => {
  const log = (values: number[], target = 10): ExerciseLog => ({
    exerciseId: 'sink_pushup',
    prescribed: { sets: 3, target, restSec: 90 },
    sets: values.map((value) => ({ value, at: '' })),
  })

  it('지난 기록과 총 횟수·최고 기록을 비교한다', () => {
    expect(compareLogs(log([10, 10, 9]), log([9, 8, 8]))).toEqual({ totalDiff: 4, bestDiff: 1, setsDiff: 0 })
    expect(compareLogs(log([10]), undefined)).toBeNull()
  })

  it('가장 최근에 끝난 세션의 같은 종목을 찾는다', () => {
    const s = (id: string, startedAt: string, values: number[], status: WorkoutSession['status'] = 'done'): WorkoutSession => ({
      id, date: startedAt.slice(0, 10), startedAt, programVersion: 1, kind: 'strength', exercises: [log(values)], status,
    })
    const sessions = [s('a', '2026-10-19T14:30:00', [8, 8, 8]), s('b', '2026-10-21T14:30:00', [9, 9, 8]), s('c', '2026-10-22T14:30:00', [1], 'abandoned')]
    expect(previousLog('sink_pushup', sessions, '2026-10-23T14:30:00')?.sets.map((x) => x.value)).toEqual([9, 9, 8])
  })

  it('모든 세트가 목표 이상이어야 달성', () => {
    expect(metTarget(log([10, 11, 10]))).toBe(true)
    expect(metTarget(log([10, 11, 9]))).toBe(false)
    expect(metTarget(log([12, 12]))).toBe(false)
  })
})
