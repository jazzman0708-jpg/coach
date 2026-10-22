import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Why } from '../../components/Why'
import { Badge, Button, Card, CardTitle, Sheet } from '../../components/ui'
import { FOODS, FOOD_IDS, unitGrams } from '../../data/foods'
import { db } from '../../db/db'
import { addDays, formatKoreanDate, weekStart, weekdayOf } from '../../engine/day'
import { checkDinner, shoppingList } from '../../engine/shopping'
import type { AiDinner, LocalDate, ProgramVersion, WeekMenu } from '../../engine/types'
import { AiMenuError, generateDinners } from '../../lib/aiMenu'
import { nowIso } from '../../lib/time'
import { NUTRITION_BASIS, aiDinnerNutrition, fmtN, planForDate } from './plan'

/** 둘째 끼 목표 = 하루 목표 − 고정 끼니(첫 끼·운동 후·간식). 규칙 엔진의 목표에서 계산만 한다 */
export function dinnerTarget(program: ProgramVersion, date: LocalDate) {
  const plan = planForDate(program, date, null)
  const fixed = plan.slots.filter((s) => s.slot !== 'meal2').reduce(
    (a, s) => ({ kcal: a.kcal + (s.nutrients?.kcal ?? 0), proteinG: a.proteinG + (s.nutrients?.proteinG ?? 0), fatG: a.fatG + (s.nutrients?.fatG ?? 0) }),
    { kcal: 0, proteinG: 0, fatG: 0 },
  )
  return {
    kcal: Math.max(300, Math.round(program.nutrition.kcal - fixed.kcal)),
    proteinG: Math.max(10, Math.round(program.nutrition.proteinG - fixed.proteinG)),
    fatG: Math.max(5, Math.round(program.nutrition.fatG - fixed.fatG)),
  }
}

/** 이번 주 남은 날 (일요일이면 다음 주 월~일) */
function targetDates(today: LocalDate): { weekOf: LocalDate; dates: LocalDate[] } {
  if (weekdayOf(today) === 0) {
    const weekOf = addDays(today, 1)
    return { weekOf, dates: Array.from({ length: 7 }, (_, i) => addDays(weekOf, i)) }
  }
  const weekOf = weekStart(today)
  const end = addDays(weekOf, 6)
  const dates: LocalDate[] = []
  for (let d = today; d <= end; d = addDays(d, 1)) dates.push(d)
  return { weekOf, dates }
}

