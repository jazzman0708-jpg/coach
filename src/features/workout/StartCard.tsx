import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Why } from '../../components/Why'
import { Badge, Button, Card, CardTitle } from '../../components/ui'
import { CARDIO_BY_KIND } from '../../data/drinks'
import { EXERCISES, PATTERN_LABEL } from '../../data/exercises'
import { RULES, ev } from '../../data/rules'
import { updateSettings } from '../../db/hooks'
import { dayKind, strengthSpacing } from '../../engine/schedule'
import type { LocalDate, ProgramVersion, Settings, WorkoutSession } from '../../engine/types'
import { unlockAudio } from '../../lib/device'
import { availableSlots, startCardio, startStrength } from './actions'

export function targetLabel(metric: string, target: number) {
  return metric === 'seconds' ? `${target}초` : `${target}회`
}

export function WorkoutStartCard({
  settings,
  program,
  today,
  sessions,
  active,
}: {
  settings: Settings
  program: ProgramVersion
  today: LocalDate
  sessions: WorkoutSession[]
  active: WorkoutSession | null
}) {
  const navigate = useNavigate()
  const [showOther, setShowOther] = useState(false)
  const kind = dayKind(today, program)
  const doneToday = sessions.filter((s) => s.date === today && s.status === 'done')
  const spacing = strengthSpacing(today, sessions, RULES)
  const { ok: slots, missing } = availableSlots(program, settings)
  const needsTableCheck = slots.some((s) => EXERCISES[s.exerciseId].equipment.includes('sturdy_table')) && !settings.tableChecked
  const cardio = CARDIO_BY_KIND[program.cardio.kind]

  const go = async (k: 'strength' | 'cardio') => {
    unlockAudio()
    if (k === 'strength') await startStrength(program, settings)
    else await startCardio(program, settings)
    navigate('/workout')
  }

  if (active) {
    return (
      <Card>
        <CardTitle>운동 진행 중</CardTitle>
        <Button variant="primary" size="lg" className="w-full" onClick={() => navigate('/workout')}>
          이어하기
        </Button>
      </Card>
    )
  }

  const strengthBlock = (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {slots.map((s) => {
          const ex = EXERCISES[s.exerciseId]
          return (
            <li key={s.pattern} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <span className="text-muted">{PATTERN_LABEL[s.pattern]} · </span>
                {ex.name}
              </span>
              <span className="tabular shrink-0 font-semibold">
                {s.sets}세트 × {targetLabel(ex.metric, s.target)}
              </span>
            </li>
          )
        })}
      </ul>
      {missing.length > 0 && (
        <p className="text-xs text-warn">장비가 없어 빠진 종목: {missing.map((s) => EXERCISES[s.exerciseId]?.name).join(', ')}</p>
      )}
      {!spacing.value.ok && (
        <div className="flex items-start gap-2 rounded-xl bg-warn/10 p-3 text-sm text-warn">
          <span className="flex-1">어제 근력 운동을 했습니다. 같은 근육은 48시간 쉬는 게 권장됩니다.</span>
          <Why why={spacing.why} basis={spacing.basis} />
        </div>
      )}
      {needsTableCheck ? (
        <div className="space-y-2 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
          <p className="font-semibold text-warn">안전 확인</p>
          <p>식탁 로우 전에: 식탁이 체중을 버티고, 당길 때 들리거나 밀리지 않나요? 흔들리면 식탁 대신 다른 방법이 필요합니다.</p>
          <Button variant="primary" size="sm" onClick={() => updateSettings((s) => void (s.tableChecked = true))}>
            확인했어요, 튼튼해요
          </Button>
        </div>
      ) : (
        <Button variant="primary" size="lg" className="w-full" onClick={() => go('strength')} disabled={slots.length === 0}>
          근력 운동 시작
        </Button>
      )}
    </div>
  )

  const cardioBlock = (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span>{cardio.name}</span>
        <span className="flex items-center gap-2 font-semibold">
          {program.cardio.minutes}분
          <Why
            why={{ summary: `WHO 기준(주 150분 이상)과 비교해 엔진이 시간을 조정합니다. 지금 처방은 회당 ${program.cardio.minutes}분 × 주 ${program.cardio.days.length}회입니다.` }}
            basis={[RULES.cardio.weeklyModerateMin.basis, ev(cardio.ref), ev('ismail2012#visceral')]}
          />
        </span>
      </div>
      <Button variant="primary" size="lg" className="w-full" onClick={() => go('cardio')}>
        유산소 시작
      </Button>
    </div>
  )

  return (
    <Card>
      <CardTitle right={doneToday.length > 0 ? <Badge tone="ok">오늘 완료 ✓</Badge> : undefined}>
        {kind === 'strength' ? '오늘 근력 운동' : kind === 'cardio' ? '오늘 유산소' : '오늘은 휴식일'}
      </CardTitle>
      {doneToday.length > 0 && (
        <p className="mb-3 text-sm text-muted">
          {doneToday.map((s) => (s.kind === 'strength' ? '근력' : '유산소')).join(', ')} 기록을 저장했습니다.
        </p>
      )}
      {kind === 'strength' && !doneToday.some((s) => s.kind === 'strength') && strengthBlock}
      {kind === 'cardio' && !doneToday.some((s) => s.kind === 'cardio') && cardioBlock}
      {kind === 'rest' && <p className="text-sm text-muted">쉬는 날입니다. 회복도 프로그램의 일부입니다.</p>}
      <div className="mt-3">
        {!showOther ? (
          <button type="button" className="text-sm text-muted underline" onClick={() => setShowOther(true)}>
            다른 운동 하기
          </button>
        ) : (
          <div className="mt-2 space-y-4 border-t border-line pt-3">
            {kind !== 'strength' && strengthBlock}
            {kind !== 'cardio' && cardioBlock}
          </div>
        )}
      </div>
    </Card>
  )
}
