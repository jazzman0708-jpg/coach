// 웹 푸시 등록. 알림은 GitHub Actions 예약 실행(.github/workflows/push.yml)이 보낸다.
// 공개키는 공개돼도 되는 값이다. 짝이 되는 비밀키는 GitHub 비밀값(VAPID_PRIVATE_KEY)에만 있다.
export const VAPID_PUBLIC_KEY = 'BNJX3OxhHF02-sjsHX9VCfOImKExqLE4Mg-ubvZ4MRrC9yq0xKr328PrgcWgD7u4mJgLSXkfu007rsyqyEX10xk'

/** base64url 문자열 → 바이트 (pushManager.subscribe의 applicationServerKey 형식) */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export type PushSupport = 'ok' | 'needs-home-screen' | 'unsupported'

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported'
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent)
  // 아이폰은 홈 화면에 추가한 앱에서만 웹 푸시를 쓸 수 있다
  if (isIos && !standalone) return 'needs-home-screen'
  if (!('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return 'ok'
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** 사용자가 버튼을 누른 순간에 불러야 한다 (권한 요청은 탭 안에서만 허용됨) */
export async function subscribePush(): Promise<PushSubscription> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('알림 권한이 허용되지 않았습니다. 아이폰 설정 → 알림 → 코치에서 허용할 수 있습니다.')
  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) })
}

/** 등록 코드: GitHub 비밀값 PUSH_SUBSCRIPTION에 넣을 값 */
export const subscriptionCode = (sub: PushSubscription) => JSON.stringify(sub.toJSON())

export async function showTestNotification() {
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('알림 테스트', { body: '이 기기에서 알림을 받을 수 있습니다.', icon: 'icons/icon-192.png', tag: 'coach-test' })
}
