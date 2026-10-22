import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Why } from '../../components/Why'
import { Badge, Button, Card, CardTitle, Loading, Page, cx } from '../../components/ui'
import { DRINK_BY_ID } from '../../data/drinks'
import { type Recipe, findRecipe } from '../../data/recipes'
import { RULES } from '../../data/rules'
import { db, newId } from '../../db/db'
import { useActiveSession, useProgram, useSettings, useToday } from '../../db/hooks'
import { alcoholByDay, drinkingStatus } from '../../engine/alcohol'
import { addDays, formatKoreanDate, timeOnLogicalDate, weekStart, weekdayOf } from '../../engine/day'
import { type ReminderKind, dueReminders, remindersOf } from '../../engine/reminders'
import { dayKind } from '../../engine/schedule'
import { shortSleepWarning, sleepHours } from '../../engine/sleep'
import type { LocalDate, MealLog, MealSlot, ProgramVersion, Settings } from '../../engine/types'
import { hhmm, nowIso, useNow } from '../../lib/time'
import { DrinkSheet, MealDifferentSheet, SleepSheet, WeightSheet, lastNight } from '../records/forms'
import { RecipeSheet } from '../diet/DietPage'
import { WorkoutStartCard } from '../workout/StartCard'

export default function TodayPage() {
  const settings = useSettings()
  const program = useProgram()
  const today = useToday(settings)
  if (!settings || !program || !today) return <Loading />
  return <TodayView settings={settings} program={program} today={today} />
}

// '나중에'를 누른 알림은 그날 하루 다시 띄우지 않는다 (기기별 편의 설정이라 localStorage)
const dismissKey = (date: LocalDate) => `coach.dismissed.${date}`
function readDismissed(date: LocalDate): ReminderKind[] {
  try {
    return JSON.parse(localStorage.getItem(dismissKey(date)) ?? '[]')
  } catch {
    return []
  }
}

function ReminderCard({ title, text, action, onAction, onLater }: { title: string; text: string; action: string; onAction: () => void; onLater: () => void }) {
  return (
    <Card className="border-accent bg-accent/10">
      <p className="text-lg font-bold">🔔 {title}</p>
      <p className="mt-1 text-sm">{text}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" onClick={onAction}>
          {action}
        </Button>
        <Button variant="ghost" onClick={onLater}>
          나중에
        </Button>
      </div>
    </Card>
  )
}

const MEAL_LABEL: Record<Exclude<MealSlot, 'extra'>, string> = {
  meal1: '첫 끼',
  post_workout: '운동 후 단백질',
  meal2: '둘째 끼',
  snack: '간식',
}

