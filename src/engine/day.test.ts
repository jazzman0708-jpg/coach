import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, logicalDate, timeOnLogicalDate, weekStart, weekdayOf } from './day'

describe('논리적 하루', () => {
  it('새벽 5시 전 기록은 전날로 본다', () => {
    expect(logicalDate(new Date(2026, 9, 23, 1, 30), 5)).toBe('2026-10-22')
    expect(logicalDate(new Date(2026, 9, 23, 4, 59), 5)).toBe('2026-10-22')
    expect(logicalDate(new Date(2026, 9, 23, 5, 0), 5)).toBe('2026-10-23')
  })

  it('월말·연말을 넘어가도 날짜 계산이 맞다', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(daysBetween('2026-10-20', '2026-10-22')).toBe(2)
  })

  it('주의 시작은 월요일', () => {
    expect(weekdayOf('2026-10-22')).toBe(4) // 목
    expect(weekStart('2026-10-22')).toBe('2026-10-19')
    expect(weekStart('2026-10-25')).toBe('2026-10-19') // 일요일은 그 주의 마지막 날
    expect(weekStart('2026-10-26')).toBe('2026-10-26')
  })

  it('경계 시각 이전 시각은 다음 달력 날짜에 놓인다', () => {
    const bed = timeOnLogicalDate('2026-10-22', '01:30', 5)
    expect([bed.getDate(), bed.getHours(), bed.getMinutes()]).toEqual([23, 1, 30])
    const meal = timeOnLogicalDate('2026-10-22', '12:30', 5)
    expect([meal.getDate(), meal.getHours()]).toEqual([22, 12])
  })
})
