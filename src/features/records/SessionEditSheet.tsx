import { useState } from 'react'
import { Button, Field, NumberInput, Segmented, Sheet, inputClass } from '../../components/ui'
import { CARDIO_TYPES } from '../../data/drinks'
import { EXERCISES } from '../../data/exercises'
import { db } from '../../db/db'
import type { BodyArea, CardioKind, Difficulty, ExerciseLog, PainKind, TalkTest, WorkoutSession } from '../../engine/types'
import { nowIso } from '../../lib/time'

// 저장된 운동 기록 수정. 수정 중에는 빈 칸을 허용하고, 저장할 때 빈 세트는 뺀다.

interface EditSet {
  value?: number
  loadKg?: number
  at: string
}

interface EditExercise extends Omit<ExerciseLog, 'sets'> {
  sets: EditSet[]
}

const AREAS: { value: BodyArea; label: string }[] = [
  { value: 'shoulder', label: '어깨' },
  { value: 'elbow', label: '팔꿈치' },
  { value: 'wrist', label: '손목' },
  { value: 'lower_back', label: '허리' },
  { value: 'hip', label: '고관절' },
  { value: 'knee', label: '무릎' },
  { value: 'neck', label: '목' },
  { value: 'other', label: '기타' },
]

export function SessionEditSheet({ session, onClose }: { session: WorkoutSession; onClose: () => void }) {
  const [date, setDate] = useState(session.date)
  const [markDone, setMarkDone] = useState(false)
  const [exercises, setExercises] = useState<EditExercise[]>(() =>
    session.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s })) })),
  )
  const [kind, setKind] = useState<CardioKind>(session.cardio?.kind ?? 'walk_brisk')
  const [minutes, setMinutes] = useState<number | undefined>(Math.floor((session.cardio?.durationSec ?? 0) / 60))
  const [seconds, setSeconds] = useState<number | undefined>((session.cardio?.durationSec ?? 0) % 60)
  const [distance, setDistance] = useState<number | undefined>(session.cardio?.distanceKm)
  const [talk, setTalk] = useState<TalkTest | undefined>(session.cardio?.talkTest)

  const patchEx = (i: number, fn: (e: EditExercise) => EditExercise) => setExercises((xs) => xs.map((e, j) => (j === i ? fn(e) : e)))

  const save = async () => {
    const base = { ...session, date, ...(markDone ? { status: 'done' as const } : {}) }
    if (session.kind === 'strength') {
      base.exercises = exercises.map((e) => ({
        ...e,
        sets: e.sets
          .filter((s): s is EditSet & { value: number } => s.value !== undefined && s.value >= 0)
          .map((s) => ({ value: s.value, at: s.at, ...(s.loadKg !== undefined ? { loadKg: s.loadKg } : {}) })),
      }))
    } else if (session.cardio) {
      base.cardio = {
        ...session.cardio,
        kind,
        durationSec: (minutes ?? 0) * 60 + (seconds ?? 0),
        distanceKm: distance,
        talkTest: talk,
      }
    }
    await db.sessions.put(base)
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title="운동 기록 수정">
      <div className="space-y-5">
        <Field label="날짜">
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {session.status === 'abandoned' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={markDone} onChange={(e) => setMarkDone(e.target.checked)} />
            중단한 기록을 완료한 운동으로 처리
          </label>
        )}

        {session.kind === 'strength' &&
          exercises.map((e, i) => {
            const def = EXERCISES[e.exerciseId]
            const unit = def?.metric === 'seconds' ? '초' : '회'
            return (
              <section key={e.exerciseId} className="space-y-3 rounded-2xl border border-line p-3">
                <h3 className="font-semibold">{def?.name ?? e.exerciseId}</h3>
                {e.sets.length === 0 && <p className="text-sm text-muted">기록된 세트가 없습니다.</p>}
                {e.sets.map((s, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-sm text-muted">{k + 1}세트</span>
                    <div className="flex-1">
                      <NumberInput
                        value={s.value}
                        onChange={(v) => patchEx(i, (x) => ({ ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, value: v } : y)) }))}
                      />
                    </div>
                    <span className="text-sm text-muted">{unit}</span>
                    {def?.metric === 'reps_load' && (
                      <div className="w-20">
                        <NumberInput
                          value={s.loadKg}
                          placeholder="kg"
                          onChange={(v) => patchEx(i, (x) => ({ ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, loadKg: v } : y)) }))}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label={`${k + 1}세트 삭제`}
                      className="rounded-lg px-2 py-1 text-sm text-bad"
                      onClick={() => patchEx(i, (x) => ({ ...x, sets: x.sets.filter((_, m) => m !== k) }))}
                    >
                      삭제
                    </button>
                  </div>
                ))}
                <Button
                  size="sm"
                  onClick={() =>
                    patchEx(i, (x) => ({
                      ...x,
                      sets: [...x.sets, { value: x.sets.at(-1)?.value ?? x.prescribed.target, loadKg: x.sets.at(-1)?.loadKg, at: nowIso() }],
                    }))
                  }
                >
                  + 세트 추가
                </Button>
                <div>
                  <p className="mb-1 text-sm text-muted">체감 난이도</p>
                  <Segmented<Difficulty>
                    value={e.difficulty}
                    onChange={(v) => patchEx(i, (x) => ({ ...x, difficulty: x.difficulty === v ? undefined : v }))}
                    options={[
                      { value: 'easy', label: '쉬움' },
                      { value: 'ok', label: '적당' },
                      { value: 'hard', label: '힘듦' },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-1 text-sm text-muted">통증</p>
                  <Segmented<PainKind | 'none'>
                    value={e.pain?.kind ?? 'none'}
                    onChange={(v) =>
                      patchEx(i, (x) => ({ ...x, pain: v === 'none' ? undefined : { kind: v, area: x.pain?.area ?? 'other' } }))
                    }
                    options={[
                      { value: 'none', label: '없음' },
                      { value: 'soreness', label: '뻐근함' },
                      { value: 'joint_or_sharp', label: '관절 통증' },
                      { value: 'red_flag', label: '위험 신호' },
                    ]}
                  />
                  {e.pain && (
                    <select
                      className={`${inputClass} mt-2`}
                      value={e.pain.area}
                      onChange={(ev) => patchEx(i, (x) => ({ ...x, pain: x.pain && { ...x.pain, area: ev.target.value as BodyArea } }))}
                    >
                      {AREAS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </section>
            )
          })}

        {session.kind === 'cardio' && (
          <div className="space-y-3">
            <Field label="종류">
              <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as CardioKind)}>
                {CARDIO_TYPES.map((c) => (
                  <option key={c.kind} value={c.kind}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="분">
                <NumberInput value={minutes} onChange={setMinutes} />
              </Field>
              <Field label="초">
                <NumberInput value={seconds} onChange={setSeconds} />
              </Field>
              <Field label="거리 (km)">
                <NumberInput value={distance} onChange={setDistance} />
              </Field>
            </div>
            <div>
              <p className="mb-1 text-sm text-muted">대화 테스트</p>
              <Segmented<TalkTest>
                value={talk}
                onChange={setTalk}
                options={[
                  { value: 'can_sing', label: '노래 가능' },
                  { value: 'can_talk', label: '말만 가능' },
                  { value: 'few_words', label: '몇 마디만' },
                ]}
              />
            </div>
          </div>
        )}

        <Button variant="primary" size="lg" className="w-full" onClick={save}>
          저장
        </Button>
      </div>
    </Sheet>
  )
}
