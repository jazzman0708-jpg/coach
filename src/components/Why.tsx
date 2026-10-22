import { useState } from 'react'
import { resolveRef } from '../data/evidence'
import type { Basis, EvidenceSource, Why as WhyData } from '../engine/types'
import { Badge, Sheet } from './ui'

const CHECK_LABEL: Record<EvidenceSource['check'], { text: string; tone: 'ok' | 'warn' | 'bad' }> = {
  primary: { text: '원문 대조함', tone: 'ok' },
  secondary: { text: '2차 자료만 확인', tone: 'warn' },
  unchecked: { text: '원문 대조 전', tone: 'bad' },
}

function dedupe(basis: Basis[]) {
  const seen = new Set<string>()
  return basis.filter((b) => {
    const key = JSON.stringify(b)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function BasisView({ basis }: { basis: Basis }) {
  if (basis.type === 'needs-evidence') {
    return (
      <div className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm">
        <div className="mb-1 font-semibold text-bad">근거 확인 필요</div>
        <p>{basis.question}</p>
      </div>
    )
  }
  if (basis.type === 'user-decision') {
    return (
      <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
        <div className="mb-1 font-semibold text-warn">근거 없음 — 사용자 결정값 ({basis.decidedAt})</div>
        <p>{basis.note}</p>
      </div>
    )
  }
  if (basis.type === 'preference') {
    return (
      <div className="rounded-xl border border-line bg-soft p-3 text-sm">
        <div className="mb-1 font-semibold">내 선호·목표</div>
        <p>{basis.note}</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {basis.refs.map((ref) => {
        const r = resolveRef(ref)
        if (!r) return <div key={ref} className="text-sm text-bad">근거를 찾을 수 없음: {ref}</div>
        const check = CHECK_LABEL[r.source.check]
        return (
          <div key={ref} className="rounded-xl border border-line bg-soft p-3 text-sm">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-semibold">
                {r.source.org} · {r.source.year}
              </span>
              <Badge tone={check.tone}>{check.text}</Badge>
            </div>
            <p className="font-medium">{r.claim.text}</p>
            {r.claim.appliesTo && <p className="mt-1 text-muted">대상: {r.claim.appliesTo}</p>}
            <p className="mt-1 text-xs text-muted">{r.source.title}</p>
            {r.source.note && <p className="mt-1 text-xs text-muted">{r.source.note}</p>}
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <a className="text-accent underline" href={r.source.primaryUrl ?? r.source.url} target="_blank" rel="noreferrer">
                원문 보기
              </a>
              {r.source.primaryUrl && (
                <a className="text-muted underline" href={r.source.url} target="_blank" rel="noreferrer">
                  요청서 링크
                </a>
              )}
            </div>
          </div>
        )
      })}
      {basis.extrapolation && (
        <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
          <span className="font-semibold text-warn">확장 적용: </span>
          {basis.extrapolation}
        </div>
      )}
    </div>
  )
}

/** ⓘ 버튼: "왜 이렇게 했는지(내 기록)"와 "근거 출처"를 같이 보여준다 */
export function Why({ why, basis, title = '왜 이렇게 했나요?' }: { why?: WhyData; basis: Basis[]; title?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label="근거 보기"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-base leading-none text-muted"
      >
        ⓘ
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        {why && (
          <section className="mb-4">
            <h3 className="mb-1 text-sm font-semibold text-muted">내 기록</h3>
            <p>{why.summary}</p>
            {why.data && why.data.length > 0 && (
              <dl className="mt-2 space-y-1 text-sm">
                {why.data.map((d) => (
                  <div key={d.label} className="flex justify-between gap-3">
                    <dt className="text-muted">{d.label}</dt>
                    <dd className="text-right font-medium">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted">근거</h3>
          <div className="space-y-3">
            {dedupe(basis).map((b, i) => (
              <BasisView key={i} basis={b} />
            ))}
          </div>
        </section>
      </Sheet>
    </>
  )
}
