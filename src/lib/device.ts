// 소리·진동·화면 꺼짐 방지. 지원하지 않는 기기에서는 조용히 넘어간다.
import { useEffect } from 'react'

let ctx: AudioContext | null = null

/** iOS는 사용자 탭 안에서 한 번 열어야 이후 소리가 난다. 운동 시작 버튼에서 호출한다. */
export function unlockAudio() {
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null
  }
}

export function beep(times = 1, freq = 880, ms = 160) {
  try {
    if (!ctx) return
    const start = ctx.currentTime
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.25, start + i * 0.28)
      gain.gain.exponentialRampToValueAtTime(0.001, start + i * 0.28 + ms / 1000)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start + i * 0.28)
      osc.stop(start + i * 0.28 + ms / 1000)
    }
  } catch {
    // 소리 실패는 무시
  }
}

/** iOS Safari는 진동 API가 없다 → 아무 일도 일어나지 않는다 */
export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // 무시
  }
}

export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator
export const canWakeLock = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator

/** active인 동안 화면이 꺼지지 않게 한다. 앱이 다시 보일 때 다시 요청한다. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !canWakeLock()) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock.release()
      } catch {
        lock = null
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}
