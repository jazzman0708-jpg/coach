import { evx } from '../data/rules'
import type { Rules } from '../data/rules'
import { daysBetween, weekdayOf } from './day'
import type { Explained, LocalDate, ProgramVersion, WorkoutSession } from './types'

export type DayKind = 'strength' | 'cardio' | 'rest'

export function dayKind(date: LocalDate, program: ProgramVersion): DayKind {
  const wd = weekdayOf(date)
  if (program.strengthDays.includes(wd)) return 'strength'
  if (program.cardio.days.includes(wd)) return 'cardio'
  return 'rest'
}

export interface Spacing {
  ok: boolean
  lastDate: LocalDate | null
  daysSince: number | null
}

/**
 * 같은 근육군 48시간 휴식 (Garber 2011).
 * 매번 비슷한 시각에 운동하면 몇 분 차이로 48시간에 못 미칠 수 있어서, 날짜 기준(사이에 하루 이상 쉼)으로 판정한다.
 * 이 앱의 근력 세션은 전신이라 모든 근력 세션을 같은 근육군으로 본다.
 */
export function strengthSpacing(date: LocalDate, sessions: WorkoutSession[], rules: Rules): Explained<Spacing> {
  const minHours = rules.strength.minRestHoursSameMuscle.value ?? 48
  const minDays = Math.ceil(minHours / 24)
  const last = sessions
    .filter((s) => s.kind === 'strength' && s.status === 'done' && s.date < date)
    .map((s) => s.date)
    .sort()
    .at(-1)
  const daysSince = last ? daysBetween(last, date) : null
  const ok = daysSince === null || daysSince >= minDays
  return {
    value: { ok, lastDate: last ?? null, daysSince },
    why: {
      summary: ok
        ? last
          ? `마지막 근력 운동이 ${daysSince}일 전이라 충분히 쉬었습니다.`
          : '이전 근력 운동 기록이 없습니다.'
        : `마지막 근력 운동이 어제(${last})였습니다. 같은 근육군은 48시간 이상 쉬는 게 권장됩니다.`,
      data: last ? [{ label: '마지막 근력 운동', value: last }] : [],
    },
    basis: [
      evx('48시간을 날짜 기준(사이에 하루 이상 쉼)으로 판정. 같은 시각대에 운동할 때 몇 분 차이로 경고가 뜨지 않게 하기 위함', 'garber2011#rest48'),
    ],
  }
}
