import { useLiveQuery } from 'dexie-react-hooks'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Why } from '../../components/Why'
import { Badge, Button, Card, Field, Loading, NumberInput, Page, ProgressBar, Segmented, Sheet, Stepper } from '../../components/ui'
import { CARDIO_BY_KIND, CARDIO_TYPES } from '../../data/drinks'
import { EXERCISES, PATTERN_LABEL } from '../../data/exercises'
import { ev, userDecision } from '../../data/rules'
import { db } from '../../db/db'
import { useActiveSession, useLatestWeight, useProgram, useSettings, useToday } from '../../db/hooks'
import { cardioKcal } from '../../engine/cardio'
import { addDays } from '../../engine/day'
import { compareLogs, exerciseTotals, previousLog } from '../../engine/session'
import type {
  BodyArea,
  Difficulty,
  Exercise,
  ExerciseLog,
  PainKind,
  Settings,
  TalkTest,
  WorkoutSession,
} from '../../engine/types'
import { beep, useWakeLock, vibrate } from '../../lib/device'
import { formatClock, nowIso, useNow } from '../../lib/time'
import { abandonSession, finishSession, patchSession, setUi } from './actions'
import { WorkoutStartCard, targetLabel } from './StartCard'

export default function WorkoutPage() {
  const settings = useSettings()
  const program = useProgram()
  const active = useActiveSession()
  const today = useToday(settings)
  const history = useLiveQuery(() => db.sessions.where('status').equals('done').toArray(), []) ?? []
  const weight = useLatestWeight()

  if (!settings || !program || !today || active === 'loading') return <Loading />

  if (!active) {
    const recent = history.filter((s) => s.date >= addDays(today, -14))
    return (
      <Page
        title="운동"
        right={
          <Link to="/timer" className="rounded-xl bg-soft px-3 py-1.5 text-sm font-semibold">
            ◷ 타이머
          </Link>
        }
      >
        <WorkoutStartCard settings={settings} program={program} today={today} sessions={recent} active={null} />
      </Page>
    )
  }

  const alert = (n: number) => {
    if (settings.sound) beep(n)
    if (settings.vibration) vibrate([250, 120, 250])
  }

  return active.kind === 'strength' ? (
    <StrengthRunner session={active} history={history} alert={alert} />
  ) : (
    <CardioRunner session={active} settings={settings} targetMin={program.cardio.minutes} weightKg={weight ?? settings.profile.startWeightKg ?? 70} alert={alert} />
  )
}

// ───────────────────────── 근력 ─────────────────────────

