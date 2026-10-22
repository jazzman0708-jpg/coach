import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// 홈 화면 앱은 오래 켜 둔 채로 다시 열리는 경우가 많아, 화면에 돌아올 때마다 새 버전을 확인한다
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => undefined)
    })
  },
})

// 브라우저가 저장 공간이 부족할 때 기록을 지우지 않도록 요청한다 (지원하는 브라우저만)
void navigator.storage?.persist?.().catch(() => undefined)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
