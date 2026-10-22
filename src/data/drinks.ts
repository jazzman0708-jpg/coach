import type { CardioKind, DrinkPreset, EvidenceRef } from '../engine/types'

// 주종 프리셋. 용량·도수는 흔한 제품 기준이며, 마신 제품과 다르면 기록 화면에서 고른 개수로 조정한다.
export const DRINKS: DrinkPreset[] = [
  { id: 'soju_bottle', name: '소주 1병 (360 mL, 16.5%)', ml: 360, abvPct: 16.5 },
  { id: 'soju_glass', name: '소주 1잔 (50 mL)', ml: 50, abvPct: 16.5 },
  { id: 'beer_500', name: '생맥주 500 mL (4.5%)', ml: 500, abvPct: 4.5 },
  { id: 'beer_can', name: '맥주 캔 355 mL (4.5%)', ml: 355, abvPct: 4.5 },
  { id: 'wine_glass', name: '와인 1잔 (150 mL, 12.5%)', ml: 150, abvPct: 12.5 },
  { id: 'makgeolli_bottle', name: '막걸리 1병 (750 mL, 6%)', ml: 750, abvPct: 6 },
  { id: 'highball', name: '하이볼 1잔 (350 mL, 7%)', ml: 350, abvPct: 7 },
  { id: 'whisky_shot', name: '위스키 1샷 (30 mL, 40%)', ml: 30, abvPct: 40 },
]

export const DRINK_BY_ID: Record<string, DrinkPreset> = Object.fromEntries(DRINKS.map((d) => [d.id, d]))

export interface CardioType {
  kind: CardioKind
  name: string
  met: number
  ref: EvidenceRef
}

// MET 값: 2024 Adult Compendium (결정 D4)
export const CARDIO_TYPES: CardioType[] = [
  { kind: 'walk_moderate', name: '걷기 (시속 4.5~5.5 km)', met: 3.8, ref: 'compendium2024#walk_moderate' },
  { kind: 'walk_brisk', name: '빠르게 걷기 (시속 5.6~6.3 km)', met: 4.8, ref: 'compendium2024#walk_brisk' },
  { kind: 'cycling_leisure', name: '자전거 느리게 (시속 16 km 미만)', met: 4.0, ref: 'compendium2024#cycling_leisure' },
  { kind: 'cycling_light', name: '자전거 (시속 16~19 km)', met: 6.8, ref: 'compendium2024#cycling_light' },
  { kind: 'cycling_moderate', name: '자전거 빠르게 (시속 19~22 km)', met: 8.0, ref: 'compendium2024#cycling_moderate' },
]

export const CARDIO_BY_KIND = Object.fromEntries(CARDIO_TYPES.map((c) => [c.kind, c])) as Record<CardioKind, CardioType>