function StrengthRunner({ session, history, alert }: { session: WorkoutSession; history: WorkoutSession[]; alert: (n: number) => void }) {
  useWakeLock(true)
  const navigate = useNavigate()
  const [listOpen, setListOpen] = useState(false)
  const ui = session.ui ?? { phase: 'set' as const, index: 0 }
  const ex = session.exercises[ui.index]
  const def = ex ? EXERCISES[ex.exerciseId] : undefined
  const prev = ex ? previousLog(ex.exerciseId, history, session.startedAt) : undefined

  const quit = async () => {
    if (!confirm('이번 운동을 저장하지 않고 중단할까요?')) return
    await abandonSession(session)
    navigate('/')
  }

  const logSet = async (value: number, loadKg?: number) => {
    if (!ex) return
    const sets = [...ex.sets, { value, ...(loadKg ? { loadKg } : {}), at: nowIso() }]
    const exercises = session.exercises.map((e, i) => (i === ui.index ? { ...e, sets } : e))
    if (sets.length < ex.prescribed.sets) {
      const rest = ex.prescribed.restSec
      await patchSession(session.id, {
        exercises,
        ui: { phase: 'rest', index: ui.index, restEndAt: new Date(Date.now() + rest * 1000).toISOString(), restTotalSec: rest },
      })
    } else {
      await patchSession(session.id, { exercises, ui: { phase: 'feedback', index: ui.index } })
    }
  }

  const undoSet = async () => {
    if (!ex || ex.sets.length === 0) return
    const exercises = session.exercises.map((e, i) => (i === ui.index ? { ...e, sets: e.sets.slice(0, -1) } : e))
    await patchSession(session.id, { exercises, ui: { phase: 'set', index: ui.index } })
  }

  const goTo = (index: number) => setUi(session, { phase: 'set', index, restEndAt: undefined, holdStartedAt: undefined })

  const header = (
    <div className="mb-3 flex items-center justify-between gap-2 text-sm">
      <button type="button" className="rounded-lg bg-soft px-3 py-1.5" onClick={() => setListOpen(true)}>
        종목 {Math.min(ui.index + 1, session.exercises.length)}/{session.exercises.length} ▾
      </button>
      <button type="button" className="rounded-lg px-3 py-1.5 text-bad" onClick={quit}>
        중단
      </button>
    </div>
  )

  if (session.exercises.length === 0) {
    return (
      <Page title="근력 운동">
        <Card>
          <p>가진 장비로 할 수 있는 종목이 없습니다. 설정에서 장비를 확인하세요.</p>
          <Button className="mt-3" onClick={quit}>
            닫기
          </Button>
        </Card>
      </Page>
    )
  }

  let body: ReactNode
  if (ui.phase === 'warmup') body = <WarmupPanel session={session} />
  else if (ui.phase === 'summary' || !ex || !def) body = <SummaryPanel session={session} history={history} />
  else if (ui.phase === 'rest') body = <RestPanel session={session} ex={ex} def={def} alert={alert} />
  else if (ui.phase === 'feedback') body = <FeedbackPanel key={ui.index} session={session} ex={ex} def={def} />
  else if (ui.phase === 'hold') body = <HoldPanel session={session} ex={ex} def={def} onLog={logSet} alert={alert} />
  else body = <SetPanel key={`${ui.index}-${ex.sets.length}`} session={session} ex={ex} def={def} prev={prev} onLog={logSet} onUndo={undoSet} />

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      {header}
      {body}
      <Sheet open={listOpen} onClose={() => setListOpen(false)} title="종목 목록">
        <ul className="space-y-2">
          {session.exercises.map((e, i) => (
            <li key={e.exerciseId}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl bg-soft px-3 py-3 text-left"
                onClick={() => {
                  setListOpen(false)
                  void goTo(i)
                }}
              >
                <span>{EXERCISES[e.exerciseId]?.name}</span>
                <span className="text-sm text-muted">
                  {e.sets.length}/{e.prescribed.sets}세트
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="w-full rounded-xl bg-soft px-3 py-3 text-left"
              onClick={() => {
                setListOpen(false)
                void setUi(session, { phase: 'summary' })
              }}
            >
              끝내고 결과 보기
            </button>
          </li>
        </ul>
      </Sheet>
    </div>
  )
}

function WarmupPanel({ session }: { session: WorkoutSession }) {
  const now = useNow(500)
  const elapsed = now - new Date(session.startedAt).getTime()
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xl font-bold">워밍업 (선택)</h2>
        <Why
          why={{ summary: '워밍업은 도움이 될 수 있지만 근거가 약하고 정해진 시간도 없습니다. 원하는 만큼 하고 넘어가세요.' }}
          basis={[ev('garber2011#warmup'), userDecision('워밍업은 선택 단계로 두고 시간은 정하지 않음 (결정 D2)')]}
        />
      </div>
      <p className="text-sm text-muted">가볍게 몸을 데운 뒤 시작하세요.</p>
      <p className="tabular my-6 text-center text-5xl font-bold">{formatClock(elapsed)}</p>
      <Button variant="primary" size="xl" onClick={() => setUi(session, { phase: 'set', index: 0 })}>
        첫 종목 시작
      </Button>
    </Card>
  )
}

function ExerciseHeader({ ex, def }: { ex: ExerciseLog; def: Exercise }) {
  const [showCues, setShowCues] = useState(true)
  return (
    <div className="mb-4">
      <p className="text-sm text-muted">{PATTERN_LABEL[def.pattern]}</p>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-2xl font-bold">{def.name}</h2>
        <Why
          why={{
            summary: `처방: ${ex.prescribed.sets}세트 × ${targetLabel(def.metric, ex.prescribed.target)}, 세트 사이 ${ex.prescribed.restSec}초 휴식. 이 종목의 범위는 ${def.range.min}~${def.range.max}${def.metric === 'seconds' ? '초' : '회'}입니다.`,
          }}
          basis={[def.rangeBasis, ev('acsm2009#rest')]}
        />
      </div>
      <p className="mt-1 text-lg">
        목표 <b>{targetLabel(def.metric, ex.prescribed.target)}</b> × {ex.prescribed.sets}세트
      </p>
      {def.safety && (
        <ul className="mt-2 space-y-1 rounded-xl bg-warn/10 p-3 text-sm text-warn">
          {def.safety.map((s) => (
            <li key={s}>⚠︎ {s}</li>
          ))}
        </ul>
      )}
      <button type="button" className="mt-2 text-sm text-muted underline" onClick={() => setShowCues((v) => !v)}>
        자세 포인트 {showCues ? '접기' : '보기'}
      </button>
      {showCues && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
          {def.cues.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SetDots({ ex, unit }: { ex: ExerciseLog; unit: string }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: ex.prescribed.sets }, (_, i) => {
        const s = ex.sets[i]
        return (
          <div
            key={i}
            className={`flex-1 rounded-xl py-2 text-center text-sm font-semibold ${s ? (s.value >= ex.prescribed.target ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn') : 'bg-soft text-muted'}`}
          >
            {s ? `${s.value}${unit}` : `${i + 1}세트`}
          </div>
        )
      })}
    </div>
  )
}

function SetPanel({
  session,
  ex,
  def,
  prev,
  onLog,
  onUndo,
}: {
  session: WorkoutSession
  ex: ExerciseLog
  def: Exercise
  prev: ExerciseLog | undefined
  onLog: (v: number, load?: number) => void
  onUndo: () => void
}) {
  const setNo = ex.sets.length
  const lastValue = ex.sets.at(-1)?.value
  const [value, setValue] = useState(lastValue ?? ex.prescribed.target)
  const [load, setLoad] = useState(ex.sets.at(-1)?.loadKg ?? prev?.sets.at(-1)?.loadKg ?? 2)
  const unit = def.metric === 'seconds' ? '초' : '회'

  return (
    <Card>
      <ExerciseHeader ex={ex} def={def} />
      <SetDots ex={ex} unit={unit} />
      {prev && <p className="mt-2 text-sm text-muted">지난번: {prev.sets.map((s) => s.value).join(' · ')}{unit}</p>}
      <p className="mt-5 text-center text-sm font-semibold text-muted">
        {setNo + 1}세트 / {ex.prescribed.sets}
      </p>
      {def.metric === 'seconds' ? (
        <div className="mt-4">
          <Button variant="primary" size="xl" onClick={() => setUi(session, { phase: 'hold', holdStartedAt: new Date(Date.now() + 3000).toISOString() })}>
            {targetLabel('seconds', ex.prescribed.target)} 시작
          </Button>
          <p className="mt-2 text-center text-xs text-muted">3초 준비 후 카운트다운이 시작됩니다.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <Stepper value={value} onChange={setValue} big unit="회" max={100} />
          {def.metric === 'reps_load' && <Stepper value={load} onChange={setLoad} step={0.5} unit="kg" max={200} />}
          <Button variant="primary" size="xl" onClick={() => onLog(value, def.metric === 'reps_load' ? load : undefined)}>
            세트 완료
          </Button>
        </div>
      )}
      {setNo > 0 && (
        <button type="button" className="mt-4 w-full text-sm text-muted underline" onClick={onUndo}>
          마지막 세트 취소
        </button>
      )}
    </Card>
  )
}

function HoldPanel({
  session,
  ex,
  def,
  onLog,
  alert,
}: {
  session: WorkoutSession
  ex: ExerciseLog
  def: Exercise
  onLog: (v: number) => void
  alert: (n: number) => void
}) {
  const now = useNow(100)
  const start = new Date(session.ui?.holdStartedAt ?? Date.now()).getTime()
  const elapsed = now - start
  const target = ex.prescribed.target * 1000
  const fired = useRef<{ go?: boolean; done?: boolean }>({})

  useEffect(() => {
    if (elapsed >= 0 && !fired.current.go) {
      fired.current.go = true
      alert(1)
    }
    // 목표 시간에는 알리기만 하고 계속 센다 (더 버틴 기록이 다음 처방의 근거가 된다)
    if (elapsed >= target && !fired.current.done) {
      fired.current.done = true
      alert(2)
    }
  }, [elapsed, target, alert])

  return (
    <Card>
      <ExerciseHeader ex={ex} def={def} />
      <SetDots ex={ex} unit="초" />
      <div className="my-8 text-center">
        {elapsed < 0 ? (
          <>
            <p className="text-lg text-muted">준비</p>
            <p className="tabular text-8xl font-bold">{Math.ceil(-elapsed / 1000)}</p>
          </>
        ) : elapsed < target ? (
          <>
            <p className="text-lg text-muted">남은 시간</p>
            <p className="tabular text-8xl font-bold">{Math.ceil((target - elapsed) / 1000)}</p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-ok">목표 달성! 더 버틸 수 있으면 계속</p>
            <p className="tabular text-8xl font-bold text-ok">+{Math.floor((elapsed - target) / 1000)}</p>
          </>
        )}
      </div>
      <div className="space-y-3">
        <Button variant="primary" size="xl" onClick={() => onLog(Math.max(0, Math.floor(elapsed / 1000)))} disabled={elapsed < 0}>
          {elapsed >= target ? '끝 (기록하기)' : '여기까지 (멈춤)'}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => setUi(session, { phase: 'set', holdStartedAt: undefined })}>
          취소
        </Button>
      </div>
    </Card>
  )
}

