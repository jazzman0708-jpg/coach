import { DRINK_BY_ID } from '../data/drinks'
import { ev } from '../data/rules'
import type { Rules } from '../data/rules'
import { alcoholByDay } from './alcohol'
import type { MuscleSets } from './balance'
import { balanceReview } from './balance'
import { type WeekWindow, nutritionReview } from './bodyTrend'
import { cardioReview } from './cardioReview'
import { addDays, daysBetween } from './day'
import { decideSlot } from './progression'
import { shortSleepWarning, sleepHours } from './sleep'
import type {
  BodyLog,
  DrinkLog,
  LocalDate,
  ProgramVersion,
  ProposalDraft,
  QuestionDraft,
  Settings,
  SleepLog,
  WarningDraft,
  WorkoutSession,
} from './types'

// 주간 점검: 매주 일요일 또는 요청할 때 실행. 모든 규칙을 묶어 "이번 주 변경 제안"을 만든다.
// 순수 함수: 같은 입력이면 항상 같은 출력 (오늘 날짜도 입력으로 받는다)

export interface WeeklySummary {
  sets: MuscleSets
  cardioMinutes: number
  drinks: number
  drinkOccasions: number
  avgSleep: number | null
  windows: WeekWindow[]
  strengthSessions: number
}

export interface WeeklyReview {
  proposals: ProposalDraft[]
  warnings: WarningDraft[]
  questions: QuestionDraft[]
  summary: WeeklySummary
}

export function runWeeklyReview(input: {
  today: LocalDate
  settings: Settings
  program: ProgramVersion
  sessions: WorkoutSession[]
  body: BodyLog[]
  sleep: SleepLog[]
  drinks: DrinkLog[]
  rules: Rules
}): WeeklyReview {
  const { today, settings, program, sessions, body, sleep, drinks, rules } = input
  const equipment = settings.equipment
  const proposals: ProposalDraft[] = []
  const warnings: WarningDraft[] = []
  const questions: QuestionDraft[] = []

  // 운동: 종목별 진행
  for (const slot of program.slots) {
    const r = decideSlot(slot, sessions, equipment, rules)
    if (r.proposal) proposals.push(r.proposal)
    if (r.warning) warnings.push(r.warning)
    if (r.question) questions.push(r.question)
  }

  // 부위 균형
  const balance = balanceReview({ sessions, today, program, equipment, rules })
  proposals.push(...balance.proposals.filter((p) => !proposals.some((q) => q.key === p.key)))
  warnings.push(...balance.warnings)

  // 유산소
  const cardio = cardioReview({ sessions, today, program, equipment, rules })
  proposals.push(...cardio.proposals)
  warnings.push(...cardio.warnings)
  questions.push(...cardio.questions)

  // 빈도: 꾸준히 6개월이 지나면 중급자 빈도(주 3~4회 분할)를 검토
  const firstStrength = sessions.filter((s) => s.kind === 'strength' && s.status === 'done').map((s) => s.date).sort()[0]
  const months = rules.strength.intermediateAfterMonths.value ?? 6
  if (firstStrength && daysBetween(firstStrength, today) >= months * 30) {
    if (rules.strength.consistencyPct.value === null) {
      const b = rules.strength.consistencyPct.basis
      questions.push({ ruleKey: 'strength.consistencyPct', question: b.type === 'needs-evidence' ? b.question : '', unit: '%' })
    } else {
      warnings.push({
        key: 'frequency:intermediate',
        level: 'info',
        title: `근력 운동을 시작한 지 ${months}개월이 지났습니다 — 주 3~4회 분할을 검토할 때`,
        why: { summary: '중급자는 전신이면 주 3회, 상·하체 분할이면 주 4회입니다.' },
        basis: [ev('acsm2009#levels'), ev('acsm2009#intermediate'), rules.strength.consistencyPct.basis],
      })
    }
  }

  // 수면
  const sleepWarn = shortSleepWarning(sleep, today, rules)
  if (sleepWarn) {
    warnings.push({ key: 'sleep:short', level: 'caution', title: `수면 부족: 최근 7일 중 ${sleepWarn.value.shortNights}일 7시간 미만`, why: sleepWarn.why, basis: sleepWarn.basis })
  }

  // 식단 (체중·허리 추세, 단백질)
  const nutrition = nutritionReview({ body, today, program, shortSleep: !!sleepWarn, rules })
  proposals.push(...nutrition.proposals)
  warnings.push(...nutrition.warnings)
  questions.push(...nutrition.questions)

  // 요약
  const from = addDays(today, -6)
  const week = alcoholByDay(drinks, from, 7, DRINK_BY_ID, rules)
  const recentSleep = sleep.filter((s) => s.date >= addDays(today, -7) && s.date < today)

  return {
    proposals,
    warnings,
    questions: questions.filter((q, i) => questions.findIndex((x) => x.ruleKey === q.ruleKey) === i),
    summary: {
      sets: balance.sets,
      cardioMinutes: cardio.minutes,
      drinks: week.reduce((a, d) => a + d.drinks, 0),
      drinkOccasions: week.filter((d) => d.grams > 0).length,
      avgSleep: recentSleep.length ? recentSleep.reduce((a, s) => a + sleepHours(s), 0) / recentSleep.length : null,
      windows: nutrition.windows,
      strengthSessions: sessions.filter((s) => s.kind === 'strength' && s.status === 'done' && s.date >= from && s.date <= today).length,
    },
  }
}