export function AiMenuCard({ program, today }: { program: ProgramVersion; today: LocalDate }) {
  const key = useLiveQuery(() => db.secrets.get('claudeApiKey'), [])
  const { weekOf, dates } = targetDates(today)
  const menu = useLiveQuery(() => db.weekMenus.get(weekOf), [weekOf])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [open, setOpen] = useState<AiDinner | null>(null)
  const target = dinnerTarget(program, today)

  const generate = async () => {
    if (!key?.value) return
    setBusy(true)
    setError(undefined)
    try {
      const pantry = await db.pantry.toArray()
      const recentSessions = await db.weekMenus.toArray()
      const recent = recentSessions.flatMap((m) => m.dinners.map((d) => d.name)).slice(-14)
      const { dinners, model } = await generateDinners({
        apiKey: key.value,
        dates,
        target,
        foods: FOOD_IDS.map((id) => ({ id, name: FOODS[id].name, keepsLong: FOODS[id].keepsLong })),
        pantry: pantry.filter((p) => p.qty > 0).map((p) => ({ name: p.name, qty: p.qty, unit: p.unit })),
        recent,
      })
      if (dinners.length === 0) throw new AiMenuError('AI가 메뉴를 만들지 못했습니다. 다시 시도하세요.')
      await db.weekMenus.put({ weekOf, createdAt: nowIso(), model, dinners, status: 'draft' })
    } catch (e) {
      setError(e instanceof Error ? e.message : '메뉴를 만들지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (!key?.value) {
    return (
      <Card>
        <CardTitle>AI로 이번 주 저녁 메뉴 만들기</CardTitle>
        <p className="text-sm text-muted">
          설정에서 Claude API 키를 넣으면 냉장고 재료와 목표에 맞춘 저녁 메뉴·장보기 목록을 만들 수 있습니다.{' '}
          <Link to="/settings" className="text-accent underline">
            설정으로
          </Link>
        </p>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardTitle right={menu ? <Badge tone={menu.status === 'active' ? 'ok' : 'warn'}>{menu.status === 'active' ? '사용 중' : '검토 중'}</Badge> : undefined}>
          AI 저녁 메뉴 ({formatKoreanDate(dates[0])}~)
        </CardTitle>
        <div className="mb-3 flex items-start gap-2 text-sm text-muted">
          <p className="flex-1">
            저녁 1인분 목표: {target.kcal} kcal 안팎 · 단백질 {target.proteinG} g 이상 · 지방 {target.fatG} g 이하 (하루 목표에서 다른 끼니를 뺀 값). AI는 메뉴만 짜고, 숫자는 앱이 식품성분표로 다시 계산합니다.
          </p>
          <Why basis={[program.nutrition.basis, ...NUTRITION_BASIS]} />
        </div>
        {!menu && (
          <Button variant="primary" className="w-full" onClick={generate} disabled={busy}>
            {busy ? 'AI가 메뉴를 짜는 중… (30초~1분)' : '이번 주 저녁 메뉴 만들기'}
          </Button>
        )}
        {menu && <MenuList menu={menu} target={target} onOpen={setOpen} />}
        {menu && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {menu.status === 'draft' ? (
              <Button variant="primary" onClick={() => db.weekMenus.update(menu.weekOf, { status: 'active' })}>
                이 메뉴로 쓰기
              </Button>
            ) : (
              <Button onClick={() => db.weekMenus.update(menu.weekOf, { status: 'draft' })}>원래 메뉴로</Button>
            )}
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                if (!confirm('지금 메뉴를 버리고 다시 만들까요? (API 사용 요금이 다시 듭니다)')) return
                await db.weekMenus.delete(menu.weekOf)
                await generate()
              }}
            >
              {busy ? '만드는 중…' : '다시 만들기'}
            </Button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      </Card>
      {menu && <ShoppingCard dinners={menu.dinners} />}
      {open && <AiRecipeSheet dinner={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function MenuList({ menu, target, onOpen }: { menu: WeekMenu; target: { kcal: number; proteinG: number; fatG: number }; onOpen: (d: AiDinner) => void }) {
  return (
    <ul className="divide-y divide-line">
      {menu.dinners.map((d) => {
        const n = aiDinnerNutrition(d)
        const check = checkDinner(n, target)
        return (
          <li key={d.date}>
            <button type="button" className="w-full py-2.5 text-left" onClick={() => onOpen(d)}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-muted">{formatKoreanDate(d.date)}</span>
                {!check.ok && <Badge tone="warn">목표와 차이</Badge>}
              </div>
              <p className="font-medium">{d.name}</p>
              <p className="text-xs text-muted">{fmtN(n)}</p>
              {!check.ok && <p className="text-xs text-warn">{check.issues.join(' · ')}</p>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function ShoppingCard({ dinners }: { dinners: AiDinner[] }) {
  const pantry = useLiveQuery(() => db.pantry.toArray(), []) ?? []
  const lines = shoppingList(dinners, pantry, FOODS, unitGrams)
  const toBuy = lines.filter((l) => l.buyG > 0)
  return (
    <Card>
      <CardTitle>장보기 목록</CardTitle>
      <p className="mb-2 text-xs text-muted">메뉴에 필요한 양에서 냉장고 재료(기록 → 냉장고)를 뺀 값입니다. 양념은 빠져 있습니다.</p>
      {toBuy.length === 0 ? (
        <p className="text-sm text-muted">냉장고 재료로 충분합니다.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {toBuy.map((l) => (
            <li key={l.food} className="flex justify-between py-1.5">
              <span>{l.name}</span>
              <span className="tabular">
                {l.buyG} g {l.haveG > 0 && <span className="text-xs text-muted">(필요 {l.needG} g, 있음 {l.haveG} g)</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function AiRecipeSheet({ dinner, onClose }: { dinner: AiDinner; onClose: () => void }) {
  const n = aiDinnerNutrition(dinner)
  return (
    <Sheet open onClose={onClose} title={dinner.name}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{fmtN(n)} (앱이 식품성분표로 계산)</p>
        <section>
          <h3 className="mb-2 font-semibold">재료 (1인분)</h3>
          <ul className="divide-y divide-line rounded-xl bg-soft px-3 text-sm">
            {dinner.ingredients.map((i) => (
              <li key={i.food} className="flex justify-between py-2">
                <span>{FOODS[i.food as keyof typeof FOODS]?.name ?? i.food}</span>
                <span className="tabular text-muted">{Math.round(i.grams)} g</span>
              </li>
            ))}
            {dinner.seasonings.length > 0 && <li className="py-2 text-muted">양념: {dinner.seasonings.join(', ')}</li>}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 font-semibold">만드는 순서</h3>
          <ol className="space-y-2">
            {dinner.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </section>
        <p className="text-xs text-muted">AI가 만든 레시피입니다. 처음 해 보는 요리라면 만개의 레시피 등에서 같은 메뉴를 함께 찾아보세요.</p>
      </div>
    </Sheet>
  )
}
