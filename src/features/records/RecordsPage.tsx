import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Badge, Button, Card, CardTitle, Loading, NumberInput, Page, inputClass } from '../../components/ui'
import { CARDIO_BY_KIND, DRINK_BY_ID } from '../../data/drinks'
import { EXERCISES } from '../../data/exercises'
import { RULES } from '../../data/rules'
import { db, newId } from '../../db/db'
import { useSettings, useToday } from '../../db/hooks'
import { logGrams, logKcal } from '../../engine/alcohol'
import { formatKoreanDate, weekStart } from '../../engine/day'
import { sleepHours } from '../../engine/sleep'
import type { LocalDate, PantryItem, Photo, Settings } from '../../engine/types'
import { formatClock, hhmm, nowIso } from '../../lib/time'
import { DrinkSheet, MonthlySheet, SleepSheet, WeightSheet, lastNight } from './forms'
import { SessionEditSheet } from './SessionEditSheet'

type Tab = 'body' | 'sleep' | 'drink' | 'monthly' | 'pantry' | 'workout'
const TABS: { value: Tab; label: string }[] = [
  { value: 'body', label: '체중·허리' },
  { value: 'sleep', label: '수면' },
  { value: 'drink', label: '음주' },
  { value: 'monthly', label: '월간' },
  { value: 'pantry', label: '냉장고' },
  { value: 'workout', label: '운동' },
]

export default function RecordsPage() {
  const settings = useSettings()
  const today = useToday(settings)
  const [tab, setTab] = useState<Tab>('body')
  if (!settings || !today) return <Loading />
  return (
    <Page title="기록">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${tab === t.value ? 'bg-accent text-accent-ink' : 'bg-soft'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'body' && <BodyTab today={today} settings={settings} />}
      {tab === 'sleep' && <SleepTab today={today} settings={settings} />}
      {tab === 'drink' && <DrinkTab today={today} />}
      {tab === 'monthly' && <MonthlyTab />}
      {tab === 'pantry' && <PantryTab />}
      {tab === 'workout' && <WorkoutTab />}
    </Page>
  )
}

const del = async (fn: () => Promise<unknown>) => {
  if (confirm('이 기록을 삭제할까요?')) await fn()
}