function RestPanel({ session, ex, def, alert }: { session: WorkoutSession; ex: ExerciseLog; def: Exercise; alert: (n: number) => void }) {
  const now = useNow(200)
  const ui = session.ui!
  const end = new Date(ui.restEndAt ?? Date.now()).getTime()
  const total = (ui.restTotalSec ?? ex.prescribed.restSec) * 1000
  const remaining = end - now
  const fired = useRef<string | null>(null)

  useEffect(() => {
    if (remaining <= 0 && fired.current !== ui.restEndAt) {
      fired.current = ui.restEndAt ?? null
      alert(3)
      void setUi(session, { phase: 'set', restEndAt: undefined })
    }
  }, [remaining, ui.restEndAt, alert, session])

  const restart = (sec: number) => {
    const startedAt = end - total
    void setUi(session, { restEndAt: new Date(startedAt + sec * 1000).toISOString(), restTotalSec: sec })
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">휴식</h2>
        <Why
          why={{ summary: `세트 사이 ${ex.prescribed.restSec}초 휴식이 처방되어 있습니다. 끝나면 소리·진동으로 알려드립니다(아이폰은 진동 미지원).` }}
          basis={[ev('acsm2009#rest')]}
        />
      </div>
      <p className="tabular my-6 text-center text-8xl font-bold">{formatClock(Math.max(0, remaining))}</p>
      <ProgressBar value={total - Math.max(0, remaining)} max={total} />
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[60, 90, 120].map((sec) => (
          <Button key={sec} size="sm" variant={ui.restTotalSec === sec ? 'primary' : 'soft'} onClick={() => restart(sec)}>
            {sec}초
          </Button>
        ))}
        <Button size="sm" onClick={() => setUi(session, { restEndAt: new Date(end + 15_000).toISOString(), restTotalSec: (ui.restTotalSec ?? 0) + 15 })}>
          +15초
        </Button>
      </div>
      <p className="mt-5 text-center text-muted">
        다음: {def.name} {ex.sets.length + 1}세트 · 목표 {targetLabel(def.metric, ex.prescribed.target)}
      </p>
      <Button variant="primary" size="lg" className="mt-3 w-full" onClick={() => setUi(session, { phase: 'set', restEndAt: undefined })}>
        바로 다음 세트
      </Button>
    </Card>
  )
}

