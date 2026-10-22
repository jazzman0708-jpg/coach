import { EXERCISES } from '../../data/exercises'
import { db, newId } from '../../db/db'
import { logicalDate } from '../../engine/day'
import type { ProgramVersion, Settings, Slot, WorkoutSession, WorkoutUiState } from '../../engine/types'

/** 가진 장비로 할 수 있는 처방만 고른다 */
export function availableSlots(program: ProgramVersion, settings: Settings): { ok: Slot[]; missing: Slot[] } {
  const ok: Slot[] = []
  const missing: Slot[] = []
  for (const slot of program.slots) {
    const ex = EXERCISES[slot.exerciseId]
    if (ex && ex.equipment.every((e) => settings.equipment.includes(e))) ok.push(slot)
    else missing.push(slot)
  }
  return { ok, missing }
}

export async function startStrength(program: ProgramVersion, settings: Settings) {
  const now = new Date()
  const session: WorkoutSession = {
    id: newId(),
    date: logicalDate(now, settings.dayBoundaryHour),
    startedAt: now.toISOString(),
    programVersion: program.version,
    kind: 'strength',
    exercises: availableSlots(program, settings).ok.map((s) => ({
      exerciseId: s.exerciseId,
      prescribed: { sets: s.sets, target: s.target, restSec: s.restSec },
      sets: [],
    })),
    status: 'in_progress',
    ui: { phase: 'warmup', index: 0 },
  }
  await db.sessions.add(session)
}

export async function startCardio(program: ProgramVersion, settings: Settings) {
  const now = new Date()
  const session: WorkoutSession = {
    id: newId(),
    date: logicalDate(now, settings.dayBoundaryHour),
    startedAt: now.toISOString(),
    programVersion: program.version,
    kind: 'cardio',
    exercises: [],
    cardio: { kind: program.cardio.kind, durationSec: 0, laps: [] },
    status: 'in_progress',
    ui: { phase: 'cardio', index: 0 },
  }
  await db.sessions.add(session)
}

export const patchSession = (id: string, patch: Partial<WorkoutSession>) => db.sessions.update(id, patch)

export const setUi = (s: WorkoutSession, ui: Partial<WorkoutUiState>) =>
  db.sessions.update(s.id, { ui: { ...(s.ui ?? { phase: 'set', index: 0 }), ...ui } })

export async function finishSession(s: WorkoutSession, patch: Partial<WorkoutSession> = {}) {
  await db.sessions.update(s.id, { ...patch, status: 'done', endedAt: new Date().toISOString(), ui: undefined })
}

export async function abandonSession(s: WorkoutSession) {
  await db.sessions.update(s.id, { status: 'abandoned', endedAt: new Date().toISOString(), ui: undefined })
}