function TodayView({ settings, program, today }: { settings: Settings; program: ProgramVersion; today: LocalDate }) {
  const wk = weekStart(today)
  const active = useActiveSession()
  const sessions = useLiveQuery(() => db.sessions.where('date').between(addDays(today, -14), today, true, true).toArray(), [today]) ?? []
  const meals = useLiveQuery(() => db.mealLogs.where('date').equals(today).toArray(), [today]) ?? []
  const drinks = useLiveQuery(() => db.drinkLogs.where('date').between(wk, addDays(wk, 6), true, true).toArray(), [wk]) ?? []
  const sleeps = useLiveQuery(() => db.sleepLogs.where('date').between(addDays(today, -8), today, true, true).toArray(), [today]) ?? []
  const lastBody = useLiveQuery(() => db.bodyLogs.orderBy('date').reverse().limit(30).toArray(), []) ?? []
  const now = useNow(60_000)

  const [sheet, setSheet] = useState<null | 'weight' | 'sleep' | 'drink' | { meal: MealSlot; label: string }>(null)
  const close = () => setSheet(null)
  const [recipe, setRecipe] = useState<Recipe | null>(null)

  const kind = dayKind(today, program)
  const status = drinkingStatus({
    date: today,
    kind,
    week: alcoholByDay(drinks, wk, 7, DRINK_BY_ID, RULES),
    flush: settings.profile.alcoholFlush,
    goal: program.drinkingGoal,
    rules: RULES,
  })
  const sleepWarn = shortSleepWarning(sleeps, today, RULES)
  const night = sleeps.find((s) => s.date === lastNight(today))
  const todayBody = lastBody.find((b) => b.date === today)
  const lastWeight = lastBody.find((b) => b.weightKg !== undefined)?.weightKg ?? settings.profile.startWeightKg ?? 70
  const lastWaist = lastBody.find((b) => b.waistCm !== undefined)?.waistCm
  const wd = weekdayOf(today)
  const sch = settings.schedule
  const at = (t: string) => timeOnLogicalDate(today, t, settings.dayBoundaryHour).getTime()

  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState<ReminderKind[]>(() => readDismissed(today))
  const dismiss = (k: ReminderKind) => {
    const next = [...dismissed, k]
    setDismissed(next)
    try {
      localStorage.setItem(dismissKey(today), JSON.stringify(next))
    } catch {
      // 저장 실패 시 이번 화면에서만 숨김
    }
  }
  const due = dueReminders({
    now: new Date(now),
    today,
    boundaryHour: settings.dayBoundaryHour,
    reminders: remindersOf(settings),
    workoutTime: sch.workout,
    kind,
    sleepLogged: !!night,
    workoutDone: sessions.some((s) => s.date === today && s.status === 'done'),
    workoutInProgress: active !== 'loading' && !!active,
  }).filter((k) => !dismissed.includes(k))

  const setMeal = async (slot: MealSlot, st: MealLog['status']) => {
    const existing = meals.find((m) => m.slot === slot)
    if (existing?.status === st) return db.mealLogs.delete(existing.id)
    if (st === 'different') return setSheet({ meal: slot, label: MEAL_LABEL[slot as keyof typeof MEAL_LABEL] })
    if (existing) return db.mealLogs.update(existing.id, { status: st, note: undefined, kcal: undefined, proteinG: undefined, at: nowIso() })
    return db.mealLogs.add({ id: newId(), date: today, slot, status: st, at: nowIso() })
  }

  const mealItem = (slot: Exclude<MealSlot, 'extra'>, time: string) => {
    const plan = program.meals.find((m) => m.slot === slot)
    const menu = plan?.byWeekday?.[wd] ?? plan?.default ?? ''
    const log = meals.find((m) => m.slot === slot)
    const r = findRecipe(menu)
    return {
      time,
      title: MEAL_LABEL[slot],
      detail: (
        <>
          <p>
            {menu}
            {r && (
              <button type="button" className="ml-2 text-xs font-semibold text-accent underline" onClick={() => setRecipe(r)}>
                레시피
              </button>
            )}
          </p>
          {plan?.note && <p className="text-xs text-muted">{plan.note}</p>}
          {log?.status === 'different' && <p className="text-xs text-accent">먹은 것: {log.note}</p>}
        </>
      ),
      done: !!log,
      action: (
        <div className="mt-2 flex gap-2">
          {(
            [
              ['as_planned', '계획대로'],
              ['skipped', '안 먹음'],
              ['different', '다른 거'],
            ] as const
          ).map(([st, label]) => (
            <button
              key={st}
              type="button"
              onClick={() => setMeal(slot, st)}
              className={cx(
                'flex-1 rounded-lg py-2 text-sm font-semibold',
                log?.status === st ? 'bg-accent text-accent-ink' : 'bg-soft text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ),
    }
  }

  const timeline = [
    {
      time: sch.wake,
      title: '기상 · 수면 기록',
      detail: night ? <p>어젯밤 {sleepHours(night).toFixed(1)}시간 ({hhmm(night.bedAt)}~{hhmm(night.wakeAt)})</p> : <p className="text-muted">어젯밤 수면을 기록하세요.</p>,
      done: !!night,
      action: (
        <Button size="sm" className="mt-2" onClick={() => setSheet('sleep')}>
          {night ? '수정' : '수면 기록'}
        </Button>
      ),
    },
    {
      time: sch.wake,
      title: '체중 (아침)',
      detail: todayBody?.weightKg ? <p>{todayBody.weightKg} kg{todayBody.waistCm ? ` · 허리 ${todayBody.waistCm} cm` : ''}</p> : <p className="text-muted">기상 직후, 화장실 다녀온 뒤</p>,
      done: !!todayBody?.weightKg,
      action: (
        <Button size="sm" className="mt-2" onClick={() => setSheet('weight')}>
          {todayBody?.weightKg ? '수정' : '체중 기록'}
        </Button>
      ),
    },
    mealItem('meal1', sch.meal1),
    {
      time: sch.workout,
      title: kind === 'strength' ? '근력 운동' : kind === 'cardio' ? '유산소' : '휴식',
      detail: <p className="text-muted">위 운동 카드에서 시작</p>,
      done: sessions.some((s) => s.date === today && s.status === 'done'),
      action: null,
    },
    mealItem('post_workout', sch.postWorkout),
    mealItem('meal2', sch.meal2),
    mealItem('snack', sch.snack),
    {
      time: sch.bed,
      title: '취침',
      detail: <p className="text-muted">7시간 이상 자는 것이 목표</p>,
      done: false,
      action: null,
    },
  ]
  const nextIndex = timeline.findIndex((t) => !t.done && at(t.time) >= now - 30 * 60_000)

  return (
    <Page
      title="오늘"
      right={
        <div className="text-right">
          <p className="text-sm text-muted">{formatKoreanDate(today)}</p>
          <Badge tone={kind === 'strength' ? 'accent' : kind === 'cardio' ? 'ok' : 'muted'}>
            {kind === 'strength' ? '근력 운동일' : kind === 'cardio' ? '유산소일' : '휴식일'}
          </Badge>
        </div>
      }
    >
      {due.includes('sleep') && (
        <ReminderCard
          title="수면 기록할 시간이에요"
          text="어젯밤 잠든 시각과 일어난 시각을 기록하세요."
          action="수면 기록하기"
          onAction={() => setSheet('sleep')}
          onLater={() => dismiss('sleep')}
        />
      )}
      {due.includes('workout') && (
        <ReminderCard
          title="운동할 시간이에요"
          text={kind === 'strength' ? '오늘은 근력 운동일입니다.' : '오늘은 유산소일입니다.'}
          action="운동 시작하러 가기"
          onAction={() => navigate('/workout')}
          onLater={() => dismiss('workout')}
        />
      )}

      {sleepWarn && (
        <Card className="border-warn/50">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm text-warn">
              수면 부족이 이어지고 있습니다 (최근 7일 중 {sleepWarn.value.shortNights}일 7시간 미만). 감량 속도를 낮추는 제안이 나갈 수 있습니다.
            </p>
            <Why why={sleepWarn.why} basis={sleepWarn.basis} />
          </div>
        </Card>
      )}

      <WorkoutStartCard settings={settings} program={program} today={today} sessions={sessions} active={active === 'loading' ? null : active} />

      <Card>
        <CardTitle right={<Why why={status.why} basis={status.basis} />}>음주</CardTitle>
        <p
          className={cx(
            'text-lg font-semibold',
            status.value.level === 'no' && 'text-bad',
            status.value.level === 'caution' && 'text-warn',
            status.value.level === 'ok' && 'text-ok',
          )}
        >
          {status.value.headline}
        </p>
        <p className="mt-1 text-sm text-muted">
          이번 주 {status.value.weekDrinks.toFixed(1)}잔 / {status.value.weeklyLimit}잔 · {status.value.occasions}회 / 목표 {status.value.goalOccasions}회
        </p>
        <Button size="sm" className="mt-3" onClick={() => setSheet('drink')}>
          음주 기록
        </Button>
      </Card>

      <Card>
        <CardTitle>오늘 타임라인</CardTitle>
        <ol className="relative space-y-4 border-l border-line pl-4">
          {timeline.map((t, i) => (
            <li key={`${t.title}-${i}`} className="relative">
              <span
                className={cx(
                  'absolute -left-[22.5px] top-1 h-3 w-3 rounded-full border-2',
                  t.done ? 'border-ok bg-ok' : i === nextIndex ? 'border-accent bg-accent' : 'border-line bg-card',
                )}
              />
              <div className="flex items-baseline gap-2">
                <span className="tabular text-sm text-muted">{t.time}</span>
                <span className={cx('font-semibold', t.done && 'text-muted line-through')}>{t.title}</span>
              </div>
              <div className="text-sm">{t.detail}</div>
              {t.action}
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardTitle right={<Why why={{ summary: `시작 목표: ${program.nutrition.kcal.toLocaleString()} kcal, 단백질 ${program.nutrition.proteinG} g, 지방 ${program.nutrition.fatG} g` }} basis={[program.nutrition.basis]} />}>
          단백질·칼로리
        </CardTitle>
        <p className="text-sm text-muted">
          목표 {program.nutrition.kcal.toLocaleString()} kcal · 단백질 {program.nutrition.proteinG} g. 진행 바는 식품성분 DB를 붙이는 4단계에서 켜집니다. 지금은 끼니 체크만 기록됩니다.
        </p>
      </Card>

      {recipe && <RecipeSheet recipe={recipe} onClose={() => setRecipe(null)} />}
      {sheet === 'weight' && <WeightSheet open onClose={close} date={today} lastWeight={lastWeight} lastWaist={lastWaist} />}
      {sheet === 'sleep' && <SleepSheet open onClose={close} settings={settings} night={lastNight(today)} />}
      {sheet === 'drink' && <DrinkSheet open onClose={close} date={today} />}
      {sheet && typeof sheet === 'object' && <MealDifferentSheet open onClose={close} date={today} slot={sheet.meal} label={sheet.label} />}
    </Page>
  )
}