const AREAS: { value: BodyArea; label: string }[] = [
  { value: 'shoulder', label: '어깨' },
  { value: 'elbow', label: '팔꿈치' },
  { value: 'wrist', label: '손목' },
  { value: 'lower_back', label: '허리' },
  { value: 'hip', label: '고관절' },
  { value: 'knee', label: '무릎' },
  { value: 'neck', label: '목' },
  { value: 'other', label: '기타' },
]

function FeedbackPanel({ session, ex, def }: { session: WorkoutSession; ex: ExerciseLog; def: Exercise }) {
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(ex.difficulty)
  const [pain, setPain] = useState<PainKind | 'none'>(ex.pain?.kind ?? 'none')
  const [area, setArea] = useState<BodyArea | undefined>(ex.pain?.area)
  const ui = session.ui!
  const isLast = ui.index >= session.exercises.length - 1

  const save = async (stop = false) => {
    const exercises = session.exercises.map((e, i) =>
      i === ui.index ? { ...e, difficulty, pain: pain !== 'none' && area ? { kind: pain, area } : undefined } : e,
    )
    const next = stop || isLast ? { phase: 'summary' as const, index: ui.index } : { phase: 'set' as const, index: ui.index + 1 }
    await patchSession(session.id, { exercises, ui: next })
  }

  return (
    <Card>
      <p className="text-sm text-muted">{def.name}</p>
      <h2 className="mb-4 text-xl font-bold">이 종목 어땠나요?</h2>
      <Segmented
        size="lg"
        value={difficulty}
        onChange={setDifficulty}
        options={[
          { value: 'easy', label: '쉬움' },
          { value: 'ok', label: '적당' },
          { value: 'hard', label: '힘듦' },
        ]}
      />
      <h3 className="mb-2 mt-6 font-semibold">통증</h3>
      <Segmented
        value={pain}
        onChange={setPain}
        options={[
          { value: 'none', label: '없음' },
          { value: 'soreness', label: '근육 뻐근함' },
          { value: 'joint_or_sharp', label: '관절·찌르는 통증' },
          { value: 'red_flag', label: '위험 신호' },
        ]}
      />
      {pain !== 'none' && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {AREAS.map((a) => (
              <Button key={a.value} size="sm" variant={area === a.value ? 'primary' : 'soft'} onClick={() => setArea(a.value)}>
                {a.label}
              </Button>
            ))}
          </div>
          {pain === 'soreness' && (
            <div className="flex items-start gap-2 rounded-xl bg-soft p-3 text-sm">
              <p className="flex-1">근육 뻐근함은 운동 초기에 흔하고 운동 후 48~72시간에 가장 심합니다. 단계는 내리지 않습니다. 심하면 1~2일 강도를 줄이세요.</p>
              <Why basis={[ev('hotfiel2018#peak'), ev('cheung2003#reduce')]} />
            </div>
          )}
          {pain === 'joint_or_sharp' && (
            <div className="flex items-start gap-2 rounded-xl bg-warn/10 p-3 text-sm text-warn">
              <p className="flex-1">이 부위 종목은 다음 변경 제안에서 한 단계 내립니다. 통증이 계속되면 전문의와 상담하세요.</p>
              <Why basis={[userDecision('요청서의 안전 규칙: 통증이 기록되면 해당 부위 종목을 내리고 전문의 상담 안내'), ev('nhsSprains#redFlags')]} />
            </div>
          )}
          {pain === 'red_flag' && (
            <div className="space-y-2 rounded-xl border border-bad bg-bad/10 p-3 text-sm text-bad">
              <div className="flex items-start gap-2">
                <p className="flex-1 font-semibold">
                  운동을 멈추세요. 저림·감각 이상, 뚝 하는 소리, 관절 변형, 걷기 어려움, 운동 후 콜라색 소변이 있으면 바로 진료를 받으세요.
                </p>
                <Why basis={[ev('nhsSprains#redFlags'), ev('kim2016rhabdo#darkUrine')]} />
              </div>
              <Button variant="danger" className="w-full" onClick={() => save(true)} disabled={!area}>
                기록하고 운동 끝내기
              </Button>
            </div>
          )}
        </div>
      )}
      <Button variant="primary" size="xl" className="mt-6" onClick={() => save()} disabled={pain !== 'none' && !area}>
        {isLast ? '결과 보기' : '다음 종목'}
      </Button>
    </Card>
  )
}

