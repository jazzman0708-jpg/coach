import { EXERCISES, GOAL_PRIORITY, LADDERS, MUSCLE_LABEL } from '../data/exercises'
import { ev, evx, pref } from '../data/rules'
import type { Rules } from '../data/rules'
import { addDays } from './day'
import type { Equipment, LocalDate, Muscle, ProgramVersion, ProposalDraft, WarningDraft, WorkoutSession } from './types'

// 부위 균형: 최근 7일 부위별 세트 (주동근 1세트, 보조근 0.5세트 — Pelland 2025)
// 우선 부위(어깨 측면·가슴·등)는 주 5~10세트, 유지 부위(하체)는 주 4세트 이상 + 주 2일 이상(WHO)

export type MuscleSets = Record<Muscle, number>

export function weeklySets(sessions: WorkoutSession[], today: LocalDate, rules: Rules): { sets: MuscleSets; days: Record<Muscle, number> } {
  const from = addDays(today, -6)
  const indirect = rules.strength.indirectSetWeight.value ?? 0
  const sets = Object.fromEntries(Object.keys(MUSCLE_LABEL).map((m) => [m, 0])) as MuscleSets
  const daySets = new Map<Muscle, Set<LocalDate>>()
  for (const s of sessions) {
    if (s.kind !== 'strength' || s.status !== 'done' || s.date < from || s.date > today) continue
    for (const e of s.exercises) {
      const ex = EXERCISES[e.exerciseId]
      if (!ex || e.sets.length === 0) continue
      for (const m of ex.primary) {
        sets[m] += e.sets.length
        daySets.set(m, (daySets.get(m) ?? new Set()).add(s.date))
      }
      for (const m of ex.secondary ?? []) sets[m] += e.sets.length * indirect
    }
  }
  const days = Object.fromEntries(Object.keys(MUSCLE_LABEL).map((m) => [m, daySets.get(m as Muscle)?.size ?? 0])) as Record<Muscle, number>
  return { sets, days }
}

const hasAll = (equipment: Equipment[], need: Equipment[]) => need.every((e) => equipment.includes(e))

