import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, INITIAL_PROGRAM } from '../data/initialProgram'
import { RULES } from '../data/rules'
import { balanceReview } from './balance'
import { nutritionReview } from './bodyTrend'
import { cardioReview } from './cardioReview'
import { addDays } from './day'
import { ageOn, eerTable } from './energy'
import { applyPatch, withOverrides } from './program'
import { decideSlot } from './progression'
import type { BodyLog, CardioLog, ProgramVersion, Slot, WorkoutSession } from './types'
import { runWeeklyReview } from './weeklyReview'

const EQUIP = DEFAULT_SETTINGS.equipment
const sink: Slot = { pattern: 'horizontal_push', exerciseId: 'sink_pushup', sets: 3, target: 8, restSec: 90 }

let n = 0
function strength(date: string, exerciseId: string, target: number, values: number[], pain?: WorkoutSession['exercises'][0]['pain']): WorkoutSession {
  n++
  return {
    id: `s${n}`,
    date,
    startedAt: `${date}T14:30:00`,
    programVersion: 1,
    kind: 'strength',
    exercises: [{ exerciseId, prescribed: { sets: values.length, target, restSec: 90 }, sets: values.map((value) => ({ value, at: '' })), pain }],
    status: 'done',
  }
}

function cardio(date: string, log: Partial<CardioLog>): WorkoutSession {
  n++
  return {
    id: `c${n}`,
    date,
    startedAt: `${date}T14:30:00`,
    programVersion: 1,
    kind: 'cardio',
    exercises: [],
    cardio: { kind: 'walk_brisk', durationSec: 20 * 60, laps: [], ...log },
    status: 'done',
  }
}

describe('운동 진행 (ACSM 2009 + 결정 D1·D2)', () => {
  it('목표 +1회 이상이 한 번뿐이면 올리지 않는다 (2회 연속 조건)', () => {
    const r = decideSlot(sink, [strength('2026-10-19', 'sink_pushup', 8, [9, 9, 9])], EQUIP, RULES)
    expect(r.proposal).toBeUndefined()
  })

  it('2회 연속이면 목표를 반복 범위 상한(12회)까지 올린다', () => {
    const r = decideSlot(sink, [strength('2026-10-19', 'sink_pushup', 8, [9, 10, 9]), strength('2026-10-21', 'sink_pushup', 8, [10, 9, 9])], EQUIP, RULES)
    expect(r.proposal?.patch).toMatchObject({ op: 'slot.set', to: { exerciseId: 'sink_pushup', target: 12 } })
    expect(r.proposal?.basis[0]).toMatchObject({ refs: ['acsm2009#progression'] })
  })

  it('목표만 채운 경우(목표 +0)는 올리지 않는다', () => {
    const r = decideSlot(sink, [strength('2026-10-19', 'sink_pushup', 8, [8, 8, 8]), strength('2026-10-21', 'sink_pushup', 8, [8, 8, 8])], EQUIP, RULES)
    expect(r.proposal).toBeUndefined()
  })

  it('상한에서도 2회 연속 넘기면 사다리 다음 종목 하한부터', () => {
    const slot = { ...sink, target: 12 }
    const r = decideSlot(slot, [strength('2026-10-19', 'sink_pushup', 12, [13, 13, 14]), strength('2026-10-21', 'sink_pushup', 12, [13, 13, 13])], EQUIP, RULES)
    expect(r.proposal?.patch).toMatchObject({ to: { exerciseId: 'desk_pushup', target: 8 } })
  })

  it('다음 단계 장비가 없으면 다음 가능한 단계로 건너뛴다', () => {
    const slot = { ...sink, target: 12 }
    const noTable = EQUIP.filter((e) => e !== 'sturdy_table')
    const r = decideSlot(slot, [strength('2026-10-19', 'sink_pushup', 12, [13, 13, 13]), strength('2026-10-21', 'sink_pushup', 12, [13, 13, 13])], noTable, RULES)
    expect(r.proposal?.patch).toMatchObject({ to: { exerciseId: 'chair_pushup' } })
  })

  it('2회 연속 미달은 유지 안내, 3회 연속 미달은 한 단계 내림', () => {
    const two = [strength('2026-10-19', 'sink_pushup', 8, [7, 6, 6]), strength('2026-10-21', 'sink_pushup', 8, [7, 7, 6])]
    expect(decideSlot(sink, two, EQUIP, RULES)).toMatchObject({ warning: { level: 'info' } })
    const three = [...two, strength('2026-10-23', 'sink_pushup', 8, [7, 7, 7])]
    expect(decideSlot(sink, three, EQUIP, RULES).proposal?.patch).toMatchObject({ to: { exerciseId: 'wall_pushup', target: 8 } })
  })

  it('관절 통증이 기록되면 한 단계 내리고 경고한다', () => {
    const r = decideSlot(sink, [strength('2026-10-21', 'sink_pushup', 8, [9, 9, 9], { kind: 'joint_or_sharp', area: 'shoulder' })], EQUIP, RULES)
    expect(r.warning?.level).toBe('caution')
    expect(r.proposal?.patch).toMatchObject({ to: { exerciseId: 'wall_pushup' } })
  })

  it('근육 뻐근함은 단계를 내리지 않는다', () => {
    const r = decideSlot(sink, [strength('2026-10-21', 'sink_pushup', 8, [8, 8, 8], { kind: 'soreness', area: 'shoulder' })], EQUIP, RULES)
    expect(r.proposal).toBeUndefined()
  })

  it('시간 종목은 근거가 없으므로 자동으로 늘리지 않고 묻는다, 답하면 그 값으로 제안한다', () => {
    const hang: Slot = { pattern: 'vertical_pull', exerciseId: 'dead_hang', sets: 3, target: 20, restSec: 60 }
    const logs = [strength('2026-10-19', 'dead_hang', 20, [20, 20, 22]), strength('2026-10-21', 'dead_hang', 20, [21, 20, 20])]
    expect(decideSlot(hang, logs, EQUIP, RULES).question?.ruleKey).toBe('strength.holdIncreaseSec')
    const rules = withOverrides(RULES, [{ key: 'strength.holdIncreaseSec', value: 5, decidedAt: '2026-10-25', note: '테스트' }])
    const r = decideSlot(hang, logs, EQUIP, rules)
    expect(r.proposal?.patch).toMatchObject({ to: { target: 25 } })
    expect(r.proposal?.basis[0]).toMatchObject({ type: 'user-decision' })
  })
})

