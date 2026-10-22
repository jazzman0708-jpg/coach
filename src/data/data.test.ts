import { describe, expect, it } from 'vitest'
import type { Basis, RuleParam } from '../engine/types'
import { CARDIO_TYPES } from './drinks'
import { EVIDENCE, resolveRef } from './evidence'
import { EXERCISES, LADDERS } from './exercises'
import { DEFAULT_SETTINGS, INITIAL_PROGRAM } from './initialProgram'
import { RULES } from './rules'

const refsOf = (b: Basis) => (b.type === 'evidence' ? b.refs : [])

function allRuleParams(): [string, RuleParam<unknown>][] {
  return Object.entries(RULES).flatMap(([group, params]) =>
    Object.entries(params).map(([k, v]) => [`${group}.${k}`, v as RuleParam<unknown>] as [string, RuleParam<unknown>]),
  )
}

describe('근거 데이터 무결성', () => {
  it('규칙·종목·유산소가 참조하는 근거가 모두 evidence.ts에 있다', () => {
    const refs = [
      ...allRuleParams().flatMap(([, p]) => refsOf(p.basis)),
      ...Object.values(EXERCISES).flatMap((e) => refsOf(e.rangeBasis)),
      ...CARDIO_TYPES.map((c) => c.ref),
      ...refsOf(INITIAL_PROGRAM.nutrition.basis),
    ]
    const missing = refs.filter((r) => !resolveRef(r))
    expect(missing).toEqual([])
  })

  it('근거 확인 필요인 규칙만 값이 비어 있다 (출처 없는 숫자 금지)', () => {
    for (const [key, p] of allRuleParams()) {
      expect(p.value === null, key).toBe(p.basis.type === 'needs-evidence')
    }
  })

  it('모든 출처에 링크와 1개 이상의 핵심 수치가 있다', () => {
    for (const s of Object.values(EVIDENCE)) {
      expect(s.url, s.id).toMatch(/^https:\/\//)
      expect(Object.keys(s.claims).length, s.id).toBeGreaterThan(0)
    }
  })
})

describe('종목 사다리', () => {
  it('사다리의 모든 종목이 존재하고 패턴이 맞다', () => {
    for (const l of LADDERS) {
      for (const id of [...l.steps, ...(l.loaded ?? [])]) {
        expect(EXERCISES[id], id).toBeDefined()
        expect(EXERCISES[id].pattern, id).toBe(l.pattern)
      }
    }
  })

  it('모든 종목이 사다리 어딘가에 들어 있다', () => {
    const inLadders = new Set(LADDERS.flatMap((l) => [...l.steps, ...(l.loaded ?? [])]))
    expect(Object.keys(EXERCISES).filter((id) => !inLadders.has(id))).toEqual([])
  })

  it('초기 프로그램 종목은 기본 장비만으로 할 수 있다', () => {
    for (const slot of INITIAL_PROGRAM.slots) {
      const ex = EXERCISES[slot.exerciseId]
      expect(ex.pattern).toBe(slot.pattern)
      expect(ex.equipment.every((e) => DEFAULT_SETTINGS.equipment.includes(e)), ex.id).toBe(true)
    }
  })
})

describe('숫자 입력', () => {
  it('쉼표 소수점과 공백을 받아들이고, 숫자가 아니면 비운다', async () => {
    const { parseDecimal } = await import('../components/ui')
    expect(parseDecimal('68,5')).toBe(68.5)
    expect(parseDecimal(' 175 ')).toBe(175)
    expect(parseDecimal('68.')).toBe(68)
    expect(parseDecimal('')).toBeUndefined()
    expect(parseDecimal('abc')).toBeUndefined()
  })
})

describe('레시피', () => {
  it('초기 프로그램의 메뉴마다 레시피가 연결된다 (밥·요거트 등 조리 없는 것 제외)', async () => {
    const { findRecipe } = await import('./recipes')
    const menus = INITIAL_PROGRAM.meals.flatMap((m) => [m.default, ...Object.values(m.byWeekday ?? {})])
    const cooked = menus.filter((m) => !m.includes('그릭요거트') && !m.startsWith('잡곡밥'))
    expect(cooked.filter((m) => !findRecipe(m))).toEqual([])
    expect(findRecipe('돼지고기 두부 김치찌개')?.id).toBe('kimchi_stew')
    expect(findRecipe('우삼겹 두부김치')?.id).toBe('beef_tofu_kimchi')
  })
})

describe('웹 푸시', () => {
  it('공개키를 65바이트 P-256 공개키로 바꾼다', async () => {
    const { VAPID_PUBLIC_KEY, base64UrlToBytes } = await import('../lib/push')
    const bytes = base64UrlToBytes(VAPID_PUBLIC_KEY)
    expect(bytes.length).toBe(65)
    expect(bytes[0]).toBe(4) // 압축하지 않은 EC 공개키
  })
})
