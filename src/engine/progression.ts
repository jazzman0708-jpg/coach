import { EXERCISES, LADDERS } from '../data/exercises'
import { evx, ev, userDecision } from '../data/rules'
import type { Rules } from '../data/rules'
import type { Basis, Equipment, Exercise, ExerciseLog, ProposalDraft, QuestionDraft, Slot, WarningDraft, WorkoutSession } from './types'

// 운동 진행 규칙 (ACSM 2009 + 결정 D1·D2)
// - 2회 연속 세션에서 모든 세트가 목표 +1회 이상 → 다음 목표 = 최근 세션의 가장 적게 한 세트 횟수 (상한까지, 사용자 결정)
// - 상한에서도 2회 연속 +1회 이상 → 사다리 다음 종목 (맨몸에서 '부하 증가'를 더 어려운 변형으로 적용)
// - 2회 연속 미달 → 유지, 3회 연속 미달 → 한 단계 내림 (사용자 결정값)
// - 관절·찌르는 통증 / 위험 신호 → 한 단계 내림 + 전문의 안내
// - 시간 종목·근거 없는 반복 범위 → 자동으로 바꾸지 않고, 필요한 값을 사용자에게 묻는다

export interface SlotResult {
  proposal?: ProposalDraft
  warning?: WarningDraft
  question?: QuestionDraft
}

const hasAll = (ex: Exercise, equipment: Equipment[]) => ex.equipment.every((e) => equipment.includes(e))

/** 이 종목을 같은 목표로 한 최근 기록 (최신 순) */
export function recentLogs(slot: Slot, sessions: WorkoutSession[]): ExerciseLog[] {
  return sessions
    .filter((s) => s.kind === 'strength' && s.status === 'done')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .flatMap((s) => s.exercises.filter((e) => e.exerciseId === slot.exerciseId && e.sets.length > 0 && e.prescribed.target === slot.target))
}

function neighbor(exerciseId: string, dir: 1 | -1, equipment: Equipment[]): Exercise | undefined {
  const ladder = LADDERS.find((l) => l.steps.includes(exerciseId))
  if (!ladder) return undefined
  const steps = ladder.steps
  for (let i = steps.indexOf(exerciseId) + dir; i >= 0 && i < steps.length; i += dir) {
    const ex = EXERCISES[steps[i]]
    if (ex && hasAll(ex, equipment)) return ex
  }
  return undefined
}

/** 다음 단계 종목인데 장비가 없어서 못 가는 경우의 그 종목 */
function blockedNext(exerciseId: string, equipment: Equipment[]): Exercise | undefined {
  const ladder = LADDERS.find((l) => l.steps.includes(exerciseId))
  const nextId = ladder?.steps[ladder.steps.indexOf(exerciseId) + 1]
  const ex = nextId ? EXERCISES[nextId] : undefined
  return ex && !hasAll(ex, equipment) ? ex : undefined
}

const unitOf = (ex: Exercise) => (ex.metric === 'seconds' ? '초' : '회')
const fmtSets = (l: ExerciseLog, ex: Exercise) => l.sets.map((s) => s.value).join('·') + unitOf(ex)

