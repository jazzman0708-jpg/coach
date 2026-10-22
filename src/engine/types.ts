// 도메인 타입. 엔진·데이터·DB·UI가 모두 이 정의를 쓴다.
// 엔진은 이 파일 외에 React·IndexedDB·현재 시각에 의존하지 않는다.

export type ID = string
/** 'YYYY-MM-DD' — 논리적 하루(설정의 dayBoundaryHour 이전은 전날) */
export type LocalDate = string
/** ISO 8601 날짜·시각 */
export type LocalDateTime = string
/** JS Date.getDay()와 같다: 0=일 … 6=토 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

// ───────────────────────── 근거 ─────────────────────────

export interface EvidenceClaim {
  /** ⓘ에 보이는 한국어 요약 */
  text: string
  values?: Record<string, number | [number, number]>
  /** 연구 대상·조건 (예: '저항운동 경험 남성 13명') */
  appliesTo?: string
}

export interface EvidenceSource {
  id: string
  org: string
  title: string
  year: number
  /** 요청서에 있던 링크 또는 대표 링크 */
  url: string
  /** 1차 출처(DOI·PMC 등). url이 2차 자료일 때 */
  primaryUrl?: string
  /** primary: 원문 대조함 / secondary: 2차 자료만 확인 / unchecked: 아직 대조 안 함 */
  check: 'primary' | 'secondary' | 'unchecked'
  note?: string
  claims: Record<string, EvidenceClaim>
}

/** 'sourceId#claimKey' */
export type EvidenceRef = `${string}#${string}`

export type Basis =
  | { type: 'evidence'; refs: EvidenceRef[]; extrapolation?: string }
  | { type: 'needs-evidence'; question: string }
  | { type: 'user-decision'; decidedAt: LocalDate; note: string }
  | { type: 'preference'; note: string }

export interface RuleParam<T> {
  /** needs-evidence면 null → 엔진이 쓰지 않는다 */
  value: T | null
  basis: Basis
}

export interface Why {
  summary: string
  data?: { label: string; value: string }[]
}

export interface Explained<T> {
  value: T
  why: Why
  basis: Basis[]
}

// ───────────────────────── 운동 ─────────────────────────

export type Pattern =
  | 'vertical_pull'
  | 'horizontal_pull'
  | 'horizontal_push'
  | 'vertical_push'
  | 'lateral_delt'
  | 'core_anti_extension'
  | 'lower'

export type Muscle =
  | 'delt_side'
  | 'delt_front'
  | 'delt_rear'
  | 'chest'
  | 'back'
  | 'abs'
  | 'legs'
  | 'arms'

export type Equipment =
  | 'pullup_bar'
  | 'ab_roller'
  | 'bicycle'
  | 'band'
  | 'dumbbell'
  | 'weight_vest'
  | 'sturdy_table'
  | 'chair'
  | 'sink'
  | 'wall'
  | 'step'

export type ExerciseMetric = 'reps' | 'seconds' | 'reps_load'

export interface Exercise {
  id: ID
  name: string
  pattern: Pattern
  primary: Muscle[]
  secondary?: Muscle[]
  /** 전부 가지고 있어야 고를 수 있다 */
  equipment: Equipment[]
  metric: ExerciseMetric
  range: { min: number; max: number }
  rangeBasis: Basis
  restSec: 60 | 90 | 120
  cues: string[]
  safety?: string[]
}

export interface Ladder {
  pattern: Pattern
  /** 맨몸 진행 순서: 쉬움 → 어려움 */
  steps: ID[]
  /** 밴드·덤벨 등 무게로 진행하는 대안 (ACSM 2~10% 규칙) */
  loaded?: ID[]
}

export interface Slot {
  pattern: Pattern
  exerciseId: ID
  sets: number
  /** 목표 반복 또는 초 */
  target: number
  restSec: number
}

export type CardioKind =
  | 'walk_moderate'
  | 'walk_brisk'
  | 'cycling_leisure'
  | 'cycling_light'
  | 'cycling_moderate'

