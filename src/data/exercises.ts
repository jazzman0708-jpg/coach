import type { Exercise, Ladder } from '../engine/types'
import { ev, evx, needs, userDecision } from './rules'

const ACSM_RANGE = { range: { min: 8, max: 12 }, rangeBasis: ev('acsm2009#novice') }
const HOLD_RANGE = {
  range: { min: 20, max: 60 },
  rangeBasis: needs('버티기(등척성) 종목의 시간 범위 근거가 없습니다. 20~60초로 표시만 하고 자동 상향은 하지 않습니다.'),
}
const ROLLOUT_RANGE = { range: { min: 3, max: 6 }, rangeBasis: userDecision('요청서의 롤아웃 3~6회를 사용 (결정 D2)') }

const list: Exercise[] = [
  // ── 수직 당기기 ──
  {
    id: 'dead_hang', name: '매달리기', pattern: 'vertical_pull',
    primary: [], secondary: ['back', 'arms'], equipment: ['pullup_bar'], metric: 'seconds', ...HOLD_RANGE, restSec: 60,
    cues: ['어깨를 귀에서 살짝 멀리 끌어내린 상태 유지', '몸이 흔들리지 않게 발을 모으기'],
  },
  {
    id: 'scapular_pullup', name: '스캐풀러 풀업', pattern: 'vertical_pull',
    primary: ['back'], secondary: ['delt_rear'], equipment: ['pullup_bar'], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['팔은 편 채로 날개뼈만 아래로 당겨 몸을 2~3 cm 올리기', '내려올 때도 천천히'],
  },
  {
    id: 'negative_pullup', name: '네거티브 풀업', pattern: 'vertical_pull',
    primary: ['back'], secondary: ['arms', 'delt_rear'], equipment: ['pullup_bar', 'chair'], metric: 'reps',
    range: { min: 3, max: 6 },
    rangeBasis: needs('네거티브 풀업의 반복 범위 근거가 없습니다. 3~6회로 표시만 합니다.'),
    restSec: 120,
    cues: ['의자를 딛고 턱을 바 위로 올린 뒤 시작', '3~5초에 걸쳐 천천히 내려오기'],
    safety: ['의자가 미끄러지지 않는지 확인'],
  },
  {
    id: 'band_pullup', name: '밴드 보조 턱걸이', pattern: 'vertical_pull',
    primary: ['back'], secondary: ['arms', 'delt_rear'], equipment: ['pullup_bar', 'band'], metric: 'reps', ...ACSM_RANGE, restSec: 120,
    cues: ['밴드를 바에 걸고 무릎이나 발을 밴드에 올리기', '가슴을 바 쪽으로 끌어올리기'],
    safety: ['밴드가 바에 단단히 걸렸는지 확인'],
  },
  {
    id: 'pullup', name: '턱걸이', pattern: 'vertical_pull',
    primary: ['back'], secondary: ['arms', 'delt_rear'], equipment: ['pullup_bar'], metric: 'reps', ...ACSM_RANGE, restSec: 120,
    cues: ['매달린 상태에서 날개뼈를 먼저 끌어내리고 시작', '턱이 바 위로 올라갈 때까지'],
  },
  {
    id: 'weighted_pullup', name: '중량 턱걸이', pattern: 'vertical_pull',
    primary: ['back'], secondary: ['arms', 'delt_rear'], equipment: ['pullup_bar', 'weight_vest'], metric: 'reps_load', ...ACSM_RANGE, restSec: 120,
    cues: ['맨몸 턱걸이와 같은 자세 유지'],
  },

  // ── 수평 당기기 ──
  {
    id: 'table_row_bent', name: '식탁 로우 (무릎 굽힘)', pattern: 'horizontal_pull',
    primary: ['back'], secondary: ['delt_rear', 'arms'], equipment: ['sturdy_table'], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['식탁 아래 누워 모서리를 어깨너비로 잡기', '무릎을 굽히고 엉덩이~어깨를 일자로', '가슴을 식탁 모서리 쪽으로 당기기'],
    safety: ['식탁이 체중을 버티고, 당길 때 들리거나 밀리지 않는지 먼저 확인', '모서리를 잡을 때 손가락 끼임 주의'],
  },
  {
    id: 'table_row', name: '식탁 로우 (다리 펴기)', pattern: 'horizontal_pull',
    primary: ['back'], secondary: ['delt_rear', 'arms'], equipment: ['sturdy_table'], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['다리를 펴고 발뒤꿈치~머리를 일자로', '가슴을 모서리 쪽으로 당기기'],
    safety: ['식탁이 체중을 버티고, 당길 때 들리거나 밀리지 않는지 먼저 확인'],
  },
  {
    id: 'table_row_elevated', name: '발 올린 식탁 로우', pattern: 'horizontal_pull',
    primary: ['back'], secondary: ['delt_rear', 'arms'], equipment: ['sturdy_table', 'chair'], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['발을 의자에 올려 몸을 수평에 가깝게', '가슴을 모서리 쪽으로 당기기'],
    safety: ['식탁이 체중을 버티고, 당길 때 들리거나 밀리지 않는지 먼저 확인'],
  },
  {
    id: 'band_row', name: '밴드 로우', pattern: 'horizontal_pull',
    primary: ['back'], secondary: ['delt_rear', 'arms'], equipment: ['band'], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['밴드를 발이나 문고리에 걸고 팔꿈치를 뒤로 당기기', '날개뼈를 모으며 마무리'],
  },
  {
    id: 'dumbbell_row', name: '덤벨 로우', pattern: 'horizontal_pull',
    primary: ['back'], secondary: ['delt_rear', 'arms'], equipment: ['dumbbell', 'chair'], metric: 'reps_load', ...ACSM_RANGE, restSec: 90,
    cues: ['한 손과 무릎을 의자에 대고 등은 평평하게', '덤벨을 골반 쪽으로 당기기'],
  },

  // ── 수평 밀기 ──
  {
    id: 'wall_pushup', name: '벽 푸쉬업', pattern: 'horizontal_push',
    primary: ['chest'], secondary: ['delt_front', 'arms'], equipment: ['wall'], metric: 'reps', ...ACSM_RANGE, restSec: 60,
    cues: ['손을 어깨 높이·어깨너비보다 조금 넓게', '몸을 일자로 유지'],
  },
  {
    id: 'sink_pushup', name: '싱크대 푸쉬업', pattern: 'horizontal_push',
    primary: ['chest'], secondary: ['delt_front', 'arms'], equipment: ['sink'], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['싱크대 모서리를 어깨너비보다 조금 넓게 잡기', '가슴이 모서리에 닿을 만큼 내려가기', '엉덩이가 처지지 않게'],
    safety: ['바닥이 미끄럽지 않은지 확인'],
  },
  {
    id: 'desk_pushup', name: '책상 푸쉬업', pattern: 'horizontal_push',
    primary: ['chest'], secondary: ['delt_front', 'arms'], equipment: ['sturdy_table'], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['책상 모서리를 잡고 몸을 일자로', '가슴이 모서리에 닿을 만큼 내려가기'],
    safety: ['책상이 밀리지 않게 벽에 붙이기'],
  },
  {
    id: 'chair_pushup', name: '의자 푸쉬업', pattern: 'horizontal_push',
    primary: ['chest'], secondary: ['delt_front', 'arms'], equipment: ['chair'], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['의자 좌판 양 끝을 잡기', '몸을 일자로 유지'],
    safety: ['의자를 벽에 붙여 밀리지 않게'],
  },
  {
    id: 'floor_pushup', name: '푸쉬업', pattern: 'horizontal_push',
    primary: ['chest'], secondary: ['delt_front', 'arms'], equipment: [], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['손은 어깨너비보다 조금 넓게', '가슴이 바닥 가까이 갈 때까지', '팔꿈치는 몸통에서 45도 정도'],
  },
  {
    id: 'decline_pushup', name: '발 올린 푸쉬업', pattern: 'horizontal_push',
    primary: ['chest'], secondary: ['delt_front', 'arms'], equipment: ['chair'], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['발을 의자에 올리고 몸을 일자로', '허리가 꺾이지 않게 배에 힘'],
  },

  // ── 수직 밀기 ──
  {
    id: 'incline_pike_pushup', name: '손 올린 파이크 푸쉬업', pattern: 'vertical_push',
    primary: ['delt_front'], secondary: ['delt_side', 'arms'], equipment: ['chair'], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['손을 의자에 짚고 엉덩이를 높이 들어 ㅅ자', '정수리가 손 사이 앞쪽으로 내려가게'],
    safety: ['의자를 벽에 붙여 밀리지 않게'],
  },
  {
    id: 'pike_pushup', name: '파이크 푸쉬업', pattern: 'vertical_push',
    primary: ['delt_front'], secondary: ['delt_side', 'arms'], equipment: [], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['엉덩이를 높이 들어 ㅅ자', '정수리가 손 사이 앞쪽 바닥으로 내려가게'],
  },
  {
    id: 'elevated_pike_pushup', name: '발 올린 파이크 푸쉬업', pattern: 'vertical_push',
    primary: ['delt_front'], secondary: ['delt_side', 'arms'], equipment: ['chair'], metric: 'reps', ...ACSM_RANGE, restSec: 120,
    cues: ['발을 의자에 올리고 상체를 세로에 가깝게', '정수리가 손 앞쪽으로 내려가게'],
  },
  {
    id: 'wall_hspu_partial', name: '벽 물구나무 푸쉬업 (부분 범위)', pattern: 'vertical_push',
    primary: ['delt_front'], secondary: ['delt_side', 'arms'], equipment: ['wall'], metric: 'reps', ...ACSM_RANGE, restSec: 120,
    cues: ['벽을 보고 물구나무, 머리 아래 쿠션을 높게 두고 그 높이까지만'],
    safety: ['머리에 체중을 싣지 않기', '목이나 어깨에 찌릿함이 있으면 중단'],
  },
  {
    id: 'wall_hspu', name: '벽 물구나무 푸쉬업', pattern: 'vertical_push',
    primary: ['delt_front'], secondary: ['delt_side', 'arms'], equipment: ['wall'], metric: 'reps', ...ACSM_RANGE, restSec: 120,
    cues: ['정수리가 쿠션에 가볍게 닿을 때까지'],
    safety: ['머리에 체중을 싣지 않기', '목이나 어깨에 찌릿함이 있으면 중단'],
  },
  {
    id: 'band_press', name: '밴드 숄더 프레스', pattern: 'vertical_push',
    primary: ['delt_front', 'delt_side'], secondary: ['arms'], equipment: ['band'], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['밴드를 발로 밟고 귀 옆에서 머리 위로 밀기', '허리가 꺾이지 않게'],
  },
  {
    id: 'dumbbell_press', name: '덤벨 숄더 프레스', pattern: 'vertical_push',
    primary: ['delt_front', 'delt_side'], secondary: ['arms'], equipment: ['dumbbell'], metric: 'reps_load', ...ACSM_RANGE, restSec: 120,
    cues: ['덤벨을 귀 옆에서 머리 위로 밀기', '허리가 꺾이지 않게 배에 힘'],
  },

  // ── 어깨 측면 ──
  {
    id: 'band_lateral_raise', name: '밴드 레터럴 레이즈', pattern: 'lateral_delt',
    primary: ['delt_side'], equipment: ['band'], metric: 'reps', ...ACSM_RANGE, restSec: 60,
    cues: ['밴드를 발로 밟고 팔꿈치를 살짝 굽힌 채 옆으로 어깨 높이까지', '어깨가 귀 쪽으로 올라가지 않게'],
  },
  {
    id: 'dumbbell_lateral_raise', name: '덤벨 레터럴 레이즈', pattern: 'lateral_delt',
    primary: ['delt_side'], equipment: ['dumbbell'], metric: 'reps_load', ...ACSM_RANGE, restSec: 60,
    cues: ['팔꿈치를 살짝 굽힌 채 옆으로 어깨 높이까지', '반동 없이 천천히 내리기'],
  },

  // ── 코어 (안티 익스텐션) ──
  {
    id: 'plank', name: '플랭크', pattern: 'core_anti_extension',
    primary: ['abs'], equipment: [], metric: 'seconds', ...HOLD_RANGE, restSec: 60,
    cues: ['팔꿈치는 어깨 아래', '엉덩이가 처지거나 솟지 않게 일자'],
  },
  {
    id: 'knee_rollout_wall', name: '무릎 롤아웃 (벽 앞)', pattern: 'core_anti_extension',
    primary: ['abs'], equipment: ['ab_roller', 'wall'], metric: 'reps', ...ROLLOUT_RANGE, restSec: 90,
    cues: ['벽에 롤러가 닿을 만큼만 굴리기', '허리가 꺾이지 않게 배에 힘을 끝까지 유지'],
    safety: ['허리에 통증이 오면 즉시 중단', '무릎 아래 수건이나 매트'],
  },
  {
    id: 'knee_rollout', name: '무릎 롤아웃', pattern: 'core_anti_extension',
    primary: ['abs'], equipment: ['ab_roller'], metric: 'reps', ...ROLLOUT_RANGE, restSec: 90,
    cues: ['허리가 꺾이기 직전까지만 굴리기', '배로 끌어당기듯 돌아오기'],
    safety: ['허리에 통증이 오면 즉시 중단'],
  },
  {
    id: 'standing_rollout_wall', name: '선 자세 롤아웃 (벽 앞)', pattern: 'core_anti_extension',
    primary: ['abs'], equipment: ['ab_roller', 'wall'], metric: 'reps', ...ROLLOUT_RANGE, restSec: 120,
    cues: ['벽에 롤러가 닿을 만큼만', '허리가 꺾이지 않게'],
    safety: ['허리에 통증이 오면 즉시 중단'],
  },
  {
    id: 'standing_rollout', name: '선 자세 롤아웃', pattern: 'core_anti_extension',
    primary: ['abs'], equipment: ['ab_roller'], metric: 'reps', ...ROLLOUT_RANGE, restSec: 120,
    cues: ['허리가 꺾이기 직전까지만'],
    safety: ['허리에 통증이 오면 즉시 중단'],
  },

  // ── 하체 ──
  {
    id: 'bodyweight_squat', name: '맨몸 스쿼트', pattern: 'lower',
    primary: ['legs'], equipment: [], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['발은 어깨너비, 무릎은 발끝 방향', '허벅지가 바닥과 평행할 때까지'],
  },
  {
    id: 'split_squat', name: '스플릿 스쿼트 (한쪽 기준)', pattern: 'lower',
    primary: ['legs'], equipment: [], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['다리를 앞뒤로 벌리고 뒷무릎이 바닥 가까이', '앞무릎은 발끝 방향'],
  },
  {
    id: 'bulgarian_split_squat', name: '불가리안 스플릿 스쿼트 (한쪽 기준)', pattern: 'lower',
    primary: ['legs'], equipment: ['chair'], metric: 'reps', ...ACSM_RANGE, restSec: 90,
    cues: ['뒷발을 의자에 올리기', '앞무릎은 발끝 방향, 상체는 살짝 앞으로'],
    safety: ['의자를 벽에 붙여 밀리지 않게'],
  },
  {
    id: 'goblet_squat', name: '고블릿 스쿼트', pattern: 'lower',
    primary: ['legs'], equipment: ['dumbbell'], metric: 'reps_load', ...ACSM_RANGE, restSec: 90,
    cues: ['덤벨을 가슴 앞에 세워 들고 스쿼트'],
  },
]

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(list.map((e) => [e.id, e]))

