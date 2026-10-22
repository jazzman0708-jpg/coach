// 식재료 영양성분 (가식부 100 g당). 출처: 농촌진흥청 국가표준식품성분 DB (공공누리 제1유형, 출처표시)
// 값이 없는 식품은 식약처 식품영양성분 DB. 식품마다 source에 실제 항목명을 적는다.

export const FOOD_IDS = [
  'spaghetti_dry',
  'shrimp',
  'egg',
  'egg_boiled',
  'olive_oil',
  'garlic',
  'milk',
  'greek_yogurt',
  'beef_brisket_thin',
  'cabbage',
  'onion',
  'green_onion',
  'soy_sauce',
  'soup_soy_sauce',
  'saury_canned',
  'radish',
  'tofu',
  'red_pepper_powder',
  'beef_brisket',
  'sesame_oil',
  'pork_shoulder',
  'kimchi',
  'chicken_breast',
  'carrot',
  'potato',
  'curry_roux',
  'beef_tenderloin',
  'multigrain_rice',
  'mushroom',
] as const

export type FoodId = (typeof FOOD_IDS)[number]

export type FoodUnit = 'g' | '개' | '쪽' | '큰술' | '작은술' | '모' | '컵' | '공기' | '대'

export interface Food {
  id: FoodId
  name: string
  /** 냉장고 재료 이름과 맞춰 보는 말 */
  aliases: string[]
  per100g: { kcal: number; proteinG: number; fatG: number; carbG: number; sodiumMg: number }
  /** 출처 DB의 실제 항목명·코드 */
  source: string
  /** 오래 보관되는 채소 (메뉴 생성 선호) */
  keepsLong?: boolean
}

const RDA = '농촌진흥청 국가표준식품성분 DB 10.4'
const f = (
  id: FoodId,
  name: string,
  aliases: string[],
  v: [kcal: number, proteinG: number, fatG: number, carbG: number, sodiumMg: number],
  source: string,
  keepsLong?: boolean,
): Food => ({ id, name, aliases, per100g: { kcal: v[0], proteinG: v[1], fatG: v[2], carbG: v[3], sodiumMg: v[4] }, source, keepsLong })

