import { useRef, useState } from 'react'
import { Button, Field, NumberInput, Stepper, inputClass } from '../../components/ui'
import { importAll, parseBackup } from '../../db/backup'
import { db, newId } from '../../db/db'
import { logicalDate } from '../../engine/day'
import { DISCLAIMER } from './SettingsPage'

// 첫 실행 화면. 신체 정보·생활 시간·음주 목표는 코드(공개 저장소)에 두지 않고 여기서 입력받아 기기에만 저장한다.
export function Onboarding() {
  const [birthYear, setBirthYear] = useState<number>()
  const [height, setHeight] = useState<number>()
  const [weight, setWeight] = useState<number>()
  const [wake, setWake] = useState('07:00')
  const [bed, setBed] = useState('23:00')
  const [occasions, setOccasions] = useState(1)
  const [perOccasion, setPerOccasion] = useState(1)
  const [agreed, setAgreed] = useState(false)
  const [msg, setMsg] = useState<string>()
  const fileRef = useRef<HTMLInputElement>(null)

  const valid =
    agreed && !!birthYear && birthYear > 1920 && birthYear < 2015 && !!height && height > 120 && height < 230 && !!weight && weight > 30 && weight < 250

  const start = async () => {
    const now = new Date()
    await db.transaction('rw', [db.settings, db.programVersions, db.bodyLogs], async () => {
      const settings = await db.settings.get('singleton')
      await db.settings.where('id').equals('singleton').modify((s) => {
        s.profile.birthYear = birthYear
        s.profile.heightCm = height
        s.profile.startWeightKg = weight
        s.schedule.wake = wake
        s.schedule.bed = bed
        s.disclaimerAcceptedAt = now.toISOString()
      })
      const latest = await db.programVersions.orderBy('version').last()
      if (latest) {
        await db.programVersions.update(latest.version, {
          drinkingGoal: { ...latest.drinkingGoal, maxOccasionsPerWeek: occasions, maxPerOccasion: { drinkId: 'soju_bottle', count: perOccasion } },
        })
      }
      await db.bodyLogs.add({ id: newId(), date: logicalDate(now, settings?.dayBoundaryHour ?? 5), weightKg: weight, at: now.toISOString() })
    })
  }

  const restore = async (f: File) => {
    try {
      const file = parseBackup(await f.text())
      await importAll(db, file)
      const s = await db.settings.get('singleton')
      if (!s?.disclaimerAcceptedAt) setMsg('백업을 가져왔습니다. 아래 정보를 확인하고 시작하세요.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '가져오기에 실패했습니다.')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-bg">
      <div className="mx-auto max-w-md space-y-5 px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <h1 className="text-2xl font-bold">시작하기</h1>
        <div className="rounded-2xl border border-warn/50 bg-warn/10 p-4 text-sm font-semibold text-warn">{DISCLAIMER}</div>
        <p className="text-sm text-muted">아래 정보는 이 기기 안에만 저장되고, 에너지 필요량 계산과 기록 비교에 쓰입니다.</p>

        <div className="grid grid-cols-3 gap-3">
          <Field label="출생연도">
            <NumberInput value={birthYear} onChange={setBirthYear} step={1} placeholder="예: 1990" />
          </Field>
          <Field label="키 (cm)">
            <NumberInput value={height} onChange={setHeight} step={0.5} />
          </Field>
          <Field label="현재 체중 (kg)">
            <NumberInput value={weight} onChange={setWeight} step={0.1} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="보통 일어나는 시각">
            <input type="time" className={inputClass} value={wake} onChange={(e) => setWake(e.target.value)} />
          </Field>
          <Field label="보통 자는 시각">
            <input type="time" className={inputClass} value={bed} onChange={(e) => setBed(e.target.value)} />
          </Field>
        </div>

        <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
          <p className="font-semibold">내 음주 목표</p>
          <div>
            <p className="mb-1 text-sm text-muted">일주일에 몇 번 이하</p>
            <Stepper value={occasions} onChange={setOccasions} min={0} max={7} unit="회" />
          </div>
          <div>
            <p className="mb-1 text-sm text-muted">한 번에 소주 몇 병 이하</p>
            <Stepper value={perOccasion} onChange={setPerOccasion} step={0.5} min={0} max={5} unit="병" />
          </div>
          <p className="text-xs text-muted">설정 화면에서 언제든 바꿀 수 있습니다.</p>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          위 안내를 읽었습니다.
        </label>

        <Button variant="primary" size="lg" className="w-full" onClick={start} disabled={!valid}>
          시작
        </Button>

        <div className="border-t border-line pt-4 text-center">
          <button type="button" className="text-sm text-muted underline" onClick={() => fileRef.current?.click()}>
            다른 기기에서 내보낸 백업으로 시작하기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void restore(f)
              e.target.value = ''
            }}
          />
          {msg && <p className="mt-2 text-sm">{msg}</p>}
        </div>
      </div>
    </div>
  )
}
