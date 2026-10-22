import { useState } from 'react'
import { Badge, Card, CardTitle, Loading, Page, Sheet, cx } from '../../components/ui'
import { RECIPES, type Recipe, findRecipe } from '../../data/recipes'
import { useProgram, useSettings, useToday } from '../../db/hooks'
import { WEEKDAY_LABEL, weekdayOf } from '../../engine/day'
import type { MealPlanItem, ProgramVersion, Schedule, Weekday } from '../../engine/types'

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

const menuOf = (item: MealPlanItem, wd: Weekday) => item.byWeekday?.[wd] ?? item.default

/** 월요일부터 일요일 순서 */
const WEEK: Weekday[] = [1, 2, 3, 4, 5, 6, 0]

export default function DietPage() {
  const settings = useSettings()
  const program = useProgram()
  const today = useToday(settings)
  const [open, setOpen] = useState<Recipe | null>(null)
  if (!settings || !program || !today) return <Loading />
  const wd = weekdayOf(today)

  return (
    <Page title="식단">
      <TodayMenu program={program} schedule={settings.schedule} wd={wd} onOpen={setOpen} />
      <WeekMenu program={program} wd={wd} onOpen={setOpen} />

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

      <p className="px-1 text-xs text-muted">
        칼로리·단백질 계산과 냉장고 재료 기반 메뉴 추천은 다음 단계(식단 엔진)에서 붙습니다.
      </p>

      {open && <RecipeSheet recipe={open} onClose={() => setOpen(null)} />}
    </Page>
  )
}

function TodayMenu({ program, schedule, wd, onOpen }: { program: ProgramVersion; schedule: Schedule; wd: Weekday; onOpen: (r: Recipe) => void }) {
  return (
    <Card>
      <CardTitle>오늘 메뉴 ({WEEKDAY_LABEL[wd]})</CardTitle>
      <ul className="space-y-3">
        {program.meals.map((item) => {
          const menu = menuOf(item, wd)
          const recipe = findRecipe(menu)
          return (
            <li key={item.slot} className="rounded-xl bg-soft p-3">
              <div className="flex items-baseline gap-2">
                <span className="tabular text-sm text-muted">{schedule[SLOT_TIME[item.slot]]}</span>
                <span className="font-semibold">{SLOT_LABEL[item.slot]}</span>
              </div>
              <p className="mt-1">{menu}</p>
              {item.note && <p className="text-xs text-muted">{item.note}</p>}
              {recipe && (
                <button type="button" className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink" onClick={() => onOpen(recipe)}>
                  레시피 보기
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function WeekMenu({ program, wd, onOpen }: { program: ProgramVersion; wd: Weekday; onOpen: (r: Recipe) => void }) {
  const dinner = program.meals.find((m) => m.slot === 'meal2')
  if (!dinner) return null
  return (
    <Card>
      <CardTitle>이번 주 둘째 끼</CardTitle>
      <ul className="divide-y divide-line">
        {WEEK.map((d) => {
          const menu = menuOf(dinner, d)
          const recipe = findRecipe(menu)
          return (
            <li key={d}>
              <button
                type="button"
                disabled={!recipe}
                className="flex w-full items-center gap-3 py-2.5 text-left disabled:cursor-default"
                onClick={() => recipe && onOpen(recipe)}
              >
                <span className={cx('w-6 text-center font-semibold', d === wd ? 'text-accent' : 'text-muted')}>{WEEKDAY_LABEL[d]}</span>
                <span className="flex-1">{menu}</span>
                {d === wd && <Badge tone="accent">오늘</Badge>}
                {recipe && <span className="text-sm text-muted">›</span>}
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
