import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Why } from '../../components/Why'
import { Badge, Button, Card, CardTitle, Loading, NumberInput, Page, ProgressBar, cx } from '../../components/ui'
import { CARDIO_BY_KIND } from '../../data/drinks'
import { EQUIPMENT_LABEL, EXERCISES, MUSCLE_LABEL, PATTERN_LABEL } from '../../data/exercises'
import { goalPriority } from '../../engine/balance'
import type { Rules } from '../../data/rules'
import { db } from '../../db/db'
import { useProgram, useRules, useSettings, useToday } from '../../db/hooks'
import { drinkLimits } from '../../engine/alcohol'
import { formatKoreanDate, weekStart, weekdayOf } from '../../engine/day'
import { EER_BASIS, ageOn, eerTable } from '../../engine/energy'
import type { ChangeProposal, EvidenceQuestion, LocalDate, Muscle, ProgramVersion, Settings, WarningDraft } from '../../engine/types'
import { type WeeklyReview, runWeeklyReview } from '../../engine/weeklyReview'
import { hhmm } from '../../lib/time'
import { targetLabel } from '../workout/StartCard'
import { answerQuestion, approveProposal, rejectProposal, runAndStoreReview } from './actions'

export default function CoachPage() {
  const settings = useSettings()
  const program = useProgram()
  const today = useToday(settings)
  const rules = useRules()
  if (!settings || !program || !today || !rules) return <Loading />
  return <CoachView settings={settings} program={program} today={today} rules={rules} />
}

function CoachView({ settings, program, today, rules }: { settings: Settings; program: ProgramVersion; today: LocalDate; rules: Rules }) {
  const sessions = useLiveQuery(() => db.sessions.toArray(), [])
  const body = useLiveQuery(() => db.bodyLogs.toArray(), [])
  const sleep = useLiveQuery(() => db.sleepLogs.toArray(), [])
  const drinks = useLiveQuery(() => db.drinkLogs.toArray(), [])
  const proposals = useLiveQuery(() => db.proposals.toArray(), []) ?? []
  const questions = useLiveQuery(() => db.questions.where('status').equals('open').toArray(), []) ?? []
  const lastRun = useLiveQuery(() => db.reviews.orderBy('weekOf').last(), [])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string>()
  const autoRan = useRef(false)

  // 경고·요약은 기록이 바뀌면 바로 다시 계산한다 (저장하지 않음)
  const live: WeeklyReview | null = useMemo(
    () =>
      sessions && body && sleep && drinks ? runWeeklyReview({ today, settings, program, sessions, body, sleep, drinks, rules }) : null,
    [today, settings, program, sessions, body, sleep, drinks, rules],
  )

  const run = async () => {
    setBusy(true)
    setMsg(undefined)
    try {
      const r = await runAndStoreReview(today, settings, program, rules)
      setMsg(r.proposals.length ? `제안 ${r.proposals.length}개를 만들었습니다.` : '이번에는 바꿀 것이 없습니다.')
    } finally {
      setBusy(false)
    }
  }

  // 매주 일요일, 그 주에 아직 점검하지 않았으면 자동 실행
  useEffect(() => {
    if (autoRan.current || lastRun === undefined) return
    if (weekdayOf(today) === 0 && lastRun?.weekOf !== weekStart(today)) {
      autoRan.current = true
      void run()
    }
    // run은 렌더마다 새로 만들어지므로 의존성에 넣지 않고, autoRan으로 한 번만 실행한다
  }, [lastRun, today])

  // 운동 진행·식단 변경을 먼저, 장비 제안은 마지막에
  const ORDER: Record<ChangeProposal['patch']['op'], number> = { 'slot.set': 0, nutrition: 1, cardio: 2, 'equipment.suggest': 3 }
  const pending = proposals.filter((p) => p.status === 'pending').sort((a, b) => ORDER[a.patch.op] - ORDER[b.patch.op] || a.title.localeCompare(b.title))
  const history = proposals.filter((p) => p.status !== 'pending').sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''))

  return (
    <Page
      title="코치"
      right={
        <Button size="sm" variant="primary" onClick={run} disabled={busy}>
          {busy ? '점검 중…' : '지금 점검하기'}
        </Button>
      }
    >
      <p className="-mt-2 px-1 text-xs text-muted">
        매주 일요일에 자동으로 점검합니다.
        {lastRun ? ` 마지막 점검: ${formatKoreanDate(lastRun.ranAt.slice(0, 10))} ${hhmm(lastRun.ranAt)}` : ' 아직 점검한 적이 없습니다.'}
      </p>
      {msg && <p className="px-1 text-sm">{msg}</p>}

      <Card>
        <CardTitle right={pending.length ? <Badge tone="accent">{pending.length}</Badge> : undefined}>이번 주 변경 제안</CardTitle>
        {pending.length === 0 && <p className="text-sm text-muted">승인을 기다리는 제안이 없습니다.</p>}
        <ul className="space-y-3">
          {pending.map((p) => (
            <ProposalItem key={p.id} p={p} today={today} />
          ))}
        </ul>
      </Card>

      {questions.length > 0 && (
        <Card className="border-warn/50">
          <CardTitle>정해 주세요 (근거 없음)</CardTitle>
          <p className="mb-3 text-sm text-muted">아래 기준은 근거가 없어 앱이 정할 수 없습니다. 답하면 '사용자 결정값'으로 저장되고 ⓘ에 그대로 표시됩니다.</p>
          <ul className="space-y-3">
            {questions.map((q) => (
              <QuestionItem key={q.id} q={q} today={today} />
            ))}
          </ul>
        </Card>
      )}

      {live && live.warnings.length > 0 && (
        <Card>
          <CardTitle>주의·안내</CardTitle>
          <ul className="space-y-2">
            {live.warnings.map((w) => (
              <WarningItem key={w.key} w={w} />
            ))}
          </ul>
        </Card>
      )}

      {live && <Summary review={live} settings={settings} rules={rules} today={today} />}

      <ProgramCard program={program} />

      <Card>
        <CardTitle>변경 이력</CardTitle>
        {history.length === 0 && <p className="text-sm text-muted">아직 없습니다.</p>}
        <ul className="divide-y divide-line">
          {history.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-2 py-2 text-sm">
              <div>
                <p>{p.title}</p>
                <p className="text-xs text-muted">
                  {p.decidedAt ? formatKoreanDate(p.decidedAt.slice(0, 10)) : ''}
                  {p.appliedVersion ? ` · 프로그램 v${p.appliedVersion}` : ''}
                </p>
              </div>
              <Badge tone={p.status === 'approved' ? 'ok' : p.status === 'rejected' ? 'bad' : 'muted'}>
                {p.status === 'approved' ? '승인' : p.status === 'rejected' ? '거절' : '대체됨'}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </Page>
  )
}