describe('부위 균형', () => {
  it('어깨 측면 종목이 없고 밴드도 없으면 밴드 구입과 수직 밀기 추가를 제안한다', () => {
    const r = balanceReview({ sessions: [], today: '2026-10-25', program: INITIAL_PROGRAM, equipment: EQUIP, rules: RULES })
    expect(r.proposals.map((p) => p.key)).toEqual(['equip:lateral_delt', 'slot:vertical_push'])
    expect(r.proposals[1].patch).toMatchObject({ to: { exerciseId: 'incline_pike_pushup' } })
  })

  it('밴드가 생기면 레터럴 레이즈를 넣자고 제안한다', () => {
    const r = balanceReview({ sessions: [], today: '2026-10-25', program: INITIAL_PROGRAM, equipment: [...EQUIP, 'band'], rules: RULES })
    expect(r.proposals[0].patch).toMatchObject({ op: 'slot.set', to: { exerciseId: 'band_lateral_raise' } })
  })

  it('주동근 1세트, 보조근 0.5세트로 센다', () => {
    const s = strength('2026-10-21', 'sink_pushup', 8, [8, 8, 8])
    const r = balanceReview({ sessions: [s], today: '2026-10-25', program: INITIAL_PROGRAM, equipment: EQUIP, rules: RULES })
    expect(r.sets.chest).toBe(3)
    expect(r.sets.delt_front).toBe(1.5)
  })
})

