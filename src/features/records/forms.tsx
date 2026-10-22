import { useState } from 'react'
import { Why } from '../../components/Why'
import { Button, Field, NumberInput, Sheet, Stepper, inputClass } from '../../components/ui'
import { DRINKS, DRINK_BY_ID } from '../../data/drinks'
import { RULES, ev } from '../../data/rules'
import { db, newId } from '../../db/db'
import { alcoholGrams } from '../../engine/alcohol'
import { addDays, logicalDate, toLocalDate } from '../../engine/day'
import { sleepHours } from '../../engine/sleep'
import type { LocalDate, MealSlot, PhotoAngle, Settings } from '../../engine/types'
import { resizeImage } from '../../lib/image'
import { nowIso } from '../../lib/time'

interface SheetProps {
  open: boolean
  onClose: () => void
}

// ───────────── 체중·허리 ─────────────

export function WeightSheet({ open, onClose, date, lastWeight, lastWaist }: SheetProps & { date: LocalDate; lastWeight: number; lastWaist?: number }) {
  const [day, setDay] = useState(date)
  const [weight, setWeight] = useState(lastWeight)
  const [withWaist, setWithWaist] = useState(false)
  const [waist, setWaist] = useState<number | undefined>(lastWaist)

  const save = async () => {
    const existing = await db.bodyLogs.where('date').equals(day).first()
    const patch = { weightKg: weight, ...(withWaist && waist ? { waistCm: waist } : {}), at: nowIso() }
    if (existing) await db.bodyLogs.update(existing.id, patch)
    else await db.bodyLogs.add({ id: newId(), date: day, ...patch })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="체중·허리 기록">
      <div className="space-y-4">
        <Field label="날짜">
          <input type="date" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-muted">
            체중 (아침 기상 직후, 화장실 다녀온 뒤)
            <Why
              why={{ summary: '체중은 하루에도 수분·나트륨·음주로 흔들리고, 주말에 높아지는 주기가 있습니다. 매일(최소 주 3회) 재서 주 평균끼리 비교합니다.' }}
              basis={[ev('turicchi2020#weekly'), ev('steinberg2013#daily', 'zheng2015#regular'), RULES.body.weeklyNoisePct.basis]}
            />
          </div>
          <Stepper value={weight} onChange={setWeight} step={0.1} min={30} max={200} unit="kg" />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={withWaist} onChange={(e) => setWithWaist(e.target.checked)} className="h-5 w-5" />
          <span>허리둘레도 기록 (주 1회)</span>
        </label>
        {withWaist && (
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-muted">
              허리둘레
              <Why
                why={{ summary: '가장 아래 갈비뼈와 골반뼈 위 끝의 중간 높이에서, 발을 25~30 cm 벌리고 편하게 숨 쉬며 줄자가 살을 누르지 않게 잽니다.' }}
                basis={[ev('ksso2022#waistMethod'), ev('ksso2022#waist')]}
              />
            </div>
            <Stepper value={waist ?? 80} onChange={setWaist} step={0.5} min={40} max={160} unit="cm" />
          </div>
        )}
        <Button variant="primary" size="lg" className="w-full" onClick={save}>
          저장
        </Button>
      </div>
    </Sheet>
  )
}

// ───────────── 수면 ─────────────

/** 잠든 날(논리적 날짜)과 시각으로 실제 시각을 만든다. 일어난 시각은 잠든 시각 이후 첫 시점 */
function buildSleep(night: LocalDate, bed: string, wake: string, boundaryHour: number) {
  const [bh, bm] = bed.split(':').map(Number)
  const [wh, wm] = wake.split(':').map(Number)
  const [y, m, d] = night.split('-').map(Number)
  const bedAt = new Date(y, m - 1, d, bh, bm)
  if (bh < boundaryHour) bedAt.setDate(bedAt.getDate() + 1)
  const wakeAt = new Date(bedAt)
  wakeAt.setHours(wh, wm, 0, 0)
  if (wakeAt <= bedAt) wakeAt.setDate(wakeAt.getDate() + 1)
  return { bedAt, wakeAt }
}