function BodyTab({ today, settings }: { today: LocalDate; settings: Settings }) {
  const [open, setOpen] = useState(false)
  const logs = useLiveQuery(() => db.bodyLogs.orderBy('date').reverse().limit(60).toArray(), []) ?? []
  const lastWeight = logs.find((l) => l.weightKg !== undefined)?.weightKg ?? settings.profile.startWeightKg ?? 70
  const lastWaist = logs.find((l) => l.waistCm !== undefined)?.waistCm

  // 주(월~일)별 평균 체중
  const weeks = new Map<string, number[]>()
  for (const l of logs) {
    if (l.weightKg === undefined) continue
    const k = weekStart(l.date)
    weeks.set(k, [...(weeks.get(k) ?? []), l.weightKg])
  }

  return (
    <>
      <Button variant="primary" className="w-full" onClick={() => setOpen(true)}>
        체중·허리 기록
      </Button>
      {weeks.size > 0 && (
        <Card>
          <CardTitle>주 평균 체중</CardTitle>
          <ul className="space-y-1 text-sm">
            {[...weeks.entries()].slice(0, 8).map(([wk, ws]) => (
              <li key={wk} className="flex justify-between">
                <span className="text-muted">{formatKoreanDate(wk)} 주</span>
                <span className="tabular font-semibold">
                  {(ws.reduce((a, b) => a + b, 0) / ws.length).toFixed(1)} kg <span className="font-normal text-muted">({ws.length}회 측정)</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <CardTitle>최근 기록</CardTitle>
        {logs.length === 0 && <p className="text-sm text-muted">아직 기록이 없습니다.</p>}
        <ul className="divide-y divide-line">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-2 text-sm">
              <span>{formatKoreanDate(l.date)}</span>
              <span className="tabular">
                {l.weightKg !== undefined && `${l.weightKg} kg`}
                {l.waistCm !== undefined && ` · 허리 ${l.waistCm} cm`}
              </span>
              <button type="button" className="text-xs text-muted" onClick={() => del(() => db.bodyLogs.delete(l.id))}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {open && <WeightSheet open onClose={() => setOpen(false)} date={today} lastWeight={lastWeight} lastWaist={lastWaist} />}
    </>
  )
}

function SleepTab({ today, settings }: { today: LocalDate; settings: Settings }) {
  const [open, setOpen] = useState(false)
  const logs = useLiveQuery(() => db.sleepLogs.orderBy('date').reverse().limit(30).toArray(), []) ?? []
  const min = RULES.sleep.minHours.value ?? 7
  return (
    <>
      <Button variant="primary" className="w-full" onClick={() => setOpen(true)}>
        수면 기록
      </Button>
      <Card>
        <CardTitle>최근 수면</CardTitle>
        {logs.length === 0 && <p className="text-sm text-muted">아직 기록이 없습니다.</p>}
        <ul className="divide-y divide-line">
          {logs.map((l) => {
            const h = sleepHours(l)
            return (
              <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                <span>{formatKoreanDate(l.date)} 밤</span>
                <span className="tabular">
                  {hhmm(l.bedAt)}~{hhmm(l.wakeAt)} · <b className={h < min ? 'text-warn' : ''}>{h.toFixed(1)}시간</b>
                </span>
                <button type="button" className="text-xs text-muted" onClick={() => del(() => db.sleepLogs.delete(l.id))}>
                  삭제
                </button>
              </li>
            )
          })}
        </ul>
      </Card>
      {open && <SleepSheet open onClose={() => setOpen(false)} settings={settings} night={lastNight(today)} />}
    </>
  )
}

function DrinkTab({ today }: { today: LocalDate }) {
  const [open, setOpen] = useState(false)
  const logs = useLiveQuery(() => db.drinkLogs.orderBy('date').reverse().limit(60).toArray(), []) ?? []
  const perDrink = RULES.alcohol.gramsPerDrink.value ?? 14
  return (
    <>
      <Button variant="primary" className="w-full" onClick={() => setOpen(true)}>
        음주 기록
      </Button>
      <Card>
        <CardTitle>최근 음주</CardTitle>
        {logs.length === 0 && <p className="text-sm text-muted">아직 기록이 없습니다.</p>}
        <ul className="divide-y divide-line">
          {logs.map((l) => {
            const g = logGrams(l, DRINK_BY_ID)
            return (
              <li key={l.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{formatKoreanDate(l.date)}</span>
                  <span className="tabular">
                    {(g / perDrink).toFixed(1)}잔 · {Math.round(logKcal(l, DRINK_BY_ID, RULES))} kcal
                  </span>
                  <button type="button" className="text-xs text-muted" onClick={() => del(() => db.drinkLogs.delete(l.id))}>
                    삭제
                  </button>
                </div>
                <p className="text-xs text-muted">{l.items.map((it) => `${DRINK_BY_ID[it.drinkId]?.name} × ${it.count}`).join(', ')}</p>
              </li>
            )
          })}
        </ul>
      </Card>
      {open && <DrinkSheet open onClose={() => setOpen(false)} date={today} />}
    </>
  )
}

function Thumb({ photo }: { photo: Photo | undefined }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!photo) return
    const u = URL.createObjectURL(photo.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo])
  if (!photo || !url) return <div className="aspect-[3/4] rounded-lg bg-soft" />
  return <img src={url} alt={photo.angle} className="aspect-[3/4] w-full rounded-lg object-cover" />
}

function MonthlyTab() {
  const [open, setOpen] = useState(false)
  const rows = useLiveQuery(() => db.monthly.orderBy('date').reverse().toArray(), []) ?? []
  const photos = useLiveQuery(() => db.photos.toArray(), []) ?? []
  const byId = new Map(photos.map((p) => [p.id, p]))
  return (
    <>
      <Button variant="primary" className="w-full" onClick={() => setOpen(true)}>
        월간 측정·사진
      </Button>
      {rows.length === 0 && (
        <Card>
          <p className="text-sm text-muted">아직 기록이 없습니다. 한 달에 한 번 어깨·가슴·허리·허벅지·팔 둘레와 사진을 남기세요.</p>
        </Card>
      )}
      {rows.map((r) => (
        <Card key={r.id}>
          <CardTitle
            right={
              <button
                type="button"
                className="text-xs text-muted"
                onClick={() =>
                  del(async () => {
                    await db.photos.bulkDelete(Object.values(r.photoIds).filter((x): x is string => !!x))
                    await db.monthly.delete(r.id)
                  })
                }
              >
                삭제
              </button>
            }
          >
            {formatKoreanDate(r.date)}
          </CardTitle>
          <p className="tabular text-sm">
            {[
              ['어깨', r.shoulderCm],
              ['가슴', r.chestCm],
              ['허리', r.waistCm],
              ['허벅지', r.thighCm],
              ['팔', r.armCm],
            ]
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => `${k} ${v}`)
              .join(' · ') || '둘레 기록 없음'}
            {r.shoulderCm && r.waistCm ? ` · 어깨÷허리 ${(r.shoulderCm / r.waistCm).toFixed(2)}` : ''}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(['front', 'side', 'back'] as const).map((a) => (
              <Thumb key={a} photo={r.photoIds[a] ? byId.get(r.photoIds[a]!) : undefined} />
            ))}
          </div>
        </Card>
      ))}
      {open && <MonthlySheet open onClose={() => setOpen(false)} />}
    </>
  )
}

function PantryTab() {
  const items = useLiveQuery(() => db.pantry.orderBy('name').toArray(), []) ?? []
  const [name, setName] = useState('')
  const [qty, setQty] = useState<number | undefined>()
  const [unit, setUnit] = useState<PantryItem['unit']>('g')

  const add = async () => {
    if (!name || !qty) return
    await db.pantry.add({ id: newId(), name, qty, unit, updatedAt: nowIso() })
    setName('')
    setQty(undefined)
  }
  const step = (u: PantryItem['unit']) => (u === 'g' || u === 'mL' ? 50 : 1)

  return (
    <>
      <Card>
        <CardTitle>재료 추가</CardTitle>
        <div className="grid grid-cols-[1fr_5rem_4.5rem] gap-2">
          <input className={inputClass} placeholder="예: 양배추" value={name} onChange={(e) => setName(e.target.value)} />
          <NumberInput value={qty} onChange={setQty} step={1} placeholder="양" />
          <select className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value as PantryItem['unit'])}>
            {(['g', 'mL', '개', '봉', '팩'] as const).map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <Button variant="primary" className="mt-3 w-full" onClick={add} disabled={!name || !qty}>
          추가
        </Button>
        <p className="mt-2 text-xs text-muted">메뉴 생성(4·5단계)에서 이 재료를 먼저 쓰고, 부족한 것만 장보기 목록에 넣습니다.</p>
      </Card>
      <Card>
        <CardTitle>지금 있는 재료</CardTitle>
        {items.length === 0 && <p className="text-sm text-muted">비어 있습니다.</p>}
        <ul className="divide-y divide-line">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 py-2">
              <span className="flex-1">{it.name}</span>
              <button type="button" className="h-8 w-8 rounded-lg bg-soft" onClick={() => db.pantry.update(it.id, { qty: Math.max(0, it.qty - step(it.unit)), updatedAt: nowIso() })}>
                −
              </button>
              <span className="tabular w-16 text-center text-sm">
                {it.qty}
                {it.unit}
              </span>
              <button type="button" className="h-8 w-8 rounded-lg bg-soft" onClick={() => db.pantry.update(it.id, { qty: it.qty + step(it.unit), updatedAt: nowIso() })}>
                +
              </button>
              <button type="button" className="text-xs text-muted" onClick={() => del(() => db.pantry.delete(it.id))}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

function WorkoutTab() {
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().limit(60).toArray(), []) ?? []
  const [openId, setOpenId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const shown = sessions.filter((s) => s.status !== 'in_progress')
  const editing = shown.find((s) => s.id === editId)
  return (
    <Card>
      <CardTitle>운동 기록</CardTitle>
      {shown.length === 0 && <p className="text-sm text-muted">아직 기록이 없습니다.</p>}
      <ul className="divide-y divide-line">
        {shown.map((s) => (
          <li key={s.id} className="py-2">
            <button type="button" className="flex w-full items-center justify-between text-left text-sm" onClick={() => setOpenId(openId === s.id ? null : s.id)}>
              <span>
                {formatKoreanDate(s.date)} · {s.kind === 'strength' ? '근력' : CARDIO_BY_KIND[s.cardio?.kind ?? 'walk_brisk'].name}
              </span>
              {s.status === 'abandoned' ? (
                <Badge tone="warn">중단</Badge>
              ) : s.kind === 'cardio' ? (
                <span className="tabular">{formatClock((s.cardio?.durationSec ?? 0) * 1000)}</span>
              ) : (
                <span className="text-muted">{s.exercises.filter((e) => e.sets.length).length}개 종목</span>
              )}
            </button>
            {openId === s.id && (
              <div className="mt-2 space-y-1 rounded-xl bg-soft p-3 text-sm">
                {s.kind === 'strength' &&
                  s.exercises.map((e) => (
                    <p key={e.exerciseId}>
                      {EXERCISES[e.exerciseId]?.name}: {e.sets.map((x) => x.value).join(' · ') || '건너뜀'}
                      {e.pain && <span className="text-warn"> (통증)</span>}
                    </p>
                  ))}
                {s.kind === 'cardio' && s.cardio && (
                  <p>
                    {formatClock(s.cardio.durationSec * 1000)}
                    {s.cardio.distanceKm ? ` · ${s.cardio.distanceKm} km` : ''}
                    {s.cardio.laps.length ? ` · 랩 ${s.cardio.laps.length}개` : ''}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="primary" onClick={() => setEditId(s.id)}>
                    수정
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => del(() => db.sessions.delete(s.id))}>
                    삭제
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing && <SessionEditSheet key={editing.id} session={editing} onClose={() => setEditId(null)} />}
    </Card>
  )
}
