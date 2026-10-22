import { useLiveQuery } from 'dexie-react-hooks'
import { RULES } from '../data/rules'
import { logicalDate } from '../engine/day'
import { withOverrides } from '../engine/program'
import type { Settings } from '../engine/types'
import { useNow } from '../lib/time'
import { db } from './db'

export const useSettings = () => useLiveQuery(() => db.settings.get('singleton'))
export const useProgram = () => useLiveQuery(() => db.programVersions.orderBy('version').last())

/** 진행 중인 운동 세션. 로딩 중이면 'loading', 없으면 null */
export const useActiveSession = () =>
  useLiveQuery(async () => (await db.sessions.where('status').equals('in_progress').first()) ?? null, [], 'loading' as const)

export const useLatestWeight = () =>
  useLiveQuery(async () => {
    const logs = await db.bodyLogs.orderBy('date').reverse().toArray()
    return logs.find((l) => l.weightKg !== undefined)?.weightKg ?? null
  })

/** 오늘(논리적 날짜). 1분마다 다시 계산 */
export function useToday(settings: Settings | undefined) {
  const now = useNow(60_000)
  return settings ? logicalDate(new Date(now), settings.dayBoundaryHour) : null
}

export async function updateSettings(fn: (s: Settings) => void) {
  await db.settings.where('id').equals('singleton').modify(fn)
}

/** 사용자가 답한 결정값을 덮어쓴 규칙 */
export function useRules() {
  const overrides = useLiveQuery(() => db.ruleOverrides.toArray(), [])
  return overrides ? withOverrides(RULES, overrides) : undefined
}

export const usePendingProposals = () => useLiveQuery(() => db.proposals.where('status').equals('pending').toArray(), [])