export interface CardioRx {
  kind: CardioKind
  minutes: number
  days: Weekday[]
}

// ───────────────────────── 식단·음주 ─────────────────────────

export type MealSlot = 'meal1' | 'post_workout' | 'meal2' | 'snack' | 'extra'

export interface MealPlanItem {
  slot: Exclude<MealSlot, 'extra'>
  /** 요일별 메뉴. 없는 요일은 default */
  default: string
  byWeekday?: Partial<Record<Weekday, string>>
  note?: string
}

export interface NutritionTargets {
  kcal: number
  proteinG: number
  fatG: number
  basis: Basis
}

export interface DrinkPreset {
  id: string
  name: string
  ml: number
  abvPct: number
  /** 라벨 열량을 알면 우선 사용 */
  labelKcal?: number
}

export interface DrinkingGoal {
  maxOccasionsPerWeek: number
  maxPerOccasion: { drinkId: string; count: number }
  basis: Basis
}

// ───────────────────────── 프로그램 ─────────────────────────

export interface ProgramVersion {
  version: number
  effectiveFrom: LocalDate
  strengthDays: Weekday[]
  slots: Slot[]
  cardio: CardioRx
  nutrition: NutritionTargets
  meals: MealPlanItem[]
  drinkingGoal: DrinkingGoal
  note?: string
}

// ───────────────────────── 기록 ─────────────────────────

export type BodyArea = 'shoulder' | 'elbow' | 'wrist' | 'lower_back' | 'knee' | 'hip' | 'neck' | 'other'
export type PainKind = 'soreness' | 'joint_or_sharp' | 'red_flag'
export type Difficulty = 'easy' | 'ok' | 'hard'
export type TalkTest = 'can_sing' | 'can_talk' | 'few_words'

export interface SetLog {
  /** 실제 반복 수 또는 초 */
  value: number
  loadKg?: number
  at: LocalDateTime
}

export interface ExerciseLog {
  exerciseId: ID
  prescribed: { sets: number; target: number; restSec: number }
  sets: SetLog[]
  difficulty?: Difficulty
  pain?: { area: BodyArea; kind: PainKind }
  skipped?: boolean
}

export interface CardioLog {
  kind: CardioKind
  durationSec: number
  /** 랩 시점(시작부터 경과 초) */
  laps: number[]
  distanceKm?: number
  talkTest?: TalkTest
}

/** 운동 모드 화면 상태. 새로고침해도 이어지도록 세션에 함께 저장한다 */
export type WorkoutPhase = 'warmup' | 'set' | 'hold' | 'rest' | 'feedback' | 'summary' | 'cardio' | 'cardio_done'

export interface WorkoutUiState {
  phase: WorkoutPhase
  index: number
  restEndAt?: LocalDateTime
  restTotalSec?: number
  holdStartedAt?: LocalDateTime
  /** 유산소 스톱워치 */
  runStartedAt?: LocalDateTime
  pausedAt?: LocalDateTime
  pausedMs?: number
}

export interface WorkoutSession {
  id: ID
  date: LocalDate
  startedAt: LocalDateTime
  endedAt?: LocalDateTime
  programVersion: number
  kind: 'strength' | 'cardio'
  exercises: ExerciseLog[]
  cardio?: CardioLog
  status: 'in_progress' | 'done' | 'abandoned'
  ui?: WorkoutUiState
}

export interface MealLog {
  id: ID
  date: LocalDate
  slot: MealSlot
  status: 'as_planned' | 'skipped' | 'different'
  note?: string
  kcal?: number
  proteinG?: number
  at: LocalDateTime
}

export interface DrinkLog {
  id: ID
  date: LocalDate
  items: { drinkId: string; count: number }[]
  at: LocalDateTime
}

export interface SleepLog {
  id: ID
  /** 취침 시각 기준 논리적 날짜 */
  date: LocalDate
  bedAt: LocalDateTime
  wakeAt: LocalDateTime
}

