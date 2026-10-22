import { CARDIO_BY_KIND, CARDIO_TYPES } from '../data/drinks'
import { ev } from '../data/rules'
import type { Rules } from '../data/rules'
import { moderateEquivalentMin } from './cardio'
import { addDays } from './day'
import type { CardioKind, Equipment, LocalDate, ProgramVersion, ProposalDraft, QuestionDraft, WarningDraft, WorkoutSession } from './types'

// 유산소: 최근 7일 WHO 중강도 환산 분을 150분과 비교, 대화 테스트로 '쉬움'을 판정해 강도를 올린다

const needsBike = (k: CardioKind) => k.startsWith('cycling')

/** MET 순서로 다음(더 강한) 종류. 자전거는 장비가 있어야 한다 */
function nextKind(kind: CardioKind, equipment: Equipment[]): CardioKind | undefined {
  const byMet = [...CARDIO_TYPES].sort((a, b) => a.met - b.met)
  const current = CARDIO_BY_KIND[kind].met
  return byMet.find((c) => c.met > current && (!needsBike(c.kind) || equipment.includes('bicycle')))?.kind
}

export function cardioReview(input: {
  sessions: WorkoutSession[]
  today: LocalDate
  program: ProgramVersion
  equipment: Equipment[]
  rules: Rules
}): { proposals: ProposalDraft[]; warnings: WarningDraft[]; questions: QuestionDraft[]; minutes: number } {
  const { sessions, today, program, equipment, rules } = input
  const from = addDays(today, -6)
  const recent = sessions
    .filter((s) => s.kind === 'cardio' && s.status === 'done' && s.cardio && s.date >= from && s.date <= today)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const logs = recent.map((s) => s.cardio!)
  const minutes = Math.round(moderateEquivalentMin(logs, (k) => CARDIO_BY_KIND[k].met, rules))
  const [target] = rules.cardio.weeklyModerateMin.value ?? [150, 300]
  const proposals: ProposalDraft[] = []
  const warnings: WarningDraft[] = []
  const questions: QuestionDraft[] = []
  const data = [
    { label: '최근 7일 중강도 환산', value: `${minutes}분 / ${target}분` },
    { label: '유산소 횟수', value: `${logs.length}회` },
  ]

  // 대화 테스트에서 2회 연속 '노래도 가능' → 강도 올리기
  const easy = logs.length >= 2 && logs.slice(0, 2).every((l) => l.talkTest === 'can_sing')
  if (easy) {
    const next = nextKind(program.cardio.kind, equipment)
    if (next) {
      proposals.push({
        key: 'cardio:kind',
        title: `유산소 강도 올리기: ${CARDIO_BY_KIND[program.cardio.kind].name} → ${CARDIO_BY_KIND[next].name}`,
        patch: { op: 'cardio', from: program.cardio, to: { ...program.cardio, kind: next } },
        why: { summary: '최근 2회 모두 운동 중 노래까지 가능했다고 기록했습니다. 중강도보다 약한 강도라 한 단계 올립니다.', data },
        basis: [ev('cdcIntensity#talkTest'), ev(CARDIO_BY_KIND[next].ref)],
      })
    }
  }

  if (logs.length > 0 && minutes < target && !easy) {
    const inc = rules.cardio.increaseMinPerSession.value
    if (inc === null) {
      const b = rules.cardio.increaseMinPerSession.basis
      questions.push({ ruleKey: 'cardio.increaseMinPerSession', question: b.type === 'needs-evidence' ? b.question : '', unit: '분' })
      warnings.push({
        key: 'cardio:below',
        level: 'info',
        title: `유산소: 최근 7일 ${minutes}분 (WHO 권고 ${target}분)`,
        why: { summary: '권고량보다 적습니다. 1회 시간을 얼마나 늘릴지 정해 주시면 다음 점검부터 제안합니다.', data },
        basis: [rules.cardio.weeklyModerateMin.basis, rules.cardio.vigorousFactor.basis, ev('who2020#startSmall')],
      })
    } else {
      proposals.push({
        key: 'cardio:minutes',
        title: `유산소 시간: 회당 ${program.cardio.minutes}분 → ${program.cardio.minutes + inc}분`,
        patch: { op: 'cardio', from: program.cardio, to: { ...program.cardio, minutes: program.cardio.minutes + inc } },
        why: { summary: `최근 7일 중강도 환산 ${minutes}분으로 WHO 권고(${target}분)보다 적어 조금씩 늘립니다.`, data },
        basis: [rules.cardio.weeklyModerateMin.basis, rules.cardio.increaseMinPerSession.basis, ev('who2020#startSmall')],
      })
    }
  }

  return { proposals, warnings, questions, minutes }
}
