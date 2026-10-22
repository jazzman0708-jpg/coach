import { useEffect, useRef, useState } from 'react'
import { Button, Card, CardTitle, Page, ProgressBar } from '../../components/ui'
import { useSettings } from '../../db/hooks'
import { beep, unlockAudio, useWakeLock, vibrate } from '../../lib/device'
import { formatClock, useNow } from '../../lib/time'

// 운동 기록과 상관없는 단독 타이머. 앱을 닫았다 열어도 이어지도록 시작 시각을 기기에 저장한다.
interface Rest {
  endAt: number
  total: number
}
interface Watch {
  startedAt: number
  pausedAt?: number
  pausedMs: number
  laps: number[]
}

const KEY = 'coach.timer.v1'

function load(): { rest?: Rest; watch?: Watch } {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

function save(state: { rest?: Rest; watch?: Watch }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // 저장 실패해도 화면 동작에는 문제없음
  }
}

export default function TimerPage() {
  const settings = useSettings()
  const [rest, setRest] = useState<Rest | undefined>(() => load().rest)
  const [watch, setWatch] = useState<Watch | undefined>(() => load().watch)
  const running = (!!rest && rest.endAt > Date.now()) || (!!watch && !watch.pausedAt)
  const now = useNow(100, running)
  useWakeLock(running)
  const fired = useRef<number | null>(null)

  useEffect(() => save({ rest, watch }), [rest, watch])

  const remaining = rest ? rest.endAt - now : 0
  useEffect(() => {
    if (rest && remaining <= 0 && fired.current !== rest.endAt) {
      fired.current = rest.endAt
      if (settings?.sound !== false) beep(3)
      if (settings?.vibration !== false) vibrate([250, 120, 250])
    }
  }, [rest, remaining, settings])

  const startRest = (sec: number) => {
    unlockAudio()
    setRest({ endAt: Date.now() + sec * 1000, total: sec * 1000 })
  }

  const elapsed = watch ? (watch.pausedAt ?? now) - watch.startedAt - watch.pausedMs : 0

  return (
    <Page title="타이머">
      <Card>
        <CardTitle>휴식 타이머</CardTitle>
        <p className="tabular my-4 text-center text-7xl font-bold">{formatClock(Math.max(0, remaining))}</p>
        {rest && <ProgressBar value={rest.total - Math.max(0, remaining)} max={rest.total} />}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[60, 90, 120].map((s) => (
            <Button key={s} size="lg" variant="primary" onClick={() => startRest(s)}>
              {s}초
            </Button>
          ))}
          <Button size="lg" onClick={() => rest && setRest({ endAt: Math.max(Date.now(), rest.endAt) + 15_000, total: rest.total + 15_000 })} disabled={!rest}>
            +15
          </Button>
        </div>
        {rest && (
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setRest(undefined)}>
            정지
          </Button>
        )}
      </Card>

      <Card>
        <CardTitle>스톱워치</CardTitle>
        <p className="tabular my-4 text-center text-6xl font-bold">{formatClock(elapsed, true)}</p>
        <div className="grid grid-cols-2 gap-3">
          {!watch ? (
            <Button variant="primary" size="lg" className="col-span-2" onClick={() => setWatch({ startedAt: Date.now(), pausedMs: 0, laps: [] })}>
              시작
            </Button>
          ) : (
            <>
              {watch.pausedAt ? (
                <Button variant="primary" size="lg" onClick={() => setWatch({ ...watch, pausedAt: undefined, pausedMs: watch.pausedMs + (Date.now() - watch.pausedAt!) })}>
                  재개
                </Button>
              ) : (
                <Button size="lg" onClick={() => setWatch({ ...watch, pausedAt: Date.now() })}>
                  일시정지
                </Button>
              )}
              {watch.pausedAt ? (
                <Button size="lg" variant="danger" onClick={() => setWatch(undefined)}>
                  초기화
                </Button>
              ) : (
                <Button size="lg" onClick={() => setWatch({ ...watch, laps: [...watch.laps, elapsed] })}>
                  랩
                </Button>
              )}
            </>
          )}
        </div>
        {watch && watch.laps.length > 0 && (
          <ol className="tabular mt-4 space-y-1 text-sm">
            {watch.laps
              .map((t, i) => ({ t, i, split: t - (watch.laps[i - 1] ?? 0) }))
              .reverse()
              .map(({ t, i, split }) => (
                <li key={i} className="flex justify-between border-b border-line py-1">
                  <span>랩 {i + 1}</span>
                  <span>
                    {formatClock(split, true)} <span className="text-muted">/ {formatClock(t, true)}</span>
                  </span>
                </li>
              ))}
          </ol>
        )}
      </Card>
      <p className="px-1 text-xs text-muted">
        화면이 꺼지거나 다른 앱으로 가면 소리가 나지 않을 수 있습니다. 시간은 시작 시각 기준이라 돌아오면 정확히 이어집니다.
      </p>
    </Page>
  )
}
