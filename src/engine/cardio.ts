import type { Rules } from '../data/rules'
import type { CardioKind, CardioLog } from './types'

/** 총소모량(안정 시 대사 포함). 표시용이며 섭취 목표에는 더하지 않는다 (활동계수와 이중 계산 방지). */
export function cardioKcal(met: number, weightKg: number, durationSec: number) {
  return (met * weightKg * durationSec) / 3600
}

/** WHO 기준 비교용 '중강도 환산 분': 고강도(6 MET 이상)는 2배, 중강도(3 MET 이상)는 그대로, 그 아래는 0 */
export function moderateEquivalentMin(logs: CardioLog[], metOf: (kind: CardioKind) => number, rules: Rules) {
  const vig = rules.cardio.vigorousMet.value ?? 6
  const mod = rules.cardio.moderateMet.value ?? 3
  const factor = rules.cardio.vigorousFactor.value ?? 2
  return logs.reduce((sum, l) => {
    const met = metOf(l.kind)
    const min = l.durationSec / 60
    if (met >= vig) return sum + min * factor
    if (met >= mod) return sum + min
    return sum
  }, 0)
}