export interface BodyLog {
  id: ID
  date: LocalDate
  weightKg?: number
  waistCm?: number
  at: LocalDateTime
}

export type PhotoAngle = 'front' | 'side' | 'back'

export interface MonthlyMeasure {
  id: ID
  date: LocalDate
  shoulderCm?: number
  chestCm?: number
  waistCm?: number
  thighCm?: number
  armCm?: number
  photoIds: Partial<Record<PhotoAngle, ID>>
}

export interface Photo {
  id: ID
  date: LocalDate
  angle: PhotoAngle
  blob: Blob
}

export interface PantryItem {
  id: ID
  name: string
  qty: number
  unit: 'g' | 'mL' | '개' | '봉' | '팩'
  updatedAt: LocalDateTime
}

// ───────────────────────── 설정 ─────────────────────────

export interface Schedule {
  wake: string
  meal1: string
  workout: string
  postWorkout: string
  meal2: string
  snack: string
  bed: string
}

export interface Settings {
  id: 'singleton'
  profile: {
    sex: 'male'
    birthDate?: LocalDate
    /** 아래 세 값은 첫 실행 화면에서 입력한다 (코드에 개인 정보를 두지 않기 위함) */
    birthYear?: number
    heightCm?: number
    startWeightKg?: number
    dailyActivity?: 'mostly_sitting' | 'mixed' | 'mostly_standing'
    /** 술 마시면 얼굴이 빨개짐 → 적정 음주 기준 절반 */
    alcoholFlush?: boolean
  }
  equipment: Equipment[]
  schedule: Schedule
  dayBoundaryHour: number
  sound: boolean
  vibration: boolean
  /** 앱 안 알림. 없으면 기본값(수면 기록 11:00, 운동 시간 알림 켬) */
  reminders?: {
    sleepLog?: { enabled: boolean; time: string }
    workout?: { enabled: boolean }
  }
  /** 식탁 로우 전에 식탁 안정성을 확인했는지 */
  tableChecked?: boolean
  disclaimerAcceptedAt?: LocalDateTime
}

// ───────────────────────── 코치 (제안 → 승인) ─────────────────────────

export type ProgramPatch =
  /** 슬롯 추가·교체 (단계 올리기·내리기·목표 바꾸기·종목 추가) */
  | { op: 'slot.set'; pattern: Pattern; from?: Slot; to: Slot }
  | { op: 'cardio'; from: CardioRx; to: CardioRx }
  | { op: 'nutrition'; field: 'kcal' | 'proteinG'; from: number; to: number }
  /** 프로그램은 바뀌지 않고 장비 구입만 권한다 */
  | { op: 'equipment.suggest'; equipment: Equipment[] }

export interface ProposalDraft {
  /** 같은 제안을 알아보는 키 (예: 'slot:vertical_pull') */
  key: string
  title: string
  patch: ProgramPatch
  why: Why
  basis: Basis[]
}

export interface ChangeProposal extends ProposalDraft {
  id: ID
  weekOf: LocalDate
  createdAt: LocalDateTime
  status: 'pending' | 'approved' | 'rejected' | 'superseded'
  decidedAt?: LocalDateTime
  appliedVersion?: number
}

export interface WarningDraft {
  key: string
  level: 'info' | 'caution' | 'stop'
  title: string
  why: Why
  basis: Basis[]
}

export interface QuestionDraft {
  /** rules.ts의 'group.param' */
  ruleKey: string
  question: string
  unit?: string
}

export interface EvidenceQuestion extends QuestionDraft {
  id: ID
  createdAt: LocalDateTime
  status: 'open' | 'answered'
}

/** 근거 확인 필요 규칙에 사용자가 답한 값 */
export interface RuleOverride {
  key: string
  value: number
  decidedAt: LocalDate
  note: string
}

export interface ReviewRun {
  weekOf: LocalDate
  ranAt: LocalDateTime
}
