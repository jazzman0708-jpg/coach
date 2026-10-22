import type { Food, FoodId } from '../data/foods'
import type { Nutrients } from './nutrition'
import type { AiDinner, PantryItem } from './types'

// 장보기 목록: 이번 주 메뉴에 필요한 식재료 g − 냉장고에 있는 양. 냉장고 재료는 이름(별칭)으로 맞춘다.

export interface ShoppingLine {
  food: FoodId
  name: string
  needG: number
  haveG: number
  buyG: number
}

function pantryGrams(food: Food, pantry: PantryItem[], unitGrams: (unit: string) => number | undefined): number {
  return pantry
    .filter((p) => food.aliases.some((a) => p.name.includes(a)) || p.name.includes(food.name))
    .reduce((sum, p) => {
      if (p.unit === 'g' || p.unit === 'mL') return sum + p.qty
      const g = unitGrams(p.unit)
      return g ? sum + p.qty * g : sum
    }, 0)
}

export function shoppingList(
  dinners: AiDinner[],
  pantry: PantryItem[],
  foods: Record<FoodId, Food>,
  unitGrams: (food: FoodId, unit: string) => number | undefined,
): ShoppingLine[] {
  const need = new Map<FoodId, number>()
  for (const d of dinners) for (const i of d.ingredients) need.set(i.food as FoodId, (need.get(i.food as FoodId) ?? 0) + i.grams)
  return [...need.entries()]
    .map(([id, needG]) => {
      const food = foods[id]
      const haveG = pantryGrams(food, pantry, (u) => unitGrams(id, u))
      return { food: id, name: food.name, needG: Math.round(needG), haveG: Math.round(haveG), buyG: Math.max(0, Math.round(needG - haveG)) }
    })
    .sort((a, b) => b.buyG - a.buyG)
}

export interface DinnerCheck {
  ok: boolean
  issues: string[]
}

/**
 * AI가 만든 저녁의 영양을 앱이 다시 계산해 목표와 비교한다.
 * 허용 폭(칼로리 ±15%, 단백질 목표 −5 g, 지방 +5 g)은 화면 표시용 앱 동작 값이다.
 */
export function checkDinner(n: Nutrients, target: { kcal: number; proteinG: number; fatG: number }): DinnerCheck {
  const issues: string[] = []
  if (n.kcal > target.kcal * 1.15) issues.push(`칼로리 많음 (${Math.round(n.kcal)} / ${target.kcal})`)
  if (n.kcal < target.kcal * 0.85) issues.push(`칼로리 적음 (${Math.round(n.kcal)} / ${target.kcal})`)
  if (n.proteinG < target.proteinG - 5) issues.push(`단백질 부족 (${Math.round(n.proteinG)} / ${target.proteinG} g)`)
  if (n.fatG > target.fatG + 5) issues.push(`지방 많음 (${Math.round(n.fatG)} / ${target.fatG} g)`)
  return { ok: issues.length === 0, issues }
}