export function balanceReview(input: {
  sessions: WorkoutSession[]
  today: LocalDate
  program: ProgramVersion
  equipment: Equipment[]
  rules: Rules
}): { proposals: ProposalDraft[]; warnings: WarningDraft[]; sets: MuscleSets } {
  const { sessions, today, program, equipment, rules } = input
  const { sets, days } = weeklySets(sessions, today, rules)
  const proposals: ProposalDraft[] = []
  const warnings: WarningDraft[] = []
  const [low] = rules.strength.weeklySetsPriority.value ?? [5, 10]
  const maintain = rules.strength.weeklySetsMaintain.value ?? 4
  const goalBasis = pref('요청서의 목표: 어깨 측면·가슴·등 우선, 하체는 유지')
  const anyStrength = sessions.some((s) => s.kind === 'strength' && s.status === 'done' && s.date >= addDays(today, -6))

  if (anyStrength) {
    for (const m of Object.keys(GOAL_PRIORITY) as Muscle[]) {
      const p = GOAL_PRIORITY[m]
      if (p === 'priority' && sets[m] < low) {
        warnings.push({
          key: `sets:${m}`,
          level: 'info',
          title: `${MUSCLE_LABEL[m]}: 이번 주 ${sets[m]}세트 (우선 부위 권장 ${low}세트 이상)`,
          why: { summary: '근육별 주간 세트는 5~10세트에서 효율이 가장 좋았습니다. 보조로 쓰인 근육은 0.5세트로 셉니다.' },
          basis: [rules.strength.weeklySetsPriority.basis, rules.strength.indirectSetWeight.basis, goalBasis],
        })
      }
      if (p === 'maintain' && sets[m] < maintain) {
        warnings.push({
          key: `sets:${m}`,
          level: 'caution',
          title: `${MUSCLE_LABEL[m]}: 이번 주 ${sets[m]}세트 (유지 최소 ${maintain}세트)`,
          why: { summary: '유지 부위도 최소 유효량은 지키는 것이 좋습니다.' },
          basis: [rules.strength.weeklySetsMaintain.basis, goalBasis],
        })
      }
    }
    const legDays = days.legs
    const minDays = rules.strength.lowerBodyMinDays.value ?? 2
    if (legDays < minDays) {
      warnings.push({
        key: 'days:legs',
        level: 'caution',
        title: `하체: 이번 주 ${legDays}일 (주 ${minDays}일 이상 권장)`,
        why: { summary: 'WHO는 주요 근육군 전체를 주 2일 이상 운동하라고 권고합니다.' },
        basis: [rules.strength.lowerBodyMinDays.basis],
      })
    }
  }

  // 어깨 측면이 우선인데 처방에 직접 자극 종목이 없으면 → 레터럴 레이즈 추가 또는 장비 제안
  if (GOAL_PRIORITY.delt_side === 'priority' && !program.slots.some((s) => s.pattern === 'lateral_delt')) {
    const ladder = LADDERS.find((l) => l.pattern === 'lateral_delt')!
    const option = (ladder.loaded ?? []).map((id) => EXERCISES[id]).find((e) => e && hasAll(equipment, e.equipment))
    if (option) {
      proposals.push({
        key: 'slot:lateral_delt',
        title: `${option.name} 추가 (어깨 측면)`,
        patch: { op: 'slot.set', pattern: 'lateral_delt', to: { pattern: 'lateral_delt', exerciseId: option.id, sets: 3, target: option.range.min, restSec: option.restSec } },
        why: { summary: `어깨 측면이 1순위 목표인데 지금 처방에는 직접 자극하는 종목이 없습니다. 이번 주 어깨 측면 ${sets.delt_side}세트.` },
        basis: [ev('campos2020#medialDelt'), option.rangeBasis, goalBasis],
      })
    } else {
      proposals.push({
        key: 'equip:lateral_delt',
        title: '장비 제안: 저항 밴드 (어깨 측면 운동용)',
        patch: { op: 'equipment.suggest', equipment: ['band'] },
        why: { summary: '어깨 측면은 맨몸 종목이 없어 밴드나 덤벨이 있어야 레터럴 레이즈를 넣을 수 있습니다. 밴드가 생기면 설정 → 장비에서 켜 주세요.' },
        basis: [ev('campos2020#medialDelt'), goalBasis],
      })
    }
  }

  // 수직 밀기가 없으면 → 파이크 푸쉬업 계열 추가 (숄더 프레스 ≈ 레터럴 레이즈, Campos 2020)
  if (GOAL_PRIORITY.delt_side === 'priority' && !program.slots.some((s) => s.pattern === 'vertical_push')) {
    const ladder = LADDERS.find((l) => l.pattern === 'vertical_push')!
    const first = ladder.steps.map((id) => EXERCISES[id]).find((e) => e && hasAll(equipment, e.equipment))
    if (first) {
      proposals.push({
        key: 'slot:vertical_push',
        title: `${first.name} 추가 (수직 밀기)`,
        patch: { op: 'slot.set', pattern: 'vertical_push', to: { pattern: 'vertical_push', exerciseId: first.id, sets: 3, target: first.range.min, restSec: first.restSec } },
        why: { summary: '어깨 측면 활성도는 숄더 프레스와 레터럴 레이즈가 비슷했습니다. 장비 없이 할 수 있는 수직 밀기를 넣어 어깨를 자극합니다.' },
        basis: [evx('덤벨 숄더 프레스 결과를 맨몸 파이크 푸쉬업에 적용', 'campos2020#medialDelt'), first.rangeBasis, goalBasis],
      })
    }
  }

  return { proposals, warnings, sets }
}
