import type { Rules } from '../data/rules'
import { addDays } from './day'
import type { Explained, LocalDate, SleepLog } from './types'

export function sleepHours(log: Pick<SleepLog, 'bedAt' | 'wakeAt'>) {
  return (new Date(log.wakeAt).getTime() - new Date(log.bedAt).getTime()) / 3_600_000
}

export interface ShortSleep {
  shortNights: number
  loggedNights: number
}

/** 최근 7일(어젯밤까지) 중 7시간 미만인 밤이 기준 이상이면 경고를 반환한다. */
export function shortSleepWarning(logs: SleepLog[], today: LocalDate, rules: Rules): Explained<ShortSleep> | null {
  const minHours = rules.sleep.minHours.value ?? 7
  const threshold = rules.sleep.shortNightsPerWeek.value
  if (threshold === null) return null
  const from = addDays(today, -7)
  const recent = logs.filter((l) => l.date >= from && l.date < today)
  const short = recent.filter((l) => sleepHours(l) < minHours)
  if (short.length < threshold) return null
  const avg = recent.reduce((s, l) => s + sleepHours(l), 0) / recent.length
  return {
    value: { shortNights: short.length, loggedNights: recent.length },
    why: {
      summary: `최근 7일 중 ${short.length}일이 ${minHours}시간 미만이었습니다. 감량 중 수면이 부족하면 지방은 덜 빠지고 근육은 더 빠집니다.`,
      data: [
        { label: `${minHours}시간 미만`, value: `${short.length}일 / 기록 ${recent.length}일` },
        { label: '평균 수면', value: `${avg.toFixed(1)}시간` },
      ],
    },
    basis: [rules.sleep.minHours.basis, rules.sleep.shortNightsPerWeek.basis, { type: 'evidence', refs: ['nedeltcheva2010#deficit'], extrapolation: '연구는 잠자리 5.5시간 조건. 7시간 미만 전체에 적용하는 것은 확장' }],
  }
}
