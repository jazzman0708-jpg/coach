import { ev, evx } from '../data/rules'
import type { Rules } from '../data/rules'
import { addDays } from './day'
import type { BodyLog, LocalDate, ProgramVersion, ProposalDraft, QuestionDraft, WarningDraft, Why } from './types'

// 식단 단계 판단 (체중·허리 2주 추세). 결정 D6·D7 반영
// - 최근 7일씩 세 구간(W0: 이번 주, W1: 지난주, W2: 2주 전)의 평균 체중과 마지막 허리둘레를 비교
// - 주 1% 넘게 감량 → 섭취 +150 / 체중·허리 둘 다 2주 연속 그대로 → −150 (수면 부족이면 절반, 1,500 kcal 아래로는 제안 안 함)
// - 허리↓ + 체중 유지·증가 → 리컴포지션, 그대로
// - 체중·허리 둘 다 ↑ → 규칙 없음 → 사용자에게 묻는다

export interface WeekWindow {
  from: LocalDate
  to: LocalDate
  weighIns: number
  avgWeight?: number
  waist?: number
}

export function bodyWindows(logs: BodyLog[], today: LocalDate): [WeekWindow, WeekWindow, WeekWindow] {
  const make = (offset: number): WeekWindow => {
    const to = addDays(today, -7 * offset)
    const from = addDays(to, -6)
    const inRange = logs.filter((l) => l.date >= from && l.date <= to)
    const weights = inRange.filter((l) => l.weightKg !== undefined).map((l) => l.weightKg!)
    const waists = inRange.filter((l) => l.waistCm !== undefined).sort((a, b) => a.date.localeCompare(b.date))
    return {
      from,
      to,
      weighIns: weights.length,
      avgWeight: weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : undefined,
      waist: waists.at(-1)?.waistCm,
    }
  }
  return [make(0), make(1), make(2)]
}

const pct = (a: number, b: number) => ((a - b) / b) * 100
const f1 = (n: number) => n.toFixed(1)
const sign = (n: number) => (n > 0 ? `+${f1(n)}` : f1(n))

