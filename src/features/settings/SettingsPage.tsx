import { useRef, useState } from 'react'
import { BasisView } from '../../components/Why'
import { Badge, Button, Card, CardTitle, Field, Loading, NumberInput, Page, Segmented, Sheet, Stepper, inputClass } from '../../components/ui'
import { EVIDENCE } from '../../data/evidence'
import { EQUIPMENT_LABEL } from '../../data/exercises'
import { db } from '../../db/db'
import { exportAll, importAll, parseBackup, resetAll } from '../../db/backup'
import { updateSettings, useProgram, useSettings } from '../../db/hooks'
import type { Equipment, Schedule, Settings } from '../../engine/types'
import { canVibrate, canWakeLock } from '../../lib/device'

export const DISCLAIMER = '의학적 진단·치료를 대신하지 않습니다. 통증·질환이 있으면 전문의와 상담하세요.'

const SCHEDULE_LABEL: Record<keyof Schedule, string> = {
  wake: '기상',
  meal1: '첫 끼',
  workout: '운동',
  postWorkout: '운동 후 단백질',
  meal2: '둘째 끼',
  snack: '간식',
  bed: '취침',
}

export default function SettingsPage() {
  const settings = useSettings()
  const program = useProgram()
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  if (!settings || !program) return <Loading />
  const set = (fn: (s: Settings) => void) => updateSettings(fn)

  return (
    <Page title="설정">
      <Card className="border-warn/50 bg-warn/10">
        <p className="text-sm font-semibold text-warn">{DISCLAIMER}</p>
      </Card>

      <Card>
        <CardTitle>신체 정보</CardTitle>
        <div className="space-y-3">
          <Field label="출생연도">
            <NumberInput value={settings.profile.birthYear} onChange={(v) => v && set((s) => void (s.profile.birthYear = v))} step={1} />
          </Field>
          <Field label="생년월일 (선택)" hint="나이 계산(에너지 필요량)에 씁니다. 비워두면 출생연도로 계산합니다.">
            <input
              type="date"
              className={inputClass}
              value={settings.profile.birthDate ?? ''}
              onChange={(e) => set((s) => void (s.profile.birthDate = e.target.value || undefined))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="키 (cm)">
              <NumberInput value={settings.profile.heightCm} onChange={(v) => v && set((s) => void (s.profile.heightCm = v))} step={0.5} />
            </Field>
            <Field label="시작 체중 (kg)">
              <NumberInput value={settings.profile.startWeightKg} onChange={(v) => v && set((s) => void (s.profile.startWeightKg = v))} />
            </Field>
          </div>
          <Field label="본업의 일상 활동">
            <Segmented
              value={settings.profile.dailyActivity}
              onChange={(v) => set((s) => void (s.profile.dailyActivity = v))}
              options={[
                { value: 'mostly_sitting', label: '주로 앉아서' },
                { value: 'mixed', label: '반반' },
                { value: 'mostly_standing', label: '서서·움직이며' },
              ]}
            />
          </Field>
          <Field label="술 마시면 얼굴이 빨개지나요?" hint="빨개지면 적정 음주 기준이 절반(주 4잔, 1회 1.5잔)이 됩니다.">
            <Segmented
              value={settings.profile.alcoholFlush === undefined ? 'unknown' : settings.profile.alcoholFlush ? 'yes' : 'no'}
              onChange={(v) => set((s) => void (s.profile.alcoholFlush = v === 'unknown' ? undefined : v === 'yes'))}
              options={[
                { value: 'unknown', label: '모름' },
                { value: 'yes', label: '예' },
                { value: 'no', label: '아니오' },
              ]}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>내 음주 목표</CardTitle>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm text-muted">일주일에 몇 번 이하</p>
            <Stepper
              value={program.drinkingGoal.maxOccasionsPerWeek}
              min={0}
              max={7}
              unit="회"
              onChange={(v) => db.programVersions.update(program.version, { drinkingGoal: { ...program.drinkingGoal, maxOccasionsPerWeek: v } })}
            />
          </div>
          <div>
            <p className="mb-1 text-sm text-muted">한 번에 소주 몇 병 이하</p>
            <Stepper
              value={program.drinkingGoal.maxPerOccasion.count}
              step={0.5}
              min={0}
              max={5}
              unit="병"
              onChange={(v) =>
                db.programVersions.update(program.version, {
                  drinkingGoal: { ...program.drinkingGoal, maxPerOccasion: { ...program.drinkingGoal.maxPerOccasion, count: v } },
                })
              }
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>장비</CardTitle>
        <p className="mb-3 text-sm text-muted">가진 장비 안에서만 종목을 고릅니다. 밴드나 덤벨이 생기면 켜세요.</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => {
            const on = settings.equipment.includes(e)
            return (
              <button
                key={e}
                type="button"
                onClick={() => set((s) => void (s.equipment = on ? s.equipment.filter((x) => x !== e) : [...s.equipment, e]))}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-soft text-muted'}`}
              >
                {EQUIPMENT_LABEL[e]}
              </button>
            )
          })}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={!!settings.tableChecked} onChange={(e) => set((s) => void (s.tableChecked = e.target.checked))} />
          식탁이 매달려 당겨도 들리거나 밀리지 않는 것을 확인함
        </label>
      </Card>

      <Card>
        <CardTitle>일정</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(SCHEDULE_LABEL) as (keyof Schedule)[]).map((k) => (
            <Field key={k} label={SCHEDULE_LABEL[k]}>
              <input type="time" className={inputClass} value={settings.schedule[k]} onChange={(e) => set((s) => void (s.schedule[k] = e.target.value))} />
            </Field>
          ))}
          <Field label="하루가 바뀌는 시각" hint="이 시각 전 기록은 전날로 봅니다.">
            <select className={inputClass} value={settings.dayBoundaryHour} onChange={(e) => set((s) => void (s.dayBoundaryHour = Number(e.target.value)))}>
              {[3, 4, 5, 6, 7].map((h) => (
                <option key={h} value={h}>
                  새벽 {h}시
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>알림·소리</CardTitle>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={settings.sound} onChange={(e) => set((s) => void (s.sound = e.target.checked))} />
            타이머 소리
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={settings.vibration} onChange={(e) => set((s) => void (s.vibration = e.target.checked))} />
            진동 {!canVibrate() && <Badge tone="warn">이 기기는 미지원</Badge>}
          </label>
          <p className="text-muted">
            화면 꺼짐 방지: {canWakeLock() ? '지원됨 (운동 중 자동)' : '미지원 — 운동 중에는 기기의 자동 잠금을 꺼 두세요'}
          </p>
          <p className="text-muted">정시 알림(끼니·운동 시간)은 5단계에서 추가합니다.</p>
        </div>
      </Card>

      <DataCard />

      <Card>
        <CardTitle>근거 출처</CardTitle>
        <p className="mb-3 text-sm text-muted">앱의 모든 기준이 어디서 왔는지 볼 수 있습니다. ({Object.keys(EVIDENCE).length}개)</p>
        <Button className="w-full" onClick={() => setEvidenceOpen(true)}>
          전체 보기
        </Button>
      </Card>

      <p className="px-1 text-xs text-muted">현재 프로그램 버전 {program.version} · {program.effectiveFrom}부터</p>

      <Sheet open={evidenceOpen} onClose={() => setEvidenceOpen(false)} title="근거 출처 전체">
        <div className="space-y-4">
          {Object.values(EVIDENCE).map((s) => (
            <BasisView key={s.id} basis={{ type: 'evidence', refs: Object.keys(s.claims).map((k) => `${s.id}#${k}` as const) }} />
          ))}
        </div>
      </Sheet>
    </Page>
  )
}

function DataCard() {
  const [withPhotos, setWithPhotos] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string>()
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = async () => {
    setBusy(true)
    try {
      const now = new Date()
      const file = await exportAll(db, { includePhotos: withPhotos, now })
      const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `coach-backup-${now.toISOString().slice(0, 10)}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setMsg(`내보냈습니다 (${(blob.size / 1024 / 1024).toFixed(1)} MB).`)
    } finally {
      setBusy(false)
    }
  }

  const doImport = async (f: File) => {
    try {
      const file = parseBackup(await f.text())
      if (!confirm(`${file.exportedAt.slice(0, 10)} 백업으로 지금 데이터를 덮어쓸까요? 되돌릴 수 없습니다.`)) return
      setBusy(true)
      await importAll(db, file)
      setMsg('가져왔습니다.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '가져오기에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const doReset = async () => {
    if (prompt('모든 기록이 지워집니다. 계속하려면 "초기화"라고 입력하세요.') !== '초기화') return
    await resetAll(db)
    setMsg('초기화했습니다.')
  }

  return (
    <Card>
      <CardTitle>데이터</CardTitle>
      <p className="mb-3 text-sm text-muted">
        기록은 이 기기 안에만 있습니다. 아이폰과 맥은 서로 동기화되지 않으니, 주기적으로 내보내 두세요.
      </p>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} />
        사진 포함
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={doExport} disabled={busy}>
          내보내기
        </Button>
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          가져오기
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void doImport(f)
          e.target.value = ''
        }}
      />
      <Button variant="danger" className="mt-2 w-full" onClick={doReset} disabled={busy}>
        초기화
      </Button>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </Card>
  )
}