export function SleepSheet({ open, onClose, settings, night }: SheetProps & { settings: Settings; night: LocalDate }) {
  const [day, setDay] = useState(night)
  const [bed, setBed] = useState(settings.schedule.bed)
  const [wake, setWake] = useState(settings.schedule.wake)
  const { bedAt, wakeAt } = buildSleep(day, bed, wake, settings.dayBoundaryHour)
  const hours = sleepHours({ bedAt: bedAt.toISOString(), wakeAt: wakeAt.toISOString() })

  const save = async () => {
    const date = logicalDate(bedAt, settings.dayBoundaryHour)
    const existing = await db.sleepLogs.where('date').equals(date).first()
    const row = { date, bedAt: bedAt.toISOString(), wakeAt: wakeAt.toISOString() }
    if (existing) await db.sleepLogs.update(existing.id, row)
    else await db.sleepLogs.add({ id: newId(), ...row })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="수면 기록">
      <div className="space-y-4">
        <Field label="어느 날 밤인가요?" hint="자정을 넘겨 잤어도 '전날 밤'으로 고르세요.">
          <input type="date" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="잠든 시각">
            <input type="time" className={inputClass} value={bed} onChange={(e) => setBed(e.target.value)} />
          </Field>
          <Field label="일어난 시각">
            <input type="time" className={inputClass} value={wake} onChange={(e) => setWake(e.target.value)} />
          </Field>
        </div>
        <p className="text-center text-lg">
          수면 <b className="tabular">{hours.toFixed(1)}</b>시간{' '}
          {hours < (RULES.sleep.minHours.value ?? 7) && <span className="text-warn">(7시간 미만)</span>}
        </p>
        <Button variant="primary" size="lg" className="w-full" onClick={save} disabled={hours <= 0 || hours > 16}>
          저장
        </Button>
      </div>
    </Sheet>
  )
}

// ───────────── 음주 ─────────────

export function DrinkSheet({ open, onClose, date }: SheetProps & { date: LocalDate }) {
  const [day, setDay] = useState(date)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const items = Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([drinkId, count]) => ({ drinkId, count }))
  const grams = items.reduce((s, it) => s + alcoholGrams(DRINK_BY_ID[it.drinkId].ml, DRINK_BY_ID[it.drinkId].abvPct) * it.count, 0)
  const perDrink = RULES.alcohol.gramsPerDrink.value ?? 14
  const kcal = grams * (RULES.alcohol.kcalPerGram.value ?? 7)

  const save = async () => {
    await db.drinkLogs.add({ id: newId(), date: day, items, at: nowIso() })
    setCounts({})
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="음주 기록">
      <div className="space-y-4">
        <Field label="날짜">
          <input type="date" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <div className="space-y-3">
          {DRINKS.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3">
              <span className="text-sm">{d.name}</span>
              <div className="flex items-center gap-2">
                <button type="button" className="h-10 w-10 rounded-xl bg-soft text-xl" onClick={() => setCounts((c) => ({ ...c, [d.id]: Math.max(0, (c[d.id] ?? 0) - 0.5) }))}>
                  −
                </button>
                <span className="tabular w-8 text-center font-bold">{counts[d.id] ?? 0}</span>
                <button type="button" className="h-10 w-10 rounded-xl bg-soft text-xl" onClick={() => setCounts((c) => ({ ...c, [d.id]: (c[d.id] ?? 0) + 0.5 }))}>
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-xl bg-soft p-3 text-sm">
          <span>
            알코올 <b>{grams.toFixed(0)} g</b> = 표준 <b>{(grams / perDrink).toFixed(1)}잔</b> · 약 <b>{kcal.toFixed(0)} kcal</b>
          </span>
          <Why
            why={{ summary: '도수와 용량으로 알코올 양을 계산합니다. 1잔(표준잔) = 알코올 14 g, 열량은 알코올 1 g당 7 kcal입니다. 소주의 당류 열량은 빠져 있어 실제보다 조금 낮게 나옵니다.' }}
            basis={[RULES.alcohol.gramsPerDrink.basis, RULES.alcohol.kcalPerGram.basis, ev('sojuKcal#bottle')]}
          />
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={save} disabled={items.length === 0}>
          저장
        </Button>
      </div>
    </Sheet>
  )
}