describe('유산소', () => {
  it('WHO 150분에 못 미치면 몇 분씩 늘릴지 묻는다', () => {
    const r = cardioReview({ sessions: [cardio('2026-10-21', {})], today: '2026-10-25', program: INITIAL_PROGRAM, equipment: EQUIP, rules: RULES })
    expect(r.minutes).toBe(20)
    expect(r.questions[0].ruleKey).toBe('cardio.increaseMinPerSession')
  })

  it('2회 연속 노래까지 가능했으면 자전거로 강도를 올린다', () => {
    const s = [cardio('2026-10-20', { talkTest: 'can_sing' }), cardio('2026-10-22', { talkTest: 'can_sing' })]
    const r = cardioReview({ sessions: s, today: '2026-10-25', program: INITIAL_PROGRAM, equipment: EQUIP, rules: RULES })
    expect(r.proposals[0].patch).toMatchObject({ op: 'cardio', to: { kind: 'cycling_light' } })
  })
})

describe('식단 단계 판단 (결정 D6·D7)', () => {
  const daily = (from: string, days: number, kg: (i: number) => number, waist?: number): BodyLog[] =>
    Array.from({ length: days }, (_, i) => ({
      id: `${from}-${i}`,
      date: addDays(from, i),
      weightKg: kg(i),
      waistCm: waist !== undefined && i === days - 1 ? waist : undefined,
      at: '',
    }))
  const today = '2026-11-08'
  const w2 = '2026-10-19'
  const w1 = '2026-10-26'
  const w0 = '2026-11-02'

  it('측정이 주 3회 미만이면 판단하지 않는다', () => {
    const r = nutritionReview({ body: daily(w0, 2, () => 68), today, program: INITIAL_PROGRAM, shortSleep: false, rules: RULES })
    expect(r.proposals.filter((p) => p.key === 'nutrition:kcal')).toEqual([])
    expect(r.warnings[0].key).toBe('body:data')
  })

  it('주 1% 넘게 빠지면 150 kcal 늘린다', () => {
    const body = [...daily(w1, 7, () => 68), ...daily(w0, 7, () => 67.2)]
    const r = nutritionReview({ body, today, program: INITIAL_PROGRAM, shortSleep: false, rules: RULES })
    expect(r.proposals[0].patch).toEqual({ op: 'nutrition', field: 'kcal', from: 2100, to: 2250 })
  })

  it('체중·허리 둘 다 2주 그대로면 150 kcal 줄이고, 수면 부족이면 절반만', () => {
    const body = [...daily(w2, 7, () => 68, 84), ...daily(w1, 7, () => 68.1, 84), ...daily(w0, 7, () => 68, 84.2)]
    const r = nutritionReview({ body, today, program: INITIAL_PROGRAM, shortSleep: false, rules: RULES })
    expect(r.proposals[0].patch).toEqual({ op: 'nutrition', field: 'kcal', from: 2100, to: 1950 })
    const slow = nutritionReview({ body, today, program: INITIAL_PROGRAM, shortSleep: true, rules: RULES })
    expect(slow.proposals[0].patch).toMatchObject({ to: 2025 })
  })

  it('1,500 kcal 아래로는 제안하지 않는다', () => {
    const body = [...daily(w2, 7, () => 68, 84), ...daily(w1, 7, () => 68, 84), ...daily(w0, 7, () => 68, 84)]
    const low: ProgramVersion = { ...INITIAL_PROGRAM, nutrition: { ...INITIAL_PROGRAM.nutrition, kcal: 1550 } }
    expect(nutritionReview({ body, today, program: low, shortSleep: false, rules: RULES }).proposals[0].patch).toMatchObject({ to: 1500 })
    const atFloor: ProgramVersion = { ...INITIAL_PROGRAM, nutrition: { ...INITIAL_PROGRAM.nutrition, kcal: 1500 } }
    const r = nutritionReview({ body, today, program: atFloor, shortSleep: false, rules: RULES })
    expect(r.proposals.filter((p) => p.key === 'nutrition:kcal')).toEqual([])
    expect(r.warnings[0].key).toBe('nutrition:floor')
  })

  it('허리는 줄고 체중은 유지면 리컴포지션으로 보고 그대로', () => {
    const body = [...daily(w2, 7, () => 68, 85), ...daily(w1, 7, () => 68.2, 84.5), ...daily(w0, 7, () => 68.3, 84)]
    const r = nutritionReview({ body, today, program: INITIAL_PROGRAM, shortSleep: false, rules: RULES })
    expect(r.proposals.filter((p) => p.key === 'nutrition:kcal')).toEqual([])
    expect(r.warnings[0].key).toBe('body:recomp')
  })

  it('체중·허리 둘 다 늘면 규칙이 없어 묻는다', () => {
    const body = [...daily(w1, 7, () => 68, 84), ...daily(w0, 7, () => 68.6, 85)]
    const r = nutritionReview({ body, today, program: INITIAL_PROGRAM, shortSleep: false, rules: RULES })
    expect(r.questions[0].ruleKey).toBe('body.bothUpDecrease')
  })

  it('단백질이 체중 × 1.6~2.0 g 범위를 벗어나면 가까운 경계로', () => {
    const body = daily(w0, 7, () => 80)
    const r = nutritionReview({ body, today, program: INITIAL_PROGRAM, shortSleep: false, rules: RULES })
    expect(r.proposals.find((p) => p.key === 'nutrition:protein')?.patch).toEqual({ op: 'nutrition', field: 'proteinG', from: 120, to: 130 })
  })
})

