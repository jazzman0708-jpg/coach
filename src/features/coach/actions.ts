import { db, newId } from '../../db/db'
import type { Rules } from '../../data/rules'
import { daysBetween, weekStart } from '../../engine/day'
import { applyPatch } from '../../engine/program'
import type { ChangeProposal, EvidenceQuestion, LocalDate, ProgramVersion, Settings } from '../../engine/types'
import { runWeeklyReview } from '../../engine/weeklyReview'
import { nowIso } from '../../lib/time'

/** 거절한 같은 제안은 4주 동안 다시 내지 않는다 (앱 동작 값) */
const REJECT_COOLDOWN_DAYS = 28

export async function loadReviewInput() {
  const [sessions, body, sleep, drinks] = await Promise.all([db.sessions.toArray(), db.bodyLogs.toArray(), db.sleepLogs.toArray(), db.drinkLogs.toArray()])
  return { sessions, body, sleep, drinks }
}

/** 주간 점검을 실행하고 제안·질문을 저장한다 */
export async function runAndStoreReview(today: LocalDate, settings: Settings, program: ProgramVersion, rules: Rules) {
  const review = runWeeklyReview({ today, settings, program, rules, ...(await loadReviewInput()) })
  const now = nowIso()
  const weekOf = weekStart(today)
  await db.transaction('rw', [db.proposals, db.questions, db.reviews], async () => {
    const all = await db.proposals.toArray()
    const pending = all.filter((p) => p.status === 'pending')
    const keys = new Set(review.proposals.map((p) => p.key))
    for (const p of pending) if (!keys.has(p.key)) await db.proposals.update(p.id, { status: 'superseded', decidedAt: now })
    for (const d of review.proposals) {
      const rejected = all.find(
        (p) =>
          p.key === d.key &&
          p.status === 'rejected' &&
          JSON.stringify(p.patch) === JSON.stringify(d.patch) &&
          p.decidedAt &&
          daysBetween(p.decidedAt.slice(0, 10), today) < REJECT_COOLDOWN_DAYS,
      )
      if (rejected) continue
      const same = pending.find((p) => p.key === d.key)
      if (same) await db.proposals.update(same.id, { ...d, weekOf })
      else await db.proposals.add({ ...d, id: newId(), weekOf, createdAt: now, status: 'pending' })
    }
    const asked = await db.questions.toArray()
    for (const q of review.questions) {
      if (!asked.some((x) => x.ruleKey === q.ruleKey)) await db.questions.add({ ...q, id: newId(), createdAt: now, status: 'open' })
    }
    await db.reviews.put({ weekOf, ranAt: now })
  })
  return review
}

/** 승인: 프로그램 새 버전을 만든다. 그사이 프로그램이 바뀌어 적용할 수 없으면 false */
export async function approveProposal(p: ChangeProposal, today: LocalDate): Promise<boolean> {
  const now = nowIso()
  return db.transaction('rw', [db.proposals, db.programVersions], async () => {
    if (p.patch.op === 'equipment.suggest') {
      await db.proposals.update(p.id, { status: 'approved', decidedAt: now })
      return true
    }
    const program = await db.programVersions.orderBy('version').last()
    const next = program ? applyPatch(program, p.patch, today) : null
    if (!next) {
      await db.proposals.update(p.id, { status: 'superseded', decidedAt: now })
      return false
    }
    await db.programVersions.add(next)
    await db.proposals.update(p.id, { status: 'approved', decidedAt: now, appliedVersion: next.version })
    return true
  })
}

export const rejectProposal = (p: ChangeProposal) => db.proposals.update(p.id, { status: 'rejected', decidedAt: nowIso() })

/** 근거 확인 필요 질문에 답하면 사용자 결정값으로 저장된다 */
export async function answerQuestion(q: EvidenceQuestion, value: number, today: LocalDate) {
  await db.transaction('rw', [db.questions, db.ruleOverrides], async () => {
    await db.ruleOverrides.put({ key: q.ruleKey, value, decidedAt: today, note: `${q.question} → ${value}${q.unit ?? ''}` })
    await db.questions.update(q.id, { status: 'answered' })
  })
}
