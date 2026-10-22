import type { Rules } from '../data/rules'
import type { LocalDate, ProgramPatch, ProgramVersion, RuleOverride } from './types'

/**
 * 근거 확인 필요 규칙에 사용자가 답한 값을 덮어쓴다.
 * 덮어쓴 값의 근거는 'user-decision'으로 바뀌어 ⓘ에 "사용자가 정한 값"으로 보인다.
 */
export function withOverrides(rules: Rules, overrides: RuleOverride[]): Rules {
  const out = structuredClone(rules) as unknown as Record<string, Record<string, { value: unknown; basis: unknown }>>
  for (const o of overrides) {
    const [group, param] = o.key.split('.')
    const target = out[group]?.[param]
    if (!target) continue
    target.value = o.value
    target.basis = { type: 'user-decision', decidedAt: o.decidedAt, note: o.note }
  }
  return out as unknown as Rules
}

/** 제안을 승인하면 새 버전의 프로그램을 만든다. 적용할 수 없는 제안(이미 상황이 바뀜)이면 null */
export function applyPatch(program: ProgramVersion, patch: ProgramPatch, today: LocalDate): ProgramVersion | null {
  const next: ProgramVersion = { ...structuredClone(program), version: program.version + 1, effectiveFrom: today }
  switch (patch.op) {
    case 'slot.set': {
      const i = next.slots.findIndex((s) => s.pattern === patch.pattern)
      const current = i >= 0 ? next.slots[i] : undefined
      // 제안을 만든 뒤 프로그램이 바뀌었으면 적용하지 않는다
      if (patch.from && (!current || current.exerciseId !== patch.from.exerciseId || current.target !== patch.from.target)) return null
      if (!patch.from && current) return null
      if (i >= 0) next.slots[i] = patch.to
      else next.slots.push(patch.to)
      return next
    }
    case 'cardio':
      if (next.cardio.kind !== patch.from.kind || next.cardio.minutes !== patch.from.minutes) return null
      next.cardio = patch.to
      return next
    case 'nutrition':
      if (next.nutrition[patch.field] !== patch.from) return null
      next.nutrition = { ...next.nutrition, [patch.field]: patch.to }
      return next
    case 'equipment.suggest':
      return null
  }
}