describe('에너지필요추정량 (NASEM 2023)', () => {
  it('36세 170 cm 70 kg 남성 예시가 공식(Table 5-16)으로 손계산한 값과 같다', () => {
    const t = eerTable(36, 170, 70)
    expect(t.map((r) => r.kcal)).toEqual([2455, 2648, 2837, 3084])
  })

  it('생년월일이 있으면 생일 전후로 만 나이가 바뀐다', () => {
    expect(ageOn('2026-10-22', { sex: 'male', birthDate: '1990-11-01' })).toBe(35)
    expect(ageOn('2026-11-01', { sex: 'male', birthDate: '1990-11-01' })).toBe(36)
    expect(ageOn('2026-10-22', { sex: 'male', birthYear: 1990 })).toBe(36)
  })
})

describe('제안 적용', () => {
  it('승인하면 새 버전이 생기고, 그사이 프로그램이 바뀌었으면 적용하지 않는다', () => {
    const patch = { op: 'slot.set' as const, pattern: 'horizontal_push' as const, from: sink, to: { ...sink, target: 12 } }
    const v2 = applyPatch(INITIAL_PROGRAM, patch, '2026-10-25')!
    expect(v2.version).toBe(2)
    expect(v2.slots.find((s) => s.pattern === 'horizontal_push')?.target).toBe(12)
    expect(applyPatch(v2, patch, '2026-10-26')).toBeNull()
  })

  it('새 종목 추가는 슬롯이 하나 늘어난다', () => {
    const to: Slot = { pattern: 'vertical_push', exerciseId: 'pike_pushup', sets: 3, target: 8, restSec: 90 }
    expect(applyPatch(INITIAL_PROGRAM, { op: 'slot.set', pattern: 'vertical_push', to }, '2026-10-25')?.slots).toHaveLength(6)
  })
})

describe('주간 점검 시나리오', () => {
  it('2주 동안 싱크대 푸쉬업을 넘기고 유산소가 부족하면, 진행 제안·질문·요약이 함께 나온다', () => {
    const sessions = [
      strength('2026-10-19', 'sink_pushup', 8, [10, 10, 9]),
      cardio('2026-10-20', { talkTest: 'can_talk' }),
      strength('2026-10-21', 'sink_pushup', 8, [10, 10, 10]),
      cardio('2026-10-22', { talkTest: 'can_talk' }),
    ]
    const r = runWeeklyReview({
      today: '2026-10-25',
      settings: DEFAULT_SETTINGS,
      program: INITIAL_PROGRAM,
      sessions,
      body: [],
      sleep: [],
      drinks: [],
      rules: RULES,
    })
    expect(r.proposals.map((p) => p.key)).toEqual(['slot:horizontal_push', 'equip:lateral_delt', 'slot:vertical_push'])
    expect(r.questions.map((q) => q.ruleKey)).toEqual(['cardio.increaseMinPerSession'])
    expect(r.summary).toMatchObject({ cardioMinutes: 40, strengthSessions: 2 })
    expect(r.summary.sets.chest).toBe(6)
  })
})
