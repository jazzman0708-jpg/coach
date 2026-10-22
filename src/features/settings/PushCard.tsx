import { useEffect, useState } from 'react'
import { Badge, Button, Card, CardTitle } from '../../components/ui'
import { currentSubscription, pushSupport, showTestNotification, subscribePush, subscriptionCode } from '../../lib/push'

/** 앱이 닫혀 있을 때 받는 휴대폰 알림(웹 푸시) 켜기 */
export function PushCard() {
  const support = pushSupport()
  const [code, setCode] = useState<string>()
  const [msg, setMsg] = useState<string>()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (support !== 'ok') return
    currentSubscription()
      .then((s) => s && setCode(subscriptionCode(s)))
      .catch(() => undefined)
  }, [support])

  const enable = async () => {
    setBusy(true)
    setMsg(undefined)
    try {
      const sub = await subscribePush()
      setCode(subscriptionCode(sub))
      setMsg('알림이 켜졌습니다. 아래 등록 코드를 복사해 보내 주세요.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '알림을 켜지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setMsg('복사했습니다.')
    } catch {
      setMsg('복사하지 못했습니다. 아래 칸을 길게 눌러 전체 선택 후 복사하세요.')
    }
  }

  const share = async () => {
    if (!code) return
    try {
      await navigator.share({ text: code })
    } catch {
      // 사용자가 공유를 닫은 경우
    }
  }

  return (
    <Card>
      <CardTitle right={code ? <Badge tone="ok">켜짐</Badge> : undefined}>휴대폰 알림 (앱이 닫혀 있을 때)</CardTitle>
      <p className="mb-3 text-sm text-muted">
        매일 11:00 수면 기록, 월~토 14:30 운동 알림을 보냅니다. GitHub 예약 실행으로 보내서 몇 분에서 수십 분 늦게 올 수 있습니다.
      </p>
      {support === 'needs-home-screen' && (
        <p className="text-sm text-warn">아이폰에서는 Safari 탭이 아니라, 홈 화면에 추가한 '코치' 앱에서 켤 수 있습니다.</p>
      )}
      {support === 'unsupported' && <p className="text-sm text-warn">이 기기·브라우저는 웹 푸시 알림을 지원하지 않습니다.</p>}
      {support === 'ok' && (
        <div className="space-y-3">
          {!code && (
            <Button variant="primary" className="w-full" onClick={enable} disabled={busy}>
              {busy ? '켜는 중…' : '휴대폰 알림 켜기'}
            </Button>
          )}
          {code && (
            <>
              <p className="text-sm">이 기기의 등록 코드입니다. GitHub에 등록해야 알림이 옵니다.</p>
              <textarea readOnly value={code} rows={4} className="w-full rounded-xl border border-line bg-soft p-2 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="primary" onClick={copy}>
                  복사
                </Button>
                <Button size="sm" onClick={share}>
                  공유
                </Button>
                <Button size="sm" onClick={() => showTestNotification().catch((e) => setMsg(String(e)))}>
                  테스트
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </Card>
  )
}