export function nutritionReview(input: {
  body: BodyLog[]
  today: LocalDate
  program: ProgramVersion
  shortSleep: boolean
  rules: Rules
}): { proposals: ProposalDraft[]; warnings: WarningDraft[]; questions: QuestionDraft[]; windows: WeekWindow[] } {
  const { body, today, program, shortSleep, rules } = input
  const r = rules.body
  const windows = bodyWindows(body, today)
  const [w0, w1, w2] = windows
  const proposals: ProposalDraft[] = []
  const warnings: WarningDraft[] = []
  const questions: QuestionDraft[] = []
  const minIns = r.minWeighInsPerWeek.value ?? 3
  const noise = r.weeklyNoisePct.value ?? 0.35
  const waistNoise = r.waistNoiseCm.value
  const maxLoss = r.lossPctPerWeek.value?.[1] ?? 1
  const floor = r.kcalFloor.value ?? 1500
  const kcal = program.nutrition.kcal

  const enough = (w: WeekWindow) => w.weighIns >= minIns && w.avgWeight !== undefined
  if (!enough(w0) || !enough(w1)) {
    warnings.push({
      key: 'body:data',
      level: 'info',
      title: '체중 기록이 부족해 식단 단계를 판단하지 않았습니다',
      why: {
        summary: `최근 2주 각각 ${minIns}회 이상 체중을 재야 주 평균으로 비교할 수 있습니다.`,
        data: [
          { label: '이번 주 측정', value: `${w0.weighIns}회` },
          { label: '지난주 측정', value: `${w1.weighIns}회` },
        ],
      },
      basis: [r.minWeighInsPerWeek.basis, ev('turicchi2020#weekly')],
    })
  } else {
    const c1 = pct(w0.avgWeight!, w1.avgWeight!)
    const c2 = enough(w2) ? pct(w1.avgWeight!, w2.avgWeight!) : undefined
    const why = (summary: string): Why => ({
      summary,
      data: [
        { label: '주 평균 체중', value: [w2, w1, w0].map((w) => (w.avgWeight ? f1(w.avgWeight) : '-')).join(' → ') + ' kg' },
        { label: '주간 변화', value: `${c2 !== undefined ? `${sign(c2)}%, ` : ''}${sign(c1)}%` },
        { label: '허리', value: [w2, w1, w0].map((w) => (w.waist ? f1(w.waist) : '-')).join(' → ') + ' cm' },
        { label: '목표 칼로리', value: `${kcal.toLocaleString()} kcal` },
      ],
    })

    const wStable = (a?: number, b?: number) => waistNoise !== null && a !== undefined && b !== undefined && Math.abs(a - b) <= waistNoise

    if (c1 < -maxLoss) {
      const inc = r.kcalIncrease.value ?? 150
      proposals.push({
        key: 'nutrition:kcal',
        title: `섭취 늘리기: ${kcal.toLocaleString()} → ${(kcal + inc).toLocaleString()} kcal`,
        patch: { op: 'nutrition', field: 'kcal', from: kcal, to: kcal + inc },
        why: why(`지난주보다 체중이 ${f1(-c1)}% 줄어 권장 속도(주 ${maxLoss}% 이하)보다 빠릅니다. 근손실을 막기 위해 섭취를 늘립니다.`),
        basis: [r.lossPctPerWeek.basis, r.kcalIncrease.basis],
      })
    } else if (w0.waist !== undefined && w2.waist !== undefined && waistNoise !== null && w0.waist < w2.waist - waistNoise && c1 >= -noise) {
      warnings.push({
        key: 'body:recomp',
        level: 'info',
        title: '허리는 줄고 체중은 유지 — 리컴포지션으로 보고 그대로 둡니다',
        why: why('근육이 늘면서 지방이 빠지는 중일 수 있어 칼로리를 바꾸지 않습니다.'),
        basis: [evx('리뷰의 요지는 훈련된 사람에서도 관찰된다는 것', 'barakat2020#recomp'), r.waistNoiseCm.basis],
      })
    } else if (c2 !== undefined && Math.abs(c1) <= noise && Math.abs(c2) <= noise && wStable(w0.waist, w1.waist) && wStable(w1.waist, w2.waist) && wStable(w0.waist, w2.waist)) {
      const dec = Math.round((r.kcalDecrease.value ?? 150) * (shortSleep ? (r.sleepSlowdownFactor.value ?? 0.5) : 1))
      const to = Math.max(floor, kcal - dec)
      if (to < kcal) {
        proposals.push({
          key: 'nutrition:kcal',
          title: `섭취 줄이기: ${kcal.toLocaleString()} → ${to.toLocaleString()} kcal`,
          patch: { op: 'nutrition', field: 'kcal', from: kcal, to },
          why: why(
            `체중과 허리둘레가 2주 연속 그대로입니다.${shortSleep ? ' 수면 부족이 이어지고 있어 줄이는 폭을 절반으로 했습니다.' : ''}${to === floor ? ` ${floor.toLocaleString()} kcal 아래로는 제안하지 않습니다.` : ''}`,
          ),
          basis: [r.kcalDecrease.basis, r.weeklyNoisePct.basis, r.waistNoiseCm.basis, r.kcalFloor.basis, ...(shortSleep ? [r.sleepSlowdownFactor.basis, ev('nedeltcheva2010#deficit')] : [])],
        })
      } else {
        warnings.push({
          key: 'nutrition:floor',
          level: 'caution',
          title: `정체기지만 이미 ${floor.toLocaleString()} kcal라 더 줄이지 않습니다`,
          why: why('활동량을 늘리거나 수면·음주를 먼저 점검하세요.'),
          basis: [r.kcalFloor.basis],
        })
      }
    } else if (c2 !== undefined && Math.abs(c1) <= noise && Math.abs(c2) <= noise && (w0.waist === undefined || w1.waist === undefined || w2.waist === undefined)) {
      warnings.push({
        key: 'body:waist',
        level: 'info',
        title: '체중은 2주째 그대로인데 허리둘레 기록이 부족합니다',
        why: why('체중과 허리를 둘 다 봐야 정체기인지, 근육이 늘고 지방이 빠지는 중인지 구분할 수 있습니다. 주 1회 허리를 재 주세요.'),
        basis: [ev('ksso2022#waistMethod'), ev('barakat2020#recomp')],
      })
    } else if (c1 > noise && w0.waist !== undefined && w1.waist !== undefined && waistNoise !== null && w0.waist > w1.waist + waistNoise) {
      const dec = r.bothUpDecrease.value
      if (dec === null) {
        const b = r.bothUpDecrease.basis
        questions.push({ ruleKey: 'body.bothUpDecrease', question: b.type === 'needs-evidence' ? b.question : '', unit: 'kcal' })
      } else if (dec > 0) {
        const to = Math.max(floor, kcal - dec)
        proposals.push({
          key: 'nutrition:kcal',
          title: `섭취 줄이기: ${kcal.toLocaleString()} → ${to.toLocaleString()} kcal`,
          patch: { op: 'nutrition', field: 'kcal', from: kcal, to },
          why: why('체중과 허리둘레가 둘 다 늘었습니다.'),
          basis: [r.bothUpDecrease.basis, r.kcalFloor.basis],
        })
      }
    }
  }

  // 단백질: 최근 주 평균 체중 × 1.6~2.0 g 범위를 벗어나면 가까운 경계로
  const weight = w0.avgWeight ?? w1.avgWeight
  const range = rules.protein.gPerKg.value
  if (weight && range) {
    const lo = Math.ceil((weight * range[0]) / 5) * 5
    const hi = Math.floor((weight * range[1]) / 5) * 5
    const p = program.nutrition.proteinG
    const to = p < lo ? lo : p > hi ? hi : p
    if (to !== p) {
      proposals.push({
        key: 'nutrition:protein',
        title: `단백질 목표: ${p} g → ${to} g`,
        patch: { op: 'nutrition', field: 'proteinG', from: p, to },
        why: {
          summary: `최근 평균 체중 ${f1(weight)} kg 기준 권장 범위는 ${lo}~${hi} g입니다.`,
          data: [{ label: '체중 1 kg당', value: `${(p / weight).toFixed(2)} g → ${(to / weight).toFixed(2)} g` }],
        },
        basis: [rules.protein.gPerKg.basis, rules.protein.perMealG.basis],
      })
    }
  }

  return { proposals, warnings, questions, windows }
}
