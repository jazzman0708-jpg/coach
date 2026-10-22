import { useLiveQuery } from 'dexie-react-hooks'
import { FOODS, type FoodId, unitGrams } from '../../data/foods'
import { findMenuDef } from '../../data/menuItems'
import { findRecipe, type Recipe } from '../../data/recipes'
import { evx } from '../../data/rules'
import { db } from '../../db/db'
import { weekStart, weekdayOf } from '../../engine/day'
import { type FoodTable, type Nutrients, ZERO, add, itemsNutrition, menuNutrition, menuText } from '../../engine/nutrition'
import type { AiDinner, Basis, LocalDate, MealPlanItem, ProgramVersion, WeekMenu } from '../../engine/types'

export const FOOD_TABLE: FoodTable = { foods: FOODS, unitGrams }

export const NUTRITION_BASIS: Basis[] = [
  evx('달걀 1개·큰술·두부 1모 등 단위 무게는 공식 값을 찾지 못해 앱이 정한 추정값 (밥 1공기 210 g만 공식 값)', 'rdaFoodDb#values', 'rdaFoodDb#rice'),
]

export const aiDinnerNutrition = (d: AiDinner): Nutrients =>
  itemsNutrition(
    d.ingredients.filter((i) => i.food in FOODS).map((i) => ({ food: i.food as FoodId, amount: i.grams, unit: 'g' as const })),
    FOOD_TABLE,
  )

export function useActiveWeekMenu(date: LocalDate) {
  return useLiveQuery(async () => {
    const m = await db.weekMenus.get(weekStart(date))
    return m?.status === 'active' ? m : null
  }, [date])
}

export interface SlotPlan {
  slot: MealPlanItem['slot']
  menu: string
  note?: string
  nutrients: Nutrients | null
  recipe?: Recipe
  ai?: AiDinner
}

/** 그날 메뉴와 영양. AI 주간 메뉴를 쓰기로 했으면 둘째 끼를 그것으로 바꾼다. 술 마신 날은 밥을 뺀다 */
export function planForDate(program: ProgramVersion, date: LocalDate, ai: WeekMenu | null | undefined, opts: { drinking?: boolean } = {}): { slots: SlotPlan[]; total: Nutrients } {
  const wd = weekdayOf(date)
  const slots = program.meals.map((m): SlotPlan => {
    const dinner = m.slot === 'meal2' ? ai?.dinners.find((d) => d.date === date) : undefined
    if (dinner) return { slot: m.slot, menu: dinner.name, nutrients: aiDinnerNutrition(dinner), ai: dinner }
    const menu = menuText(m, wd)
    return {
      slot: m.slot,
      menu,
      note: m.note,
      nutrients: menuNutrition(findMenuDef(menu), FOOD_TABLE, { noRice: opts.drinking }),
      recipe: findRecipe(menu),
    }
  })
  return { slots, total: slots.reduce((s, x) => add(s, x.nutrients ?? ZERO), ZERO) }
}

export const fmtN = (n: Nutrients) => `약 ${Math.round(n.kcal)} kcal · 단백질 ${Math.round(n.proteinG)} g · 지방 ${Math.round(n.fatG)} g`
