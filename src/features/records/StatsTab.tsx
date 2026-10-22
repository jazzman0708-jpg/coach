import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { ChartCard, ColumnChart, LineChart } from '../../components/charts'
import { Card, CardTitle, Segmented, inputClass } from '../../components/ui'
import { EXERCISES, MUSCLE_LABEL } from '../../data/exercises'
import type { Rules } from '../../data/rules'
import { db } from '../../db/db'
import { drinkLimits } from '../../engine/alcohol'
import { goalPriority } from '../../engine/balance'
import { addDays, daysBetween, formatKoreanDate, parseLocalDate } from '../../engine/day'
import { bestRecords, shoulderWaistRatio, waistPoints, weeklyAverage, weeklyRows, weightPoints } from '../../engine/stats'
import type { LocalDate, Muscle, Photo, PhotoAngle, Settings } from '../../engine/types'

type Range = '4' | '12' | 'all'
const md = (d: LocalDate) => {
  const x = parseLocalDate(d)
  return `${x.getMonth() + 1}/${x.getDate()}`
}

export function StatsTab({ today, settings, rules }: { today: LocalDate; settings: Settings; rules: Rules }) {
  const [range, setRange] = useState<Range>('12')
  const [muscle, setMuscle] = useState<Muscle>('delt_side')
  const body = useLiveQuery(() => db.bodyLogs.toArray(), []) ?? []
  const monthly = useLiveQuery(() => db.monthly.toArray(), []) ?? []
  const sessions = useLiveQuery(() => db.sessions.toArray(), []) ?? []
  const drinks = useLiveQuery(() => db.drinkLogs.toArray(), []) ?? []
  const sleep = useLiveQuery(() => db.sleepLogs.toArray(), []) ?? []

  const firstDate = [...body, ...sessions, ...sleep].map((x) => x.date).sort()[0] ?? today
  const weeks = range === 'all' ? Math.min(52, Math.max(4, Math.ceil(daysBetween(firstDate, today) / 7) + 1)) : Number(range)
  const from = addDays(today, -7 * weeks + 1)

  const weight = weightPoints(body, from)
  const weekly = weeklyRows({ today, weeks, sessions, drinks, sleep, rules })
  const labels = weekly.map((w) => md(w.week))
  const priority = goalPriority(settings)
  const [low] = rules.strength.weeklySetsPriority.value ?? [5, 10]
  const maintain = rules.strength.weeklySetsMaintain.value ?? 4
  const muscleTarget = priority[muscle] === 'priority' ? low : priority[muscle] === 'maintain' ? maintain : undefined
  const limits = drinkLimits(settings.profile.alcoholFlush, rules)
  const [cardioTarget] = rules.cardio.weeklyModerateMin.value ?? [150, 300]
  const minSleep = rules.sleep.minHours.value ?? 7
  const waist = waistPoints(body, monthly, from)
  const ratio = shoulderWaistRatio(monthly)
  const records = bestRecords(sessions)

  return (
    <div className="space-y-3">
      <Segmented<Range>
        value={range}
        onChange={setRange}
        options={[
          { value: '4', label: '4주' },
          { value: '12', label: '12주' },
          { value: 'all', label: '전체' },
        ]}
      />

      <ChartCard title="체중 (kg)" table={{ head: ['날짜', '체중'], rows: weight.map((p) => [p.x, p.y.toFixed(1)]) }}>
        <LineChart
          unit=" kg"
          series={[
            { name: '주 평균', color: 'series-1', style: 'line', points: weeklyAverage(weight).map((p) => ({ x: p.x, y: Math.round(p.y * 10) / 10 })) },
            { name: '매일', color: 'series-2', style: 'dots', points: weight },
          ]}
        />
      </ChartCard>

      <ChartCard title="허리둘레 (cm)" table={{ head: ['날짜', '허리'], rows: waist.map((p) => [p.x, p.y.toFixed(1)]) }}>
        <LineChart unit=" cm" series={[{ name: '허리', color: 'series-1', style: 'line', points: waist }]} />
      </ChartCard>

      <ChartCard title="어깨 ÷ 허리 비율" table={{ head: ['날짜', '비율'], rows: ratio.map((p) => [p.x, p.y.toFixed(2)]) }}>
        <LineChart unit="" decimals={2} series={[{ name: '어깨÷허리', color: 'series-1', style: 'line', points: ratio }]} />
        <p className="mt-1 text-xs text-muted">월간 측정의 어깨·허리 둘레로 계산합니다. 커질수록 어깨가 넓어 보이는 비율입니다.</p>
      </ChartCard>

      <ChartCard
        title="부위별 주간 세트"
        right={
          <select className="rounded-lg border border-line bg-soft px-2 py-1 text-xs" value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle)}>
            {(Object.keys(MUSCLE_LABEL) as Muscle[]).map((m) => (
              <option key={m} value={m}>
                {MUSCLE_LABEL[m]}
              </option>
            ))}
          </select>
        }
        table={{ head: ['주', '세트'], rows: weekly.map((w) => [w.week, w.sets[muscle]]) }}
      >
        <ColumnChart
          unit="세트"
          decimals={1}
          data={weekly.map((w, i) => ({ label: labels[i], value: w.sets[muscle] }))}
          target={muscleTarget ? { value: muscleTarget, label: `${muscleTarget}세트` } : undefined}
        />
      </ChartCard>

      <ChartCard title="유산소 (주간, 중강도 환산 분)" table={{ head: ['주', '분'], rows: weekly.map((w) => [w.week, w.cardioMin]) }}>
        <ColumnChart unit="분" data={weekly.map((w, i) => ({ label: labels[i], value: w.cardioMin }))} target={{ value: cardioTarget, label: `${cardioTarget}분` }} />
      </ChartCard>

      <ChartCard title="음주 (주간 표준잔)" table={{ head: ['주', '잔'], rows: weekly.map((w) => [w.week, w.drinks.toFixed(1)]) }}>
        <ColumnChart unit="잔" decimals={1} data={weekly.map((w, i) => ({ label: labels[i], value: w.drinks }))} target={{ value: limits.weekly, label: `${limits.weekly}잔` }} />
      </ChartCard>

      <ChartCard title="수면 (주 평균 시간)" table={{ head: ['주', '시간'], rows: weekly.map((w) => [w.week, w.avgSleep?.toFixed(1) ?? '-']) }}>
        <ColumnChart unit="시간" decimals={1} data={weekly.map((w, i) => ({ label: labels[i], value: w.avgSleep }))} target={{ value: minSleep, label: `${minSleep}시간` }} />
      </ChartCard>

      <Card>
        <CardTitle>종목별 최고 기록</CardTitle>
        {records.length === 0 && <p className="text-sm text-muted">아직 기록이 없습니다.</p>}
        <table className="tabular w-full text-sm">
          {records.length > 0 && (
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 font-medium">종목</th>
                <th className="py-1 font-medium">한 세트</th>
                <th className="py-1 font-medium">한 세션 합계</th>
              </tr>
            </thead>
          )}
          <tbody>
            {records.map((r) => {
              const ex = EXERCISES[r.exerciseId]
              const unit = ex?.metric === 'seconds' ? '초' : '회'
              return (
                <tr key={r.exerciseId} className="border-t border-line align-top">
                  <td className="py-1.5 pr-2">
                    {ex?.name}
                    <span className="block text-xs text-muted">{r.sessions}회 기록</span>
                  </td>
                  <td className="py-1.5">
                    {r.bestSet}
                    {unit}
                    <span className="block text-xs text-muted">{md(r.bestSetDate)}</span>
                  </td>
                  <td className="py-1.5">
                    {r.bestTotal}
                    {unit}
                    <span className="block text-xs text-muted">{md(r.bestTotalDate)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <PhotoCompare />
    </div>
  )
}

const ANGLES: { value: PhotoAngle; label: string }[] = [
  { value: 'front', label: '정면' },
  { value: 'side', label: '측면' },
  { value: 'back', label: '후면' },
]

function PhotoView({ photo }: { photo: Photo | undefined }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!photo) return setUrl(undefined)
    const u = URL.createObjectURL(photo.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo])
  return url ? <img src={url} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" /> : <div className="aspect-[3/4] rounded-lg bg-soft" />
}

/** 같은 각도의 사진 두 장을 나란히 */
function PhotoCompare() {
  const [angle, setAngle] = useState<PhotoAngle>('front')
  const photos = (useLiveQuery(() => db.photos.toArray(), []) ?? []).filter((p) => p.angle === angle).sort((a, b) => a.date.localeCompare(b.date))
  const [a, setA] = useState<string>()
  const [b, setB] = useState<string>()
  const left = photos.find((p) => p.id === a) ?? photos[0]
  const right = photos.find((p) => p.id === b) ?? photos.at(-1)

  return (
    <Card>
      <CardTitle>사진 비교</CardTitle>
      <Segmented value={angle} onChange={(v) => { setAngle(v); setA(undefined); setB(undefined) }} options={ANGLES} />
      {photos.length < 2 ? (
        <p className="mt-3 text-sm text-muted">같은 각도의 사진이 두 장 이상 있어야 비교할 수 있습니다. (기록 → 월간)</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            [left, setA],
            [right, setB],
          ].map(([p, set], i) => (
            <div key={i} className="space-y-1">
              <select className={`${inputClass} py-1.5 text-sm`} value={(p as Photo | undefined)?.id} onChange={(e) => (set as (v: string) => void)(e.target.value)}>
                {photos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {formatKoreanDate(x.date)}
                  </option>
                ))}
              </select>
              <PhotoView photo={p as Photo | undefined} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
