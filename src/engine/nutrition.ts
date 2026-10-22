import type { Food, FoodId, FoodUnit } from '../data/foods'
import type { MenuDef, MenuItem } from '../data/menuItems'
import type { MealLog, MealPlanItem, ProgramVersion, Weekday } from './types'

// 메뉴 영양 계산. 메뉴의 칼로리·단백질은 저장하지 않고 항상 식품성분 표로 다시 계산한다
// (AI가 만든 메뉴도 같은 방식이라 AI가 수치를 바꿀 수 없다).

export interface Nutrients {
  kcal: number
  proteinG: number
  fatG: number
  carbG: number
  sodiumMg: number
}

export const ZERO: Nutrients = { kcal: 0, proteinG: 0, fatG: 0, carbG: 0, sodiumMg: 0 }

export const add = (a: Nutrients, b: Nutrients): Nutrients => ({
  kcal: a.kcal + b.kcal,
  proteinG: a.proteinG + b.proteinG,
  fatG: a.fatG + b.fatG,
  carbG: a.carbG + b.carbG,
  sodiumMg: a.sodiumMg + b.sodiumMg,
})

export interface FoodTable {
  foods: Record<FoodId, Food>
  /** 단위 1개의 무게(g). 식품별 값이 있으면 그것을, 없으면 공통 값을 쓴다 */
  unitGrams: (food: FoodId, unit: FoodUnit) => number | undefined
}

export function itemGrams(item: MenuItem, table: FoodTable): number {
  if (item.unit === 'g') return item.amount
  const g = table.unitGrams(item.food, item.unit)
  if (g === undefined) throw new Error(`단위 무게 없음: ${item.food} ${item.unit}`)
  return item.amount * g
}

export function itemsNutrition(items: MenuItem[], table: FoodTable): Nutrients {
  return items.reduce((sum, it) => {
    const f = table.foods[it.food]
    const k = itemGrams(it, table) / 100
    return add(sum, {
      kcal: f.per100g.kcal * k,
      proteinG: f.per100g.proteinG * k,
      fatG: f.per100g.fatG * k,
      carbG: f.per100g.carbG * k,
      sodiumMg: f.per100g.sodiumMg * k,
    })
  }, ZERO)
}

export const RICE_ITEM: MenuItem = { food: 'multigrain_rice', amount: 1, unit: '공기' }

/** 메뉴 문구 → 영양값. 정의가 없는 메뉴면 null */
export function menuNutrition(def: MenuDef | undefined, table: FoodTable, opts: { noRice?: boolean } = {}): Nutrients | null {
  if (!def) return null
  const items = def.withRice && !opts.noRice ? [...def.items, RICE_ITEM] : def.items
  return itemsNutrition(items, table)
}

export const menuText = (item: MealPlanItem, wd: Weekday) => item.byWeekday?.[wd] ?? item.default

export interface DayPlan {
  slots: { slot: MealPlanItem['slot']; menu: string; nutrients: Nutrients | null }[]
  total: Nutrients
}

export function dayPlan(program: ProgramVersion, wd: Weekday, findDef: (menu: string) => MenuDef | undefined, table: FoodTable, opts: { noRice?: boolean } = {}): DayPlan {
  const slots = program.meals.map((m) => {
    const menu = menuText(m, wd)
    return { slot: m.slot, menu, nutrients: menuNutrition(findDef(menu), table, opts) }
  })
  return { slots, total: slots.reduce((s, x) => add(s, x.nutrients ?? ZERO), ZERO) }
}

/** 오늘 먹은 양: 계획대로 = 메뉴 값, 다른 거 = 입력한 값, 안 먹음 = 0. 술 칼로리는 따로 더한다 */
export function eatenToday(plan: DayPlan, meals: MealLog[], alcoholKcal: number): { kcal: number; proteinG: number; unknown: number } {
  let kcal = alcoholKcal
  let proteinG = 0
  let unknown = 0
  for (const m of meals) {
    if (m.status === 'as_planned') {
      const n = plan.slots.find((s) => s.slot === m.slot)?.nutrients
      if (n) {
        kcal += n.kcal
        proteinG += n.proteinG
      } else unknown++
    } else if (m.status === 'different') {
      if (m.kcal === undefined && m.proteinG === undefined) unknown++
      kcal += m.kcal ?? 0
      proteinG += m.proteinG ?? 0
    }
  }
  return { kcal: Math.round(kcal), proteinG: Math.round(proteinG), unknown }
}
