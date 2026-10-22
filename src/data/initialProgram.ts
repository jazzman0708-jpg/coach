import type { ProgramVersion, Settings } from '../engine/types'
import { pref, userDecision } from './rules'

// 요청서의 초기 프로그램 (2026-10-22 시작). 이후 변경은 코치의 제안 → 승인으로만 바뀐다.
export const INITIAL_PROGRAM: ProgramVersion = {
  version: 1,
  effectiveFrom: '2026-10-22',
  strengthDays: [1, 3, 5],
  slots: [
    { pattern: 'vertical_pull', exerciseId: 'dead_hang', sets: 3, target: 20, restSec: 60 },
    { pattern: 'horizontal_pull', exerciseId: 'table_row_bent', sets: 3, target: 10, restSec: 90 },
    { pattern: 'horizontal_push', exerciseId: 'sink_pushup', sets: 3, target: 8, restSec: 90 },
    { pattern: 'core_anti_extension', exerciseId: 'knee_rollout_wall', sets: 3, target: 3, restSec: 90 },
    { pattern: 'lower', exerciseId: 'bodyweight_squat', sets: 3, target: 10, restSec: 90 },
  ],
  cardio: { kind: 'walk_brisk', minutes: 20, days: [2, 4, 6] },
  nutrition: {
    kcal: 2100,
    proteinG: 120,
    fatG: 60,
    basis: userDecision('요청서의 시작 목표. 4단계 식단 엔진이 기록으로 다시 계산해 제안한다'),
  },
  meals: [
    {
      slot: 'meal1',
      default: '알리오 올리오 — 스파게티면 80 g + 새우 150 g + 반숙 계란 1개, 올리브유 1큰술',
    },
    { slot: 'post_workout', default: '우유 300 mL + 삶은 계란 2개' },
    {
      slot: 'meal2',
      default: '잡곡밥 + 단백질 반찬',
      byWeekday: {
        1: '우삼겹 양배추 볶음',
        2: '꽁치 무조림 + 두부',
        3: '소고기 무국 + 두부',
        4: '돼지고기 두부 김치찌개',
        5: '닭가슴살 카레',
        6: '우삼겹 두부김치',
        0: '소고기 안심 스테이크',
      },
      note: '밥은 잡곡밥. 술 마시는 날은 밥 없이.',
    },
    { slot: 'snack', default: '그릭요거트 150 g' },
  ],
  drinkingGoal: {
    maxOccasionsPerWeek: 1,
    maxPerOccasion: { drinkId: 'soju_bottle', count: 1 },
    basis: pref('첫 실행 때 정한 내 음주 목표 (설정에서 바꿀 수 있음)'),
  },
  note: '요청서 초기 프로그램',
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'singleton',
  profile: { sex: 'male' },
  equipment: ['pullup_bar', 'ab_roller', 'bicycle', 'wall', 'sink', 'chair', 'sturdy_table'],
  schedule: {
    wake: '07:00',
    meal1: '12:30',
    workout: '14:30',
    postWorkout: '15:00',
    meal2: '19:00',
    snack: '21:00',
    bed: '23:00',
  },
  dayBoundaryHour: 5,
  sound: true,
  vibration: true,
}
