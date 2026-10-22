import { describe, expect, it } from 'vitest'
import { DEFAULT_REMINDERS, dueReminders } from './reminders'

const base = {
  today: '2026-10-22',
  boundaryHour: 5,
  reminders: DEFAULT_REMINDERS,
  workoutTime: '14:30',
  kind: 'strength' as const,
  sleepLogged: false,
  workoutDone: false,
  workoutInProgress: false,
}

describe('앱 안 알림', () => {
  it('11시 전에는 수면 알림이 없고, 11시가 지나면 생긴다', () => {
    expect(dueReminders({ ...base, now: new Date(2026, 9, 22, 10, 59) })).toEqual([])
    expect(dueReminders({ ...base, now: new Date(2026, 9, 22, 11, 0) })).toEqual(['sleep'])
  })

  it('수면을 기록했으면 수면 알림은 사라진다', () => {
    expect(dueReminders({ ...base, sleepLogged: true, now: new Date(2026, 9, 22, 12, 0) })).toEqual([])
  })

  it('운동 시각이 지났고 아직 안 했으면 운동 알림', () => {
    expect(dueReminders({ ...base, sleepLogged: true, now: new Date(2026, 9, 22, 14, 30) })).toEqual(['workout'])
    expect(dueReminders({ ...base, sleepLogged: true, workoutDone: true, now: new Date(2026, 9, 22, 15, 0) })).toEqual([])
    expect(dueReminders({ ...base, sleepLogged: true, workoutInProgress: true, now: new Date(2026, 9, 22, 15, 0) })).toEqual([])
  })

  it('휴식일에는 운동 알림이 없다', () => {
    expect(dueReminders({ ...base, kind: 'rest', sleepLogged: true, now: new Date(2026, 9, 22, 16, 0) })).toEqual([])
  })

  it('새벽(논리적 하루 안)에도 그날 알림이 유지된다', () => {
    expect(dueReminders({ ...base, now: new Date(2026, 9, 23, 1, 0) })).toEqual(['sleep', 'workout'])
  })

  it('끈 알림은 띄우지 않는다', () => {
    const reminders = { sleepLog: { enabled: false, time: '11:00' }, workout: { enabled: false } }
    expect(dueReminders({ ...base, reminders, now: new Date(2026, 9, 22, 16, 0) })).toEqual([])
  })
})