// ───────────── 끼니: 다른 거 먹음 ─────────────

export function MealDifferentSheet({ open, onClose, date, slot, label }: SheetProps & { date: LocalDate; slot: MealSlot; label: string }) {
  const [note, setNote] = useState('')
  const [protein, setProtein] = useState<number | undefined>()
  const [kcal, setKcal] = useState<number | undefined>()

  const save = async () => {
    const existing = slot === 'extra' ? undefined : await db.mealLogs.where({ date, slot }).first()
    const row = { date, slot, status: 'different' as const, note, proteinG: protein, kcal, at: nowIso() }
    if (existing) await db.mealLogs.update(existing.id, row)
    else await db.mealLogs.add({ id: newId(), ...row })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={`${label} — 다른 거 먹음`}>
      <div className="space-y-4">
        <Field label="무엇을 먹었나요?">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 순대국 + 밥 반 공기" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="단백질 (대략, g)">
            <NumberInput value={protein} onChange={setProtein} step={1} />
          </Field>
          <Field label="칼로리 (대략, kcal)">
            <NumberInput value={kcal} onChange={setKcal} step={10} />
          </Field>
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={save} disabled={!note}>
          저장
        </Button>
      </div>
    </Sheet>
  )
}

// ───────────── 월간 측정·사진 ─────────────

const ANGLES: { angle: PhotoAngle; label: string }[] = [
  { angle: 'front', label: '정면' },
  { angle: 'side', label: '측면' },
  { angle: 'back', label: '후면' },
]

export function MonthlySheet({ open, onClose }: SheetProps) {
  const [day, setDay] = useState(toLocalDate(new Date()))
  const [m, setM] = useState<{ shoulderCm?: number; chestCm?: number; waistCm?: number; thighCm?: number; armCm?: number }>({})
  const [files, setFiles] = useState<Partial<Record<PhotoAngle, File>>>({})
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const photoIds: Partial<Record<PhotoAngle, string>> = {}
    for (const { angle } of ANGLES) {
      const f = files[angle]
      if (!f) continue
      const id = newId()
      await db.photos.add({ id, date: day, angle, blob: await resizeImage(f) })
      photoIds[angle] = id
    }
    await db.monthly.add({ id: newId(), date: day, ...m, photoIds })
    setSaving(false)
    setM({})
    setFiles({})
    onClose()
  }

  const num = (key: keyof typeof m, label: string) => (
    <Field label={label}>
      <NumberInput value={m[key]} onChange={(v) => setM((s) => ({ ...s, [key]: v }))} step={0.5} placeholder="cm" />
    </Field>
  )

  return (
    <Sheet open={open} onClose={onClose} title="월간 측정">
      <div className="space-y-4">
        <Field label="날짜">
          <input type="date" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {num('shoulderCm', '어깨 (cm)')}
          {num('chestCm', '가슴 (cm)')}
          {num('waistCm', '허리 (cm)')}
          {num('thighCm', '허벅지 (cm)')}
          {num('armCm', '팔 (cm)')}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">사진 (기기 안에만 저장)</p>
          <div className="grid grid-cols-3 gap-2">
            {ANGLES.map(({ angle, label }) => (
              <label key={angle} className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-soft text-sm">
                <span>{label}</span>
                <span className="text-xs text-muted">{files[angle] ? '선택됨 ✓' : '탭해서 찍기'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setFiles((s) => ({ ...s, [angle]: f }))
                  }}
                />
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">매달 같은 장소·조명·거리에서 찍으면 비교가 쉽습니다.</p>
        </div>
        <Button variant="primary" size="lg" className="w-full" onClick={save} disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </Button>
      </div>
    </Sheet>
  )
}

/** 오늘 화면에서 '어젯밤'은 논리적 날짜 기준 하루 전 */
export const lastNight = (today: LocalDate) => addDays(today, -1)
