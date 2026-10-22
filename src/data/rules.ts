import type { Basis, EvidenceRef, RuleParam } from '../engine/types'

// 엔진이 쓰는 모든 상수. 값마다 근거(basis)가 붙는다.
// needs-evidence인 값은 null이고 엔진은 쓰지 않는다 → 필요해지면 사용자에게 묻는다.

const DECIDED = '2026-10-22'

export const ev = (...refs: EvidenceRef[]): Basis => ({ type: 'evidence', refs })
export const evx = (extrapolation: string, ...refs: EvidenceRef[]): Basis => ({ type: 'evidence', refs, extrapolation })
export const userDecision = (note: string, decidedAt = DECIDED): Basis => ({ type: 'user-decision', decidedAt, note })
export const needs = (question: string): Basis => ({ type: 'needs-evidence', question })
export const pref = (note: string): Basis => ({ type: 'preference', note })

const p = <T>(value: T | null, basis: Basis): RuleParam<T> => ({ value, basis })

export const RULES = {
  strength: {
    repRange: p({ min: 8, max: 12 }, ev('acsm2009#novice')),
    noviceDaysPerWeek: p<[number, number]>([2, 3], ev('acsm2009#novice')),
    progressTrigger: p({ overBy: 1, consecutiveSessions: 2 }, ev('acsm2009#progression')),
    loadIncreasePct: p<[number, number]>([2, 10], ev('acsm2009#progression')),
    nextTargetFromMinSet: p(true, userDecision('목표를 넘기면 다음 목표는 이번 세션에서 가장 적게 한 세트 횟수 (상한까지)')),
    holdAfterMisses: p(2, userDecision('요청서 값: 2회 연속 목표 미달이면 같은 단계 유지 (결정 D2)')),
    regressAfterMisses: p(3, userDecision('요청서 값: 3회 연속 목표 미달이면 한 단계 내림 (결정 D2)')),
    holdIncreaseSec: p<number>(null, needs('시간 종목(매달리기·플랭크)에서 2회 연속 모든 세트가 목표 시간을 채우면, 다음 목표를 몇 초 늘릴까요?')),
    holdAdvanceAtSec: p<number>(null, needs('시간 종목은 목표가 몇 초가 되면 사다리 다음 종목으로 넘어갈까요?')),
    restSec: p<[number, number]>([60, 120], ev('acsm2009#rest')),
    minRestHoursSameMuscle: p(48, ev('garber2011#rest48')),
    intermediateAfterMonths: p(6, ev('acsm2009#levels')),
    consistencyPct: p<number>(null, needs('"꾸준히 6개월"의 꾸준함을 출석률 몇 % 이상으로 볼까요?')),
    weeklySetsPriority: p<[number, number]>([5, 10], ev('pelland2025#tiers')),
    weeklySetsMaintain: p(4, ev('pelland2025#tiers')),
    indirectSetWeight: p(0.5, ev('pelland2025#fractional')),
    lowerBodyMinDays: p(2, ev('who2020#strength')),
  },
  cardio: {
    weeklyModerateMin: p<[number, number]>([150, 300], ev('who2020#aerobic')),
    vigorousFactor: p(2, evx('WHO의 중강도 150~300분 = 고강도 75~150분 대응에서 도출 (문구에 "동등한 조합"으로만 쓰여 있음)', 'who2020#aerobic')),
    moderateMet: p(3, ev('who2020#intensity')),
    vigorousMet: p(6, ev('who2020#intensity')),
    increaseMinPerSession: p<number>(null, needs('유산소가 WHO 기준에 못 미칠 때 1회 몇 분씩 늘릴까요?')),
  },
  alcohol: {
    gramsPerDrink: p(14, ev('lee2019alcohol#drinkDef')),
    weeklyMax: p(8, ev('lee2019alcohol#weekly')),
    perOccasionMax: p(3, ev('lee2019alcohol#perOccasion')),
    flushFactor: p(0.5, ev('lee2019alcohol#flush')),
    kcalPerGram: p(7, ev('fao2003#alcohol')),
    noDrinkOnStrengthDay: p(
      true,
      evx('연구는 체중 1 kg당 알코올 1.5 g(체중 70 kg이면 소주 2병 이상) 고용량 조건. 그보다 적은 양에도 적용하는 것은 보수적 확장', 'parr2014#mps'),
    ),
  },
  sleep: {
    minHours: p(7, ev('aasm2015#hours')),
    shortNightsPerWeek: p(4, userDecision('최근 7일 중 4일 이상 7시간 미만이면 경고 (결정 D7)')),
  },
  body: {
    lossPctPerWeek: p<[number, number]>([0.5, 1.0], ev('ruizCastellano2021#rate')),
    weeklyNoisePct: p(0.35, ev('turicchi2020#weekly')),
    waistNoiseCm: p(0.5, userDecision('허리 변화가 ±0.5 cm 이내면 "그대로" (결정 D7)')),
    kcalDecrease: p(150, userDecision('체중·허리가 2주 그대로면 하루 150 kcal 줄임 (결정 D7)')),
    kcalIncrease: p(150, userDecision('주 1% 넘게 빠지면 하루 150 kcal 늘림 (결정 D7)')),
    kcalFloor: p(1500, evx('과체중·비만 대상 남성 저열량식 범위(1,200~1,500 kcal)의 상단을 "이 아래로는 제안하지 않는" 경계로 사용', 'nhlbi1998#lcd')),
    sleepSlowdownFactor: p(0.5, userDecision('수면 부족 경고가 뜨면 목표 감량 속도를 절반으로 (결정 D7)')),
    minWeighInsPerWeek: p(3, userDecision('체중은 매일, 최소 주 3회 아침에 재고 주 평균끼리 비교 (결정 D6)')),
    bothUpDecrease: p<number>(null, needs('체중과 허리둘레가 둘 다 늘었을 때 하루 몇 kcal 줄일까요? (0이면 그대로 둠)')),
    leanBulkSwitch: p<string>(null, needs('체지방 감량기에서 근육 증량기(린 벌크)로 언제 바꿀까요? 근거 있는 전환 기준이 없습니다.')),
  },
  protein: {
    gPerKg: p<[number, number]>([1.6, 2.0], evx('ISSN 1.4~2.0 g/kg 범위 안에서 요청서의 1.6~2.0을 사용', 'issnProtein2017#daily')),
    perMealG: p<[number, number]>([20, 40], ev('issnProtein2017#perMeal')),
    postWorkoutHours: p(2, ev('issnTiming2017#post')),
  },
  fat: {
    pctOfEnergy: p<[number, number]>([15, 30], ev('kdri2020#amdr')),
  },
} as const

export type Rules = typeof RULES
