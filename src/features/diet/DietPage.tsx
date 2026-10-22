import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Why } from '../../components/Why'
import { Badge, Card, CardTitle, Loading, Page, ProgressBar, Sheet, cx } from '../../components/ui'
import { RECIPES, type Recipe } from '../../data/recipes'
import { ev } from '../../data/rules'
import { db } from '../../db/db'
import { useProgram, useSettings, useToday } from '../../db/hooks'
import { WEEKDAY_LABEL, addDays, weekStart, weekdayOf } from '../../engine/day'
import type { AiDinner, LocalDate, MealPlanItem, ProgramVersion, Schedule, WeekMenu } from '../../engine/types'
import { AiMenuCard, AiRecipeSheet } from './AiMenuCard'
import { NUTRITION_BASIS, fmtN, planForDate, useActiveWeekMenu } from './plan'

const SLOT_LABEL: Record<MealPlanItem['slot'], string> = {
  meal1: '첫 끼',
  post_workout: '운동 후 단백질',
  meal2: '둘째 끼',
  snack: '간식',
}

const SLOT_TIME: Record<MealPlanItem['slot'], keyof Schedule> = {
  meal1: 'meal1',
  post_workout: 'postWorkout',
  meal2: 'meal2',
  snack: 'snack',
}

export default function DietPage() {
  const settings = useSettings()
  const program = useProgram()
  const today = useToday(settings)
  const ai = useActiveWeekMenu(today ?? '2000-01-01')
  const drinkingToday = useLiveQuery(async () => (today ? (await db.drinkLogs.where('date').equals(today).count()) > 0 : false), [today])
  const [open, setOpen] = useState<Recipe | null>(null)
  const [openAi, setOpenAi] = useState<AiDinner | null>(null)
  if (!settings || !program || !today || ai === undefined) return <Loading />

  return (
    <Page title="식단">
      <TodayMenu program={program} schedule={settings.schedule} today={today} ai={ai} drinking={!!drinkingToday} onOpen={setOpen} onOpenAi={setOpenAi} />
      <WeekView program={program} today={today} ai={ai} onOpen={setOpen} onOpenAi={setOpenAi} />
      <AiMenuCard program={program} today={today} />

      <Card>
        <CardTitle>레시피 모음</CardTitle>
        <ul className="divide-y divide-line">
          {RECIPES.map((r) => (
            <li key={r.id}>
              <button type="button" className="flex w-full items-center justify-between py-3 text-left" onClick={() => setOpen(r)}>
                <span>{r.name}</span>
                <span className="text-sm text-muted">보기 ›</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {open && <RecipeSheet recipe={open} onClose={() => setOpen(null)} />}
      {openAi && <AiRecipeSheet dinner={openAi} onClose={() => setOpenAi(null)} />}
    </Page>
  )
}

function TodayMenu({
  program,
  schedule,
  today,
  ai,
  drinking,
  onOpen,
  onOpenAi,
}: {
  program: ProgramVersion
  schedule: Schedule
  today: LocalDate
  ai: WeekMenu | null
  drinking: boolean
  onOpen: (r: Recipe) => void
  onOpenAi: (d: AiDinner) => void
}) {
  const plan = planForDate(program, today, ai, { drinking })
  const t = program.nutrition
  const fatPct = plan.total.kcal ? Math.round(((plan.total.fatG * 9) / plan.total.kcal) * 100) : 0
  return (
    <Card>
      <CardTitle>오늘 메뉴 ({WEEKDAY_LABEL[weekdayOf(today)]})</CardTitle>
      <ul className="space-y-3">
        {plan.slots.map((s) => (
          <li key={s.slot} className="rounded-xl bg-soft p-3">
            <div className="flex items-baseline gap-2">
              <span className="tabular text-sm text-muted">{schedule[SLOT_TIME[s.slot]]}</span>
              <span className="font-semibold">{SLOT_LABEL[s.slot]}</span>
              {s.ai && <Badge tone="accent">AI</Badge>}
            </div>
            <p className="mt-1">{s.menu}</p>
            {s.note && <p className="text-xs text-muted">{s.note}</p>}
            {s.nutrients && <p className="mt-1 text-xs text-muted">{fmtN(s.nutrients)}</p>}
            {(s.recipe || s.ai) && (
              <button
                type="button"
                className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink"
                onClick={() => (s.ai ? onOpenAi(s.ai) : s.recipe && onOpen(s.recipe))}
              >
                레시피 보기
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold">계획대로 다 먹으면</span>
          <Why
            why={{
              summary: `메뉴의 재료와 분량으로 계산했습니다.${drinking ? ' 오늘은 음주 기록이 있어 저녁 밥을 뺐습니다.' : ''} 지방은 하루 에너지의 ${fatPct}%입니다 (한국인 영양소 섭취기준 15~30%).`,
            }}
            basis={[...NUTRITION_BASIS, t.basis, ev('kdri2020#amdr')]}
          />
        </div>
        {(
          [
            ['칼로리', plan.total.kcal, t.kcal, 'kcal'],
            ['단백질', plan.total.proteinG, t.proteinG, 'g'],
            ['지방', plan.total.fatG, t.fatG, 'g'],
          ] as const
        ).map(([label, v, goal, unit]) => (
          <div key={label}>
            <div className="flex justify-between text-xs">
              <span>{label}</span>
              <span className={cx('tabular', label === '지방' && v > goal * 1.1 && 'text-warn')}>
                {Math.round(v)} / {goal} {unit}
              </span>
            </div>
            <ProgressBar value={v} max={goal} tone={label === '지방' && v > goal * 1.1 ? 'warn' : 'accent'} />
          </div>
        ))}
      </div>
    </Card>
  )
}

/** 월요일부터 일요일 */
function WeekView({ program, today, ai, onOpen, onOpenAi }: { program: ProgramVersion; today: LocalDate; ai: WeekMenu | null; onOpen: (r: Recipe) => void; onOpenAi: (d: AiDinner) => void }) {
  const monday = weekStart(today)
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  return (
    <Card>
      <CardTitle>이번 주 둘째 끼</CardTitle>
      <ul className="divide-y divide-line">
        {dates.map((d) => {
          const s = planForDate(program, d, ai).slots.find((x) => x.slot === 'meal2')!
          const can = !!(s.recipe || s.ai)
          return (
            <li key={d}>
              <button
                type="button"
                disabled={!can}
                className="flex w-full items-center gap-3 py-2.5 text-left disabled:cursor-default"
                onClick={() => (s.ai ? onOpenAi(s.ai) : s.recipe && onOpen(s.recipe))}
              >
                <span className={cx('w-6 text-center font-semibold', d === today ? 'text-accent' : 'text-muted')}>{WEEKDAY_LABEL[weekdayOf(d)]}</span>
                <span className="flex-1">
                  {s.menu}
                  {s.nutrients && <span className="block text-xs text-muted">{fmtN(s.nutrients)}</span>}
                </span>
                {s.ai && <Badge tone="accent">AI</Badge>}
                {d === today && <Badge tone="accent">오늘</Badge>}
                {can && <span className="text-sm text-muted">›</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

export function RecipeSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title={recipe.name}>
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 font-semibold">재료 (1인분)</h3>
          <ul className="divide-y divide-line rounded-xl bg-soft px-3">
            {recipe.ingredients.map((i) => (
              <li key={i.name} className="flex justify-between gap-3 py-2 text-sm">
                <span>{i.name}</span>
                <span className="text-right text-muted">{i.amount}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 font-semibold">만드는 순서</h3>
          <ol className="space-y-2">
            {recipe.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </section>
        {recipe.tips && (
          <section className="rounded-xl bg-warn/10 p-3 text-sm">
            {recipe.tips.map((t) => (
              <p key={t}>· {t}</p>
            ))}
          </section>
        )}
        <section>
          <h3 className="mb-2 font-semibold">원본 레시피</h3>
          {recipe.sources.length === 0 ? (
            <p className="text-sm text-muted">아직 연결된 원본 레시피가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {recipe.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-line p-3 active:bg-soft">
                    <div className="flex items-center gap-2">
                      <Badge tone={s.site === 'YouTube' ? 'bad' : 'ok'}>{s.site}</Badge>
                      <span className="text-xs text-muted">{s.author}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium">{s.title}</p>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">위 조리 순서는 앱이 1인분에 맞춰 정리한 요약입니다. 자세한 방법과 영상은 원본 레시피에서 보세요.</p>
        </section>
      </div>
    </Sheet>
  )
}
