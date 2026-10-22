import { timeOnLogicalDate } from './day'
import type { DayKind } from './schedule'
import type { LocalDate, Settings } from './types'

export interface ReminderSettings {
  sleepLog: { enabled: boolean; time: string }
  workout: { enabled: boolean }
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  sleepLog: { enabled: true, time: '11:00' },
  workout: { enabled: true },
}

/** 예전 설정에는 알림 항목이 없을 수 있어 기본값과 합친다 */
export function remindersOf(settings: Settings): ReminderSettings {
  return {
    sleepLog: { ...DEFAULT_REMINDERS.sleepLog, ...settings.reminders?.sleepLog },
    workout: { ...DEFAULT_REMINDERS.workout, ...settings.reminders?.workout },
  }
}

export type ReminderKind = 'sleep' | 'workout'

/** 지금 띄워야 할 알림. 정해진 시각이 지났고 아직 하지 않은 일만 */
export function dueReminders(input: {
  now: Date
  today: LocalDate
  boundaryHour: number
  reminders: ReminderSettings
  workoutTime: string
  kind: DayKind
  sleepLogged: boolean
  workoutDone: boolean
  workoutInProgress: boolean
}): ReminderKind[] {
  const { now, today, boundaryHour, reminders } = input
  const passed = (hhmm: string) => now.getTime() >= timeOnLogicalDate(today, hhmm, boundaryHour).getTime()
  const out: ReminderKind[] = []
  if (reminders.sleepLog.enabled && !input.sleepLogged && passed(reminders.sleepLog.time)) out.push('sleep')
  if (
    reminders.workout.enabled &&
    input.kind !== 'rest' &&
    !input.workoutDone &&
    !input.workoutInProgress &&
    passed(input.workoutTime)
  ) {
    out.push('workout')
  }
  return out
}