function SummaryPanel({ session, history }: { session: WorkoutSession; history: WorkoutSession[] }) {
  const navigate = useNavigate()
  const minutes = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60_000)
  const done = session.exercises.filter((e) => e.sets.length > 0)

  const finish = async () => {
    await finishSession(session)
    navigate('/')
  }

  return (
    <Card>
      <h2 className="mb-1 text-xl font-bold">오늘 결과</h2>
      <p className="mb-4 text-sm text-muted">약 {minutes}분 · {done.length}개 종목</p>
      <ul className="space-y-3">
        {session.exercises.map((e) => {
          const def = EXERCISES[e.exerciseId]
          const unit = def?.metric === 'seconds' ? '초' : '회'
          const cmp = compareLogs(e, previousLog(e.exerciseId, history, session.startedAt))
          const t = exerciseTotals(e)
          return (
            <li key={e.exerciseId} className="rounded-xl bg-soft p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{def?.name}</span>
                {e.sets.length === 0 ? (
                  <Badge>건너뜀</Badge>
                ) : cmp === null ? (
                  <Badge tone="accent">첫 기록</Badge>
                ) : cmp.totalDiff > 0 ? (
                  <Badge tone="ok">지난번보다 +{cmp.totalDiff}{unit}</Badge>
                ) : cmp.totalDiff < 0 ? (
                  <Badge tone="warn">지난번보다 {cmp.totalDiff}{unit}</Badge>
                ) : (
                  <Badge>지난번과 같음</Badge>
                )}
              </div>
              {e.sets.length > 0 && (
                <p className="tabular mt-1 text-sm">
                  {e.sets.map((s) => `${s.value}${s.loadKg ? `(${s.loadKg}kg)` : ''}`).join(' · ')} {unit} — 합계 {t.total}
                  {unit}
                </p>
              )}
              <p className="mt-1 text-xs text-muted">
                {e.difficulty && `체감: ${{ easy: '쉬움', ok: '적당', hard: '힘듦' }[e.difficulty]}`}
                {e.pain && ` · 통증: ${AREAS.find((a) => a.value === e.pain!.area)?.label}`}
              </p>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-xs text-muted">다음 처방은 일요일 주간 점검에서 기록을 보고 제안됩니다 (4단계).</p>
      <Button variant="primary" size="xl" className="mt-4" onClick={finish}>
        저장하고 끝내기
      </Button>
      <Button variant="ghost" className="mt-2 w-full" onClick={() => setUi(session, { phase: 'set', index: Math.max(0, session.exercises.length - 1) })}>
        마지막 종목으로 돌아가기
      </Button>
    </Card>
  )
}

// ───────────────────────── 유산소 ─────────────────────────

function CardioRunner({
  session,
  settings,
  targetMin,
  weightKg,
  alert,
}: {
  session: WorkoutSession
  settings: Settings
  targetMin: number
  weightKg: number
  alert: (n: number) => void
}) {
  useWakeLock(true)
  const navigate = useNavigate()
  const ui = session.ui ?? { phase: 'cardio' as const, index: 0 }
  const cardio = session.cardio ?? { kind: 'walk_brisk' as const, durationSec: 0, laps: [] }
  const running = !!ui.runStartedAt && !ui.pausedAt
  const now = useNow(200, running)
  const elapsedMs = ui.runStartedAt
    ? (ui.pausedAt ? new Date(ui.pausedAt).getTime() : now) - new Date(ui.runStartedAt).getTime() - (ui.pausedMs ?? 0)
    : 0
  const targetMs = targetMin * 60_000
  const fired = useRef(elapsedMs >= targetMs)
  const type = CARDIO_BY_KIND[cardio.kind]

  useEffect(() => {
    if (running && elapsedMs >= targetMs && !fired.current) {
      fired.current = true
      alert(2)
    }
  }, [running, elapsedMs, targetMs, alert])

  const quit = async () => {
    if (!confirm('이번 운동을 저장하지 않고 중단할까요?')) return
    await abandonSession(session)
    navigate('/')
  }

  const start = () => setUi(session, { runStartedAt: nowIso(), pausedMs: 0, pausedAt: undefined })
  const pause = () => setUi(session, { pausedAt: nowIso() })
  const resume = () =>
    setUi(session, { pausedAt: undefined, pausedMs: (ui.pausedMs ?? 0) + (Date.now() - new Date(ui.pausedAt!).getTime()) })
  const lap = () => patchSession(session.id, { cardio: { ...cardio, laps: [...cardio.laps, Math.floor(elapsedMs / 1000)] } })
  const stop = () =>
    patchSession(session.id, {
      cardio: { ...cardio, durationSec: Math.floor(elapsedMs / 1000) },
      ui: { ...ui, phase: 'cardio_done', pausedAt: ui.pausedAt ?? nowIso() },
    })

  if (ui.phase === 'cardio_done') {
    return <CardioDone session={session} weightKg={weightKg} settings={settings} />
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mb-3 flex justify-end">
        <button type="button" className="rounded-lg px-3 py-1.5 text-sm text-bad" onClick={quit}>
          중단
        </button>
      </div>
      <Card>
        <h2 className="mb-3 text-xl font-bold">유산소</h2>
        <select
          className="mb-4 w-full rounded-xl border border-line bg-soft px-3 py-2.5"
          value={cardio.kind}
          onChange={(e) => patchSession(session.id, { cardio: { ...cardio, kind: e.target.value as typeof cardio.kind } })}
        >
          {CARDIO_TYPES.map((c) => (
            <option key={c.kind} value={c.kind}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="tabular my-6 text-center text-7xl font-bold">{formatClock(elapsedMs, true)}</p>
        <div className="mb-1 flex justify-between text-sm text-muted">
          <span>목표 {targetMin}분</span>
          <span>{Math.min(100, Math.round((elapsedMs / targetMs) * 100))}%</span>
        </div>
        <ProgressBar value={elapsedMs} max={targetMs} tone={elapsedMs >= targetMs ? 'ok' : 'accent'} />
        <div className="mt-6 grid grid-cols-2 gap-3">
          {!ui.runStartedAt ? (
            <Button variant="primary" size="lg" className="col-span-2" onClick={start}>
              시작
            </Button>
          ) : (
            <>
              <Button size="lg" onClick={lap} disabled={!running}>
                랩
              </Button>
              {running ? (
                <Button size="lg" onClick={pause}>
                  일시정지
                </Button>
              ) : (
                <Button size="lg" variant="primary" onClick={resume}>
                  재개
                </Button>
              )}
              <Button variant="primary" size="lg" className="col-span-2" onClick={stop}>
                종료
              </Button>
            </>
          )}
        </div>
        {cardio.laps.length > 0 && (
          <ol className="tabular mt-4 space-y-1 text-sm">
            {cardio.laps.map((t, i) => (
              <li key={i} className="flex justify-between border-b border-line py-1">
                <span>랩 {i + 1}</span>
                <span>
                  {formatClock((t - (cardio.laps[i - 1] ?? 0)) * 1000)} <span className="text-muted">/ {formatClock(t * 1000)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-xs text-muted">예상 소모 {Math.round(cardioKcal(type.met, weightKg, elapsedMs / 1000))} kcal (표시용)</p>
      </Card>
    </div>
  )
}

function CardioDone({ session, weightKg }: { session: WorkoutSession; weightKg: number; settings: Settings }) {
  const navigate = useNavigate()
  const cardio = session.cardio!
  const [talk, setTalk] = useState<TalkTest | undefined>(cardio.talkTest)
  const [distance, setDistance] = useState<number | undefined>(cardio.distanceKm)
  const type = CARDIO_BY_KIND[cardio.kind]
  const kcal = cardioKcal(type.met, weightKg, cardio.durationSec)

  const save = async () => {
    await finishSession(session, { cardio: { ...cardio, talkTest: talk, distanceKm: distance } })
    navigate('/')
  }

  return (
    <Page title="유산소 결과">
      <Card>
        <p className="text-muted">{type.name}</p>
        <p className="tabular my-3 text-5xl font-bold">{formatClock(cardio.durationSec * 1000)}</p>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span>
            예상 소모 약 {Math.round(kcal)} kcal ({type.met} MET × {weightKg} kg). 식단 목표에는 더하지 않습니다.
          </span>
          <Why
            why={{ summary: '운동 소모량은 표시용입니다. 식단 목표는 활동 수준으로 이미 계산하므로, 더하면 이중 계산이 됩니다.' }}
            basis={[ev('compendium2024#met'), ev(type.ref)]}
          />
        </div>
      </Card>
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">운동 중 말하기는 어땠나요?</h2>
          <Why
            why={{ summary: '대화 테스트로 강도를 판단합니다. 노래까지 되면 중강도보다 약한 것이라, 다음 제안에서 강도를 올립니다.' }}
            basis={[ev('cdcIntensity#talkTest'), ev('garber2011#rpe')]}
          />
        </div>
        <div className="space-y-2">
          {(
            [
              ['can_sing', '노래도 부를 수 있었다 (가벼움)'],
              ['can_talk', '말은 되지만 노래는 힘들었다 (중강도)'],
              ['few_words', '몇 마디 이상 말하기 힘들었다 (고강도)'],
            ] as const
          ).map(([v, label]) => (
            <Button key={v} variant={talk === v ? 'primary' : 'soft'} className="w-full text-left" onClick={() => setTalk(v)}>
              {label}
            </Button>
          ))}
        </div>
        <div className="mt-4">
          <Field label="거리 (선택, km)">
            <NumberInput value={distance} onChange={setDistance} step={0.1} />
          </Field>
        </div>
      </Card>
      <Button variant="primary" size="xl" onClick={save}>
        저장하고 끝내기
      </Button>
    </Page>
  )
}