// 맨몸 사다리 순서는 요청서 예시를 따른다.
export const LADDERS: Ladder[] = [
  {
    pattern: 'vertical_pull',
    steps: ['dead_hang', 'scapular_pullup', 'negative_pullup', 'band_pullup', 'pullup', 'weighted_pullup'],
  },
  {
    pattern: 'horizontal_pull',
    steps: ['table_row_bent', 'table_row', 'table_row_elevated'],
    loaded: ['band_row', 'dumbbell_row'],
  },
  {
    pattern: 'horizontal_push',
    steps: ['wall_pushup', 'sink_pushup', 'desk_pushup', 'chair_pushup', 'floor_pushup', 'decline_pushup'],
  },
  {
    pattern: 'vertical_push',
    steps: ['incline_pike_pushup', 'pike_pushup', 'elevated_pike_pushup', 'wall_hspu_partial', 'wall_hspu'],
    loaded: ['band_press', 'dumbbell_press'],
  },
  {
    // 맨몸 종목이 없다. 밴드·덤벨이 생기면 넣는다 (Campos 2020)
    pattern: 'lateral_delt',
    steps: [],
    loaded: ['band_lateral_raise', 'dumbbell_lateral_raise'],
  },
  {
    pattern: 'core_anti_extension',
    steps: ['plank', 'knee_rollout_wall', 'knee_rollout', 'standing_rollout_wall', 'standing_rollout'],
  },
  {
    pattern: 'lower',
    steps: ['bodyweight_squat', 'split_squat', 'bulgarian_split_squat'],
    loaded: ['goblet_squat'],
  },
]

