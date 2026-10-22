import Dexie, { type EntityTable } from 'dexie'
import type {
  BodyLog,
  ChangeProposal,
  EvidenceQuestion,
  ReviewRun,
  Secret,
  WeekMenu,
  RuleOverride,
  DrinkLog,
  MealLog,
  MonthlyMeasure,
  PantryItem,
  Photo,
  ProgramVersion,
  Settings,
  SleepLog,
  WorkoutSession,
} from '../engine/types'
import { DEFAULT_SETTINGS, INITIAL_PROGRAM } from '../data/initialProgram'

// 스키마를 바꿀 때는 version(n+1)을 추가하고 backup.ts의 SCHEMA_VERSION도 올린다.
export class CoachDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>
  programVersions!: EntityTable<ProgramVersion, 'version'>
  sessions!: EntityTable<WorkoutSession, 'id'>
  mealLogs!: EntityTable<MealLog, 'id'>
  drinkLogs!: EntityTable<DrinkLog, 'id'>
  sleepLogs!: EntityTable<SleepLog, 'id'>
  bodyLogs!: EntityTable<BodyLog, 'id'>
  monthly!: EntityTable<MonthlyMeasure, 'id'>
  photos!: EntityTable<Photo, 'id'>
  pantry!: EntityTable<PantryItem, 'id'>
  proposals!: EntityTable<ChangeProposal, 'id'>
  questions!: EntityTable<EvidenceQuestion, 'id'>
  ruleOverrides!: EntityTable<RuleOverride, 'key'>
  reviews!: EntityTable<ReviewRun, 'weekOf'>
  weekMenus!: EntityTable<WeekMenu, 'weekOf'>
  /** API 키 등. 백업(내보내기)에 넣지 않는다 */
  secrets!: EntityTable<Secret, 'key'>

  constructor(name = 'coach') {
    super(name)
    this.version(1).stores({
      settings: 'id',
      programVersions: 'version',
      sessions: 'id, date, status, kind',
      mealLogs: 'id, date, [date+slot]',
      drinkLogs: 'id, date',
      sleepLogs: 'id, date',
      bodyLogs: 'id, date',
      monthly: 'id, date',
      photos: 'id, date',
      pantry: 'id, name',
    })
    // 4단계: 코치 (변경 제안·질문·사용자 결정값·점검 기록)
    this.version(2).stores({
      proposals: 'id, weekOf, status, key',
      questions: 'id, ruleKey, status',
      ruleOverrides: 'key',
      reviews: 'weekOf',
    })
    // 5단계: AI 주간 메뉴, 기기 전용 비밀값(API 키)
    this.version(3).stores({
      weekMenus: 'weekOf, status',
      secrets: 'key',
    })
    this.on('populate', (tx) => {
      tx.table('settings').add(DEFAULT_SETTINGS)
      tx.table('programVersions').add(INITIAL_PROGRAM)
    })
  }
}

export const db = new CoachDB()

/** 백업·복원 대상 테이블 (photos는 Blob이라 따로 처리) */
export const DATA_TABLES = [
  'settings',
  'programVersions',
  'sessions',
  'mealLogs',
  'drinkLogs',
  'sleepLogs',
  'bodyLogs',
  'monthly',
  'pantry',
  'proposals',
  'questions',
  'ruleOverrides',
  'reviews',
  'weekMenus',
] as const

export const newId = () => crypto.randomUUID()
