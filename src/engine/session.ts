import type { ExerciseLog, LocalDateTime, WorkoutSession } from './types'

export interface ExerciseTotals {
  sets: number
  total: number
  best: number
}

export function exerciseTotals(log: ExerciseLog): ExerciseTotals {
  const values = log.sets.map((s) => s.value)
  return {
    sets: values.length,
    total: values.reduce((a, b) => a + b, 0),
    best: values.length ? Math.max(...values) : 0,
  }
}

/** before 이전에 끝난 세션 중 이 종목을 가장 최근에 한 기록 */
export function previousLog(exerciseId: string, sessions: WorkoutSession[], before: LocalDateTime): ExerciseLog | undefined {
  const t = new Date(before).getTime()
  return sessions
    .filter((s) => s.status === 'done' && new Date(s.startedAt).getTime() < t)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .flatMap((s) => s.exercises.filter((e) => e.exerciseId === exerciseId && e.sets.length > 0))
    .at(0)
}

export interface Comparison {
  totalDiff: number
  bestDiff: number
  setsDiff: number
}

export function compareLogs(current: ExerciseLog, previous: ExerciseLog | undefined): Comparison | null {
  if (!previous) return null
  const a = exerciseTotals(current)
  const b = exerciseTotals(previous)
  return { totalDiff: a.total - b.total, bestDiff: a.best - b.best, setsDiff: a.sets - b.sets }
}

/** 처방된 세트를 모두 하고, 모든 세트가 목표 이상인지 */
export function metTarget(log: ExerciseLog): boolean {
  return log.sets.length >= log.prescribed.sets && log.sets.every((s) => s.value >= log.prescribed.target)
}