export const PATTERN_LABEL: Record<Exercise['pattern'], string> = {
  vertical_pull: '수직 당기기',
  horizontal_pull: '수평 당기기',
  horizontal_push: '수평 밀기',
  vertical_push: '수직 밀기',
  lateral_delt: '어깨 측면',
  core_anti_extension: '코어',
  lower: '하체',
}

export const MUSCLE_LABEL = {
  delt_side: '어깨 측면',
  delt_front: '어깨 전면',
  delt_rear: '어깨 후면',
  chest: '가슴',
  back: '등',
  abs: '복근',
  legs: '하체',
  arms: '팔',
} as const

export const EQUIPMENT_LABEL = {
  pullup_bar: '철봉',
  ab_roller: 'AB 롤러',
  bicycle: '자전거',
  band: '저항 밴드',
  dumbbell: '덤벨',
  weight_vest: '중량 조끼',
  sturdy_table: '튼튼한 식탁·책상',
  chair: '튼튼한 의자',
  sink: '싱크대',
  wall: '벽',
  step: '계단·발판',
} as const

/** 어깨 측면 근거: 덤벨 숄더 프레스 ≈ 레터럴 레이즈 (Campos 2020). 파이크 계열에 적용은 외삽 */
export const DELT_SIDE_BASIS = evx('덤벨 숄더 프레스 결과를 맨몸 파이크 계열에 적용', 'campos2020#medialDelt')