export function decideSlot(slot: Slot, sessions: WorkoutSession[], equipment: Equipment[], rules: Rules): SlotResult {
  const ex = EXERCISES[slot.exerciseId]
  if (!ex) return {}
  const logs = recentLogs(slot, sessions)
  const latest = logs[0]
  if (!latest) return {}
  const unit = unitOf(ex)
  const recentData = logs.slice(0, 3).map((l, i) => ({ label: i === 0 ? '최근' : `${i + 1}번째 전`, value: fmtSets(l, ex) }))
  const safetyRule = userDecision('요청서의 안전 규칙: 통증이 기록되면 해당 부위 종목을 내리고 전문의 상담 안내')

  // 1) 통증
  if (latest.pain && latest.pain.kind !== 'soreness') {
    const red = latest.pain.kind === 'red_flag'
    const prev = neighbor(ex.id, -1, equipment)
    const warning: WarningDraft = {
      key: `pain:${slot.pattern}`,
      level: red ? 'stop' : 'caution',
      title: red ? `${ex.name}: 위험 신호가 기록됨 — 진료를 먼저 받으세요` : `${ex.name}: 관절·찌르는 통증이 기록됨`,
      why: { summary: '통증이 계속되면 전문의와 상담하세요. 근육 뻐근함과 달리 관절·찌르는 통증은 무리하지 않는 것이 원칙입니다.' },
      basis: [safetyRule, ev('nhsSprains#redFlags'), ...(red ? [ev('kim2016rhabdo#darkUrine')] : [])],
    }
    if (!prev) return { warning }
    return {
      warning,
      proposal: {
        key: `slot:${slot.pattern}`,
        title: `${ex.name} → ${prev.name} (통증으로 한 단계 내림)`,
        patch: { op: 'slot.set', pattern: slot.pattern, from: slot, to: { ...slot, exerciseId: prev.id, target: prev.range.min, restSec: prev.restSec } },
        why: { summary: `최근 세션에서 통증이 기록되어 더 쉬운 단계의 하한(${prev.range.min}${unitOf(prev)})부터 다시 시작합니다.`, data: recentData },
        basis: [safetyRule, prev.rangeBasis],
      },
    }
  }

  const overBy = rules.strength.progressTrigger.value?.overBy ?? 1
  const n = rules.strength.progressTrigger.value?.consecutiveSessions ?? 2
  const isTimed = ex.metric === 'seconds'
  // 시간 종목은 '목표 시간 채움'을, 반복 종목은 ACSM대로 '목표 +1회 이상'을 기준으로 본다
  const passed = (l: ExerciseLog) =>
    l.sets.length >= l.prescribed.sets && l.sets.every((s) => s.value >= l.prescribed.target + (isTimed ? 0 : overBy))
  const missed = (l: ExerciseLog) => l.sets.length < l.prescribed.sets || l.sets.some((s) => s.value < l.prescribed.target)

  // 2) 올리기
  if (logs.length >= n && logs.slice(0, n).every(passed)) {
    if (isTimed) {
      const inc = rules.strength.holdIncreaseSec.value
      const advanceAt = rules.strength.holdAdvanceAtSec.value
      if (advanceAt !== null && slot.target >= advanceAt) {
        const next = neighbor(ex.id, 1, equipment)
        if (next) {
          return {
            proposal: {
              key: `slot:${slot.pattern}`,
              title: `${ex.name} → ${next.name} (다음 단계)`,
              patch: { op: 'slot.set', pattern: slot.pattern, from: slot, to: { ...slot, exerciseId: next.id, target: next.range.min, restSec: next.restSec } },
              why: { summary: `${n}회 연속 모든 세트에서 ${slot.target}${unit}를 채웠고, 다음 단계로 넘어갈 기준(${advanceAt}초)에 도달했습니다.`, data: recentData },
              basis: [rules.strength.holdAdvanceAtSec.basis, next.rangeBasis],
            },
          }
        }
      }
      if (inc === null) return { question: { ruleKey: 'strength.holdIncreaseSec', question: rules.strength.holdIncreaseSec.basis.type === 'needs-evidence' ? rules.strength.holdIncreaseSec.basis.question : '', unit: '초' } }
      if (advanceAt === null && slot.target + inc > ex.range.max) {
        return { question: { ruleKey: 'strength.holdAdvanceAtSec', question: rules.strength.holdAdvanceAtSec.basis.type === 'needs-evidence' ? rules.strength.holdAdvanceAtSec.basis.question : '', unit: '초' } }
      }
      return {
        proposal: {
          key: `slot:${slot.pattern}`,
          title: `${ex.name}: ${slot.target}초 → ${slot.target + inc}초`,
          patch: { op: 'slot.set', pattern: slot.pattern, from: slot, to: { ...slot, target: slot.target + inc } },
          why: { summary: `${n}회 연속 모든 세트에서 목표 ${slot.target}초를 채웠습니다.`, data: recentData },
          basis: [rules.strength.holdIncreaseSec.basis],
        },
      }
    }

    const progressBasis: Basis = ev('acsm2009#progression')
    if (slot.target < ex.range.max) {
      const minSet = Math.min(...latest.sets.map((s) => s.value))
      const to = rules.strength.nextTargetFromMinSet.value ? Math.min(ex.range.max, minSet) : ex.range.max
      return {
        proposal: {
          key: `slot:${slot.pattern}`,
          title: `${ex.name}: 목표 ${slot.target}회 → ${to}회`,
          patch: { op: 'slot.set', pattern: slot.pattern, from: slot, to: { ...slot, target: to } },
          why: {
            summary:
              to < ex.range.max
                ? `${n}회 연속 모든 세트에서 목표보다 ${overBy}회 이상 더 했습니다. 최근 세션에서 가장 적게 한 세트(${minSet}회)를 다음 목표로 합니다.`
                : `${n}회 연속 모든 세트에서 목표보다 ${overBy}회 이상 더 했습니다. 반복 범위 상한(${ex.range.max}회)을 목표로 합니다.`,
            data: recentData,
          },
          basis: [progressBasis, ex.rangeBasis, rules.strength.nextTargetFromMinSet.basis],
        },
      }
    }
    const next = neighbor(ex.id, 1, equipment)
    if (next) {
      return {
        proposal: {
          key: `slot:${slot.pattern}`,
          title: `${ex.name} → ${next.name} (다음 단계)`,
          patch: { op: 'slot.set', pattern: slot.pattern, from: slot, to: { ...slot, exerciseId: next.id, target: next.range.min, restSec: next.restSec } },
          why: { summary: `상한(${ex.range.max}회)에서도 ${n}회 연속 목표보다 더 했습니다. 더 어려운 종목의 하한(${next.range.min}${unitOf(next)})부터 시작합니다.`, data: recentData },
          basis: [evx('맨몸 운동에서는 부하를 올리는 대신 더 어려운 변형으로 바꾼다', 'acsm2009#progression'), next.rangeBasis],
        },
      }
    }
    const blocked = blockedNext(ex.id, equipment)
    if (blocked) {
      const missing = blocked.equipment.filter((e) => !equipment.includes(e))
      return {
        proposal: {
          key: `equip:${slot.pattern}`,
          title: `장비 제안: ${blocked.name}에 필요한 장비`,
          patch: { op: 'equipment.suggest', equipment: missing },
          why: { summary: `${ex.name}은 상한까지 진행했는데, 다음 단계(${blocked.name})는 지금 장비로 할 수 없습니다.`, data: recentData },
          basis: [ev('acsm2009#progression')],
        },
      }
    }
    return {}
  }

  // 3) 미달
  let misses = 0
  for (const l of logs) {
    if (!missed(l)) break
    misses++
  }
  const regressAt = rules.strength.regressAfterMisses.value
  const holdAt = rules.strength.holdAfterMisses.value
  if (regressAt !== null && misses >= regressAt) {
    const prev = neighbor(ex.id, -1, equipment)
    if (prev) {
      return {
        proposal: {
          key: `slot:${slot.pattern}`,
          title: `${ex.name} → ${prev.name} (한 단계 내림)`,
          patch: { op: 'slot.set', pattern: slot.pattern, from: slot, to: { ...slot, exerciseId: prev.id, target: prev.range.min, restSec: prev.restSec } },
          why: { summary: `${misses}회 연속 목표(${slot.target}${unit})에 못 미쳤습니다. 쉬운 단계의 하한부터 다시 쌓습니다.`, data: recentData },
          basis: [rules.strength.regressAfterMisses.basis, prev.rangeBasis],
        },
      }
    }
  }
  if (holdAt !== null && misses >= holdAt) {
    return {
      warning: {
        key: `hold:${slot.pattern}`,
        level: 'info',
        title: `${ex.name}: ${misses}회 연속 목표 미달 — 같은 단계 유지`,
        why: { summary: `한 번 더 미달하면 한 단계 내리는 제안이 나갑니다.`, data: recentData },
        basis: [rules.strength.holdAfterMisses.basis],
      },
    }
  }
  return {}
}