const list: Food[] = [
  f('spaghetti_dry', '스파게티면(건면)', ['스파게티', '파스타'], [380, 12.64, 1.47, 74.52, 6], `${RDA} · 스파게티면, 말린것 (A0240020001a)`),
  f('shrimp', '새우', ['새우'], [98, 21.17, 0.89, 0, 122], `${RDA} · 새우, 흰다리새우, 생것 (K6130180000a)`),
  f('egg', '달걀', ['달걀', '계란'], [140, 12.86, 8.51, 1.07, 137], `${RDA} · 달걀, 생것 (J0030000000a)`),
  f('egg_boiled', '삶은 달걀', ['달걀', '계란'], [145, 13.49, 8.69, 1.37, 128], `${RDA} · 달걀, 삶은것 (J0030000009b)`),
  f('olive_oil', '올리브유', ['올리브유', '올리브 오일'], [921, 0, 100, 0, 0], `${RDA} · 올리브유 (N0170000009a)`),
  f('garlic', '마늘', ['마늘'], [128, 7.45, 0.16, 26.42, 3], `${RDA} · 마늘, 생것 (F053000B060a)`, true),
  f('milk', '우유', ['우유'], [67, 3.09, 3.85, 4.86, 40], `${RDA} · 우유 (M0090000009a)`),
  f('greek_yogurt', '그릭요거트', ['요거트', '요구르트'], [86, 4.53, 3.21, 9.69, 56], `${RDA} · 요구르트, 호상, 플레인 (M0080042339a) — 그릭요거트 항목이 없어 가장 가까운 값. 실제 그릭요거트는 단백질이 더 많을 수 있음`),
  f('beef_brisket_thin', '우삼겹', ['우삼겹', '차돌'], [408, 16.45, 35.94, 0, 66], `${RDA} · 소고기, 한우(1등급), 양지(차돌박이), 생것 (I027006F030a) — 우삼겹 항목이 없어 대신 사용`),
  f('cabbage', '양배추', ['양배추'], [29, 1.36, 0.12, 6.98, 9], `${RDA} · 양배추, 생것 (F1290000000a)`, true),
  f('onion', '양파', ['양파'], [29, 0.96, 0.17, 6.52, 2], `${RDA} · 양파, 생것 (F1320000000a)`, true),
  f('green_onion', '대파', ['대파', '파'], [23, 1.78, 0.15, 4.8, 0], `${RDA} · 파, 대파, 생것 (F1910040000a)`),
  f('soy_sauce', '진간장', ['간장', '진간장'], [103, 9.15, 0, 16.54, 4783], `${RDA} · 간장, 개량, 양조 (R0010010009a)`),
  f('soup_soy_sauce', '국간장', ['국간장'], [34, 5.92, 0.03, 2.47, 7999], `${RDA} · 간장, 재래 (R0010030009a)`),
  f('saury_canned', '꽁치 통조림', ['꽁치'], [113, 13.12, 6.76, 0, 262], `${RDA} · 꽁치, 통조림 (K023000000Ra)`, true),
  f('radish', '무', ['무'], [21, 0.77, 0.15, 4.72, 13], `${RDA} · 무, 조선무, 생것 (F065002B090a)`, true),
  f('tofu', '두부', ['두부'], [97, 9.62, 4.63, 3.75, 1], `${RDA} · 두부 (D0150000009a)`),
  f('red_pepper_powder', '고춧가루', ['고춧가루'], [319, 13.29, 8.4, 60.62, 13], `${RDA} · 고춧가루 (R0070000005a)`, true),
  f('beef_brisket', '소고기 양지(국거리)', ['양지', '국거리'], [253, 18.58, 18.59, 0, 55], `${RDA} · 소고기, 한우, 양지, 생것 (I027003D280a)`),
  f('sesame_oil', '참기름', ['참기름'], [920, 0, 99.84, 0.13, 0], `${RDA} · 참기름 (N0200000009a)`),
  f('pork_shoulder', '돼지고기 앞다리살', ['앞다리', '돼지고기'], [161, 20.56, 7.92, 0, 50], `${RDA} · 돼지고기, 앞다리(앞다리살), 생것 (I014000D770a)`),
  f('kimchi', '배추김치', ['김치'], [38, 1.98, 0.43, 6.49, 551], `${RDA} · 김치, 배추 김치 (F2050070009a)`, true),
  f('chicken_breast', '닭가슴살', ['닭가슴살', '닭가슴'], [106, 22.97, 0.97, 0, 45], `${RDA} · 닭고기, 가슴, 생것 (I008000D020a)`),
  f('carrot', '당근', ['당근'], [31, 1.02, 0.13, 7.03, 23], `${RDA} · 당근, 뿌리, 생것 (F041000B090a)`, true),
  f('potato', '감자', ['감자'], [70, 1.93, 0.03, 16.07, 1], `${RDA} · 감자, 수미, 생것 (B0010140000a)`, true),
  f('curry_roux', '카레', ['카레'], [425, 8.38, 18.69, 55.76, 4059], `${RDA} · 카레 소스, 가루 (R0340000005a) — 고형 카레 항목이 없어 대신 사용`, true),
  f('beef_tenderloin', '소고기 안심', ['안심'], [205, 19.17, 13.14, 0, 45], `${RDA} · 소고기, 한우(1등급), 안심, 생것 (I027006D200a)`),
  f('multigrain_rice', '잡곡밥', ['잡곡밥', '밥'], [150, 2.83, 0.38, 33.76, 159], `${RDA} · 즉석밥, 잡곡밥 (A0140002209a)`),
  f('mushroom', '양송이버섯', ['양송이', '버섯'], [15, 3.12, 0.23, 3.89, 5], `${RDA} · 양송이버섯, 생것 (G0180000000a)`),
]

export const FOODS = Object.fromEntries(list.map((x) => [x.id, x])) as Record<FoodId, Food>

/**
 * 단위 1개의 무게(g). 밥 1공기 210 g만 공식 값(농식품올바로 단위별 분량, 밥 3교환)이고,
 * 나머지는 공식 단위 무게를 찾지 못해 앱이 정한 추정값이다 (큰술 15 mL·작은술 5 mL × 밀도).
 */
export const UNIT_GRAMS: Partial<Record<FoodId, Partial<Record<FoodUnit, number>>>> = {
  egg: { 개: 50 },
  egg_boiled: { 개: 50 },
  garlic: { 쪽: 5 },
  olive_oil: { 큰술: 13.7, 작은술: 4.6 },
  soy_sauce: { 큰술: 18 },
  soup_soy_sauce: { 큰술: 18 },
  red_pepper_powder: { 큰술: 6 },
  sesame_oil: { 작은술: 4.6 },
  tofu: { 모: 300 },
  onion: { 개: 200 },
  carrot: { 개: 200 },
  potato: { 개: 150 },
  milk: { 컵: 206 },
  multigrain_rice: { 공기: 210 },
}

export const unitGrams = (food: FoodId, unit: string): number | undefined => UNIT_GRAMS[food]?.[unit as FoodUnit]