function ProposalItem({ p, today }: { p: ChangeProposal; today: LocalDate }) {
  const [note, setNote] = useState<string>()
  const isEquip = p.patch.op === 'equipment.suggest'
  return (
    <li className="rounded-xl bg-soft p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{p.title}</p>
        <Why why={p.why} basis={p.basis} />
      </div>
      <p className="mt-1 text-sm">{p.why.summary}</p>
      {p.why.data && (
        <dl className="mt-2 space-y-0.5 text-xs text-muted">
          {p.why.data.map((d) => (
            <div key={d.label} className="flex justify-between gap-3">
              <dt>{d.label}</dt>
              <dd className="tabular text-right">{d.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {isEquip && p.patch.op === 'equipment.suggest' && (
        <p className="mt-2 text-xs text-muted">장비가 생기면 설정 → 장비에서 {p.patch.equipment.map((e) => EQUIPMENT_LABEL[e]).join(', ')}을(를) 켜 주세요.</p>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={async () => {
            const ok = await approveProposal(p, today)
            if (!ok) setNote('그사이 프로그램이 바뀌어 적용하지 못했습니다. 다시 점검해 주세요.')
          }}
        >
          {isEquip ? '알겠어요' : '승인'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => rejectProposal(p)}>
          {isEquip ? '필요 없어요' : '거절'}
        </Button>
      </div>
      {note && <p className="mt-2 text-xs text-warn">{note}</p>}
    </li>
  )
}

function QuestionItem({ q, today }: { q: EvidenceQuestion; today: LocalDate }) {
  const [value, setValue] = useState<number>()
  return (
    <li className="rounded-xl bg-soft p-3">
      <p className="text-sm font-medium">{q.question}</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="w-28">
          <NumberInput value={value} onChange={setValue} />
        </div>
        <span className="text-sm text-muted">{q.unit}</span>
        <Button size="sm" variant="primary" disabled={value === undefined || value < 0} onClick={() => value !== undefined && answerQuestion(q, value, today)}>
          저장
        </Button>
      </div>
    </li>
  )
}

function WarningItem({ w }: { w: WarningDraft }) {
  return (
    <li
      className={cx(
        'flex items-start gap-2 rounded-xl p-3 text-sm',
        w.level === 'stop' && 'bg-bad/10 text-bad',
        w.level === 'caution' && 'bg-warn/10 text-warn',
        w.level === 'info' && 'bg-soft',
      )}
    >
      <span className="flex-1">{w.title}</span>
      <Why why={w.why} basis={w.basis} />
    </li>
  )
}

function Summary({ review, settings, rules, today }: { review: WeeklyReview; settings: Settings; rules: Rules; today: LocalDate }) {
  const s = review.summary
  const priority = goalPriority(settings)
  const [low, high] = rules.strength.weeklySetsPriority.value ?? [5, 10]
  const maintain = rules.strength.weeklySetsMaintain.value ?? 4
  const [cardioTarget] = rules.cardio.weeklyModerateMin.value ?? [150, 300]
  const limits = drinkLimits(settings.profile.alcoholFlush, rules)
  const w0 = s.windows[0]
  const age = ageOn(today, settings.profile)
  const weight = w0?.avgWeight ?? settings.profile.startWeightKg
  const eer = age && settings.profile.heightCm && weight ? eerTable(age, settings.profile.heightCm, weight) : null

  return (
    <Card>
      <CardTitle>최근 7일 요약</CardTitle>
      <h3 className="mb-2 text-sm font-semibold text-muted">부위별 세트 (근력 {s.strengthSessions}회)</h3>
      <ul className="space-y-2">
        {(Object.keys(MUSCLE_LABEL) as Muscle[]).map((m) => {
          const p = priority[m]
          const goal = p === 'priority' ? low : p === 'maintain' ? maintain : 0
          return (
            <li key={m} className="text-sm">
              <div className="flex justify-between">
                <span>
                  {MUSCLE_LABEL[m]} {p === 'priority' && <Badge tone="accent">우선</Badge>} {p === 'maintain' && <Badge>유지</Badge>}
                </span>
                <span className="tabular text-muted">
                  {s.sets[m]}세트{goal ? ` / ${goal}${p === 'priority' ? `~${high}` : '+'}` : ''}
                </span>
              </div>
              {goal > 0 && <ProgressBar value={s.sets[m]} max={goal} tone={s.sets[m] >= goal ? 'ok' : 'accent'} />}
            </li>
          )
        })}
      </ul>

      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt>유산소 (중강도 환산)</dt>
          <dd className="tabular">
            {s.cardioMinutes}분 / {cardioTarget}분
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>음주</dt>
          <dd className="tabular">
            {s.drinks.toFixed(1)}잔 / {limits.weekly}잔 · {s.drinkOccasions}회
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>평균 수면</dt>
          <dd className="tabular">{s.avgSleep !== null ? `${s.avgSleep.toFixed(1)}시간` : '기록 없음'}</dd>
        </div>
        <div className="flex justify-between">
          <dt>주 평균 체중 (2주 전 → 이번 주)</dt>
          <dd className="tabular">
            {[...s.windows]
              .reverse()
              .map((w) => (w.avgWeight ? w.avgWeight.toFixed(1) : '-'))
              .join(' → ')}{' '}
            kg
          </dd>
        </div>
      </dl>

      {eer && (
        <div className="mt-4 rounded-xl bg-soft p-3 text-sm">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">에너지필요추정량 (참고)</span>
            <Why
              why={{ summary: `만 ${age}세, ${settings.profile.heightCm} cm, ${weight?.toFixed(1)} kg 기준입니다. 목표 칼로리는 이 표가 아니라 체중·허리 추세로 조정합니다.` }}
              basis={EER_BASIS}
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            {eer.map((e) => (
              <div key={e.level} className="flex justify-between">
                <dt className="text-muted">{e.label}</dt>
                <dd className="tabular">{e.kcal.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Card>
  )
}

function ProgramCard({ program }: { program: ProgramVersion }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <CardTitle right={<Badge>v{program.version}</Badge>}>
        <button type="button" onClick={() => setOpen((v) => !v)}>
          현재 프로그램 {open ? '▴' : '▾'}
        </button>
      </CardTitle>
      <p className="text-xs text-muted">{formatKoreanDate(program.effectiveFrom)}부터</p>
      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <ul className="space-y-1">
            {program.slots.map((s) => {
              const ex = EXERCISES[s.exerciseId]
              return (
                <li key={s.pattern} className="flex justify-between gap-2">
                  <span>
                    <span className="text-muted">{PATTERN_LABEL[s.pattern]} · </span>
                    {ex?.name}
                  </span>
                  <span className="tabular shrink-0">
                    {s.sets} × {targetLabel(ex?.metric ?? 'reps', s.target)}
                  </span>
                </li>
              )
            })}
          </ul>
          <p>
            유산소: {CARDIO_BY_KIND[program.cardio.kind].name} {program.cardio.minutes}분 × 주 {program.cardio.days.length}회
          </p>
          <p>
            식단 목표: {program.nutrition.kcal.toLocaleString()} kcal · 단백질 {program.nutrition.proteinG} g · 지방 {program.nutrition.fatG} g
          </p>
        </div>
      )}
    </Card>
  )
}
