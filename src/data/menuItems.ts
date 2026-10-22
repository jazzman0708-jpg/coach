import type { FoodId, FoodUnit } from './foods'

// 메뉴 1인분의 재료와 분량 (영양 계산용). 레시피 화면의 재료와 같은 분량이다.
// '약간'으로 쓴 재료(대파·소금·후추 등)는 10 g 이하라 대파만 10 g으로 넣고 나머지는 뺀다.

export interface MenuItem {
  food: FoodId
  amount: number
  unit: FoodUnit
}

export interface MenuDef {
  id: string
  /** 메뉴 문구에 이 말이 들어 있으면 이 정의를 쓴다 */
  match: string[]
  items: MenuItem[]
  /** 둘째 끼처럼 잡곡밥 1공기를 곁들이는 메뉴 (술 마시는 날은 밥 없이) */
  withRice?: boolean
}

export const MENU_DEFS: MenuDef[] = [
  {
    id: 'aglio_olio',
    match: ['알리오 올리오'],
    items: [
      { food: 'spaghetti_dry', amount: 80, unit: 'g' },
      { food: 'shrimp', amount: 150, unit: 'g' },
      { food: 'garlic', amount: 4, unit: '쪽' },
      { food: 'olive_oil', amount: 1, unit: '큰술' },
      { food: 'egg_boiled', amount: 1, unit: '개' },
    ],
  },
  {
    id: 'post_workout',
    match: ['삶은 계란'],
    items: [
      { food: 'milk', amount: 1.5, unit: '컵' },
      { food: 'egg_boiled', amount: 2, unit: '개' },
    ],
  },
  {
    id: 'greek_yogurt',
    match: ['그릭요거트'],
    items: [{ food: 'greek_yogurt', amount: 150, unit: 'g' }],
  },
  {
    id: 'beef_cabbage',
    match: ['양배추 볶음'],
    withRice: true,
    items: [
      { food: 'beef_brisket_thin', amount: 100, unit: 'g' },
      { food: 'cabbage', amount: 200, unit: 'g' },
      { food: 'onion', amount: 0.25, unit: '개' },
      { food: 'green_onion', amount: 10, unit: 'g' },
      { food: 'soy_sauce', amount: 1, unit: '큰술' },
      { food: 'garlic', amount: 1, unit: '쪽' },
    ],
  },
  {
    id: 'saury_radish',
    match: ['꽁치'],
    withRice: true,
    items: [
      { food: 'saury_canned', amount: 150, unit: 'g' },
      { food: 'radish', amount: 150, unit: 'g' },
      { food: 'tofu', amount: 0.5, unit: '모' },
      { food: 'onion', amount: 0.25, unit: '개' },
      { food: 'soy_sauce', amount: 1, unit: '큰술' },
      { food: 'red_pepper_powder', amount: 1, unit: '큰술' },
      { food: 'garlic', amount: 1, unit: '쪽' },
    ],
  },
  {
    id: 'beef_radish_soup',
    match: ['무국'],
    withRice: true,
    items: [
      { food: 'beef_brisket', amount: 100, unit: 'g' },
      { food: 'radish', amount: 150, unit: 'g' },
      { food: 'tofu', amount: 0.5, unit: '모' },
      { food: 'soup_soy_sauce', amount: 1, unit: '큰술' },
      { food: 'garlic', amount: 1, unit: '쪽' },
      { food: 'sesame_oil', amount: 1, unit: '작은술' },
      { food: 'green_onion', amount: 10, unit: 'g' },
    ],
  },
  {
    id: 'kimchi_stew',
    match: ['김치찌개'],
    withRice: true,
    items: [
      { food: 'pork_shoulder', amount: 100, unit: 'g' },
      { food: 'kimchi', amount: 150, unit: 'g' },
      { food: 'tofu', amount: 0.5, unit: '모' },
      { food: 'onion', amount: 0.25, unit: '개' },
      { food: 'green_onion', amount: 10, unit: 'g' },
      { food: 'red_pepper_powder', amount: 1 / 3, unit: '큰술' },
      { food: 'garlic', amount: 1, unit: '쪽' },
    ],
  },
  {
    id: 'chicken_curry',
    match: ['카레'],
    withRice: true,
    items: [
      { food: 'chicken_breast', amount: 150, unit: 'g' },
      { food: 'onion', amount: 0.5, unit: '개' },
      { food: 'carrot', amount: 1 / 3, unit: '개' },
      { food: 'potato', amount: 0.5, unit: '개' },
      { food: 'curry_roux', amount: 20, unit: 'g' },
    ],
  },
  {
    id: 'beef_tofu_kimchi',
    match: ['두부김치'],
    withRice: true,
    items: [
      { food: 'beef_brisket_thin', amount: 100, unit: 'g' },
      { food: 'kimchi', amount: 150, unit: 'g' },
      { food: 'tofu', amount: 0.5, unit: '모' },
      { food: 'onion', amount: 0.25, unit: '개' },
      { food: 'green_onion', amount: 10, unit: 'g' },
      { food: 'sesame_oil', amount: 1, unit: '작은술' },
    ],
  },
  {
    id: 'tenderloin_steak',
    match: ['스테이크'],
    withRice: true,
    items: [
      { food: 'beef_tenderloin', amount: 175, unit: 'g' },
      { food: 'olive_oil', amount: 1, unit: '작은술' },
      { food: 'garlic', amount: 3, unit: '쪽' },
      { food: 'mushroom', amount: 50, unit: 'g' },
      { food: 'onion', amount: 0.25, unit: '개' },
    ],
  },
]

export function findMenuDef(menuText: string): MenuDef | undefined {
  return MENU_DEFS.find((m) => m.match.some((k) => menuText.includes(k)))
}
