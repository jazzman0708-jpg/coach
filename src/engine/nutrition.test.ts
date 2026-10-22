import { describe, expect, it } from 'vitest'
import { FOOD_IDS, type Food, type FoodId, type FoodUnit } from '../data/foods'
import { INITIAL_PROGRAM } from '../data/initialProgram'
import { MENU_DEFS, findMenuDef } from '../data/menuItems'
import { type FoodTable, dayPlan, eatenToday, itemsNutrition, menuNutrition } from './nutrition'
import { checkDinner, shoppingList } from './shopping'

// 계산 로직만 검사하는 가짜 표: 모든 식품 100 g당 100 kcal, 단백질 10 g
const fake = Object.fromEntries(
  FOOD_IDS.map((id) => [id, { id, name: id, aliases: [id === 'cabbage' ? '양배추' : id], per100g: { kcal: 100, proteinG: 10, fatG: 5, carbG: 10, sodiumMg: 100 }, source: 'test' }]),
) as Record<FoodId, Food>
const units: Partial<Record<FoodUnit, number>> = { 개: 50, 쪽: 5, 큰술: 10, 작은술: 4, 모: 300, 컵: 200, 공기: 210, 대: 40 }
const table: FoodTable = { foods: fake, unitGrams: (_f, u) => units[u] }

describe('메뉴 영양 계산', () => {
  it('g과 단위(개·큰술 등)를 g으로 바꿔 더한다', () => {
    const n = itemsNutrition(
      [
        { food: 'egg_boiled', amount: 2, unit: '개' },
        { food: 'olive_oil', amount: 1, unit: '큰술' },
        { food: 'shrimp', amount: 150, unit: 'g' },
      ],
      table,
    )
    expect(n.kcal).toBe(260) // (100 + 10 + 150) g × 1 kcal/g
    expect(n.proteinG).toBe(26)
  })

  it('밥을 곁들이는 메뉴는 잡곡밥 1공기를 더하고, 술 마신 날은 뺀다', () => {
    const def = findMenuDef('우삼겹 양배추 볶음')
    const withRice = menuNutrition(def, table)!.kcal
    const noRice = menuNutrition(def, table, { noRice: true })!.kcal
    expect(withRice - noRice).toBeCloseTo(210, 5)
  })

  it('초기 프로그램의 모든 메뉴에 영양 정의가 있다', () => {
    for (const wd of [0, 1, 2, 3, 4, 5, 6] as const) {
      const plan = dayPlan(INITIAL_PROGRAM, wd, findMenuDef, table)
      expect(plan.slots.filter((s) => !s.nutrients).map((s) => s.menu)).toEqual([])
    }
    expect(MENU_DEFS.length).toBeGreaterThan(5)
  })

  it('먹은 양: 계획대로는 메뉴 값, 다른 거는 입력값, 안 먹음은 0, 술 칼로리는 더한다', () => {
    const plan = dayPlan(INITIAL_PROGRAM, 4, findMenuDef, table)
    const meal1 = plan.slots.find((s) => s.slot === 'meal1')!.nutrients!
    const eaten = eatenToday(
      plan,
      [
        { id: '1', date: 'd', slot: 'meal1', status: 'as_planned', at: '' },
        { id: '2', date: 'd', slot: 'meal2', status: 'different', kcal: 600, proteinG: 30, at: '' },
        { id: '3', date: 'd', slot: 'snack', status: 'skipped', at: '' },
      ],
      300,
    )
    expect(eaten.kcal).toBe(Math.round(meal1.kcal + 600 + 300))
    expect(eaten.proteinG).toBe(Math.round(meal1.proteinG + 30))
  })
})

describe('장보기·AI 메뉴 점검', () => {
  it('필요한 양에서 냉장고 재료를 빼고 살 것만 남긴다', () => {
    const lines = shoppingList(
      [
        { date: 'a', name: 'x', ingredients: [{ food: 'cabbage', grams: 200 }, { food: 'tofu', grams: 150 }], seasonings: [], steps: [] },
        { date: 'b', name: 'y', ingredients: [{ food: 'cabbage', grams: 300 }], seasonings: [], steps: [] },
      ],
      [{ id: 'p', name: '양배추', qty: 1, unit: '개', updatedAt: '' }],
      fake,
      (_f, u) => (u === '개' ? 400 : undefined),
    )
    expect(lines.find((l) => l.food === 'cabbage')).toMatchObject({ needG: 500, haveG: 400, buyG: 100 })
    expect(lines.find((l) => l.food === 'tofu')).toMatchObject({ buyG: 150 })
  })

  it('AI 메뉴가 목표에서 벗어나면 이유를 알려 준다', () => {
    const target = { kcal: 900, proteinG: 40, fatG: 20 }
    expect(checkDinner({ kcal: 900, proteinG: 42, fatG: 18, carbG: 0, sodiumMg: 0 }, target).ok).toBe(true)
    expect(checkDinner({ kcal: 1200, proteinG: 30, fatG: 30, carbG: 0, sodiumMg: 0 }, target).issues).toHaveLength(3)
  })
})
