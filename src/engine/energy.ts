import { ev } from '../data/rules'
import { parseLocalDate } from './day'
import type { Basis, LocalDate, Settings } from './types'

// 에너지필요추정량: NASEM 2023 (결정 D4). 19세 이상 남성 공식 (Table 5-16)
// EER = 절편 − 10.83×나이 + b×키(cm) + c×체중(kg)
const MALE = {
  inactive: { label: '비활동', a: 753.07, b: 6.5, c: 14.1 },
  low_active: { label: '저활동', a: 581.47, b: 8.3, c: 14.94 },
  active: { label: '활동', a: 1004.82, b: 6.52, c: 15.91 },
  very_active: { label: '매우 활동', a: -517.88, b: 15.61, c: 19.11 },
} as const

export type ActivityLevel = keyof typeof MALE

export function ageOn(today: LocalDate, profile: Settings['profile']): number | null {
  if (profile.birthDate) {
    const t = parseLocalDate(today)
    const b = parseLocalDate(profile.birthDate)
    let age = t.getFullYear() - b.getFullYear()
    if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) age--
    return age
  }
  if (profile.birthYear) return parseLocalDate(today).getFullYear() - profile.birthYear
  return null
}

export function eerTable(age: number, heightCm: number, weightKg: number): { level: ActivityLevel; label: string; kcal: number }[] {
  return (Object.keys(MALE) as ActivityLevel[]).map((level) => {
    const k = MALE[level]
    return { level, label: k.label, kcal: Math.round(k.a - 10.83 * age + k.b * heightCm + k.c * weightKg) }
  })
}

export const EER_BASIS: Basis[] = [
  ev('nasem2023#eerMale'),
  ev('nasem2023#pal'),
  { type: 'needs-evidence', question: '실제 운동 기록으로 활동 수준(PAL)을 정하는 방법은 원문 확인이 필요해, 지금은 표로만 보여줍니다.' },
]
