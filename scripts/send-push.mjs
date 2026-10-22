// GitHub Actions(.github/workflows/push.yml)에서 실행: 등록된 기기에 웹 푸시 알림을 보낸다.
// 필요한 환경 변수: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SUBSCRIPTION(등록 코드 하나 또는 배열), KIND(sleep|workout), APP_URL
import webpush from 'web-push'

const MESSAGES = {
  sleep: { title: '수면 기록할 시간이에요', body: '어젯밤 잠든 시각과 일어난 시각을 기록하세요.', url: './#/', tag: 'sleep' },
  workout: { title: '운동할 시간이에요', body: '오늘 운동을 시작하세요. 휴식일이면 이 알림은 넘기세요.', url: './#/workout', tag: 'workout' },
}

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SUBSCRIPTION, KIND, APP_URL } = process.env
const message = MESSAGES[KIND]
if (!message) {
  console.error(`알 수 없는 알림 종류: ${KIND}`)
  process.exit(1)
}
if (!PUSH_SUBSCRIPTION) {
  console.log('PUSH_SUBSCRIPTION 비밀값이 아직 없어 보내지 않았습니다.')
  process.exit(0)
}

webpush.setVapidDetails(APP_URL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
const parsed = JSON.parse(PUSH_SUBSCRIPTION)
const subscriptions = Array.isArray(parsed) ? parsed : [parsed]

let failed = 0
for (const [i, sub] of subscriptions.entries()) {
  try {
    const res = await webpush.sendNotification(sub, JSON.stringify(message), { TTL: 3 * 3600, urgency: 'high' })
    console.log(`기기 ${i + 1}: 보냄 (${res.statusCode})`)
  } catch (e) {
    failed++
    const expired = e.statusCode === 404 || e.statusCode === 410
    console.error(`기기 ${i + 1}: 실패 (${e.statusCode ?? e.message})${expired ? ' — 등록이 만료됐습니다. 앱에서 알림을 다시 켜고 새 등록 코드를 등록하세요.' : ''}`)
  }
}
process.exit(failed === subscriptions.length ? 1 : 0)
