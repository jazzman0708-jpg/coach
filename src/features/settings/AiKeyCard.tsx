import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Badge, Button, Card, CardTitle, inputClass } from '../../components/ui'
import { db } from '../../db/db'
import { AI_MODEL } from '../../lib/aiMenu'

/** Claude API 키 (선택). 이 기기에만 저장하고 백업에도 넣지 않는다 */
export function AiKeyCard() {
  const saved = useLiveQuery(() => db.secrets.get('claudeApiKey'), [])
  const [value, setValue] = useState('')
  const has = !!saved?.value

  return (
    <Card>
      <CardTitle right={has ? <Badge tone="ok">등록됨</Badge> : <Badge>선택</Badge>}>AI 메뉴 생성 (Claude API 키)</CardTitle>
      <p className="mb-3 text-sm text-muted">
        키를 넣으면 식단 탭에서 냉장고 재료와 목표에 맞춘 한 주 저녁 메뉴·장보기 목록을 만들 수 있습니다. 키가 없어도 다른 기능은 모두 동작합니다.
        키는 이 기기에만 저장되고 백업 파일에도 들어가지 않습니다. 사용 요금은 키의 계정으로 청구됩니다 (모델 {AI_MODEL}).
      </p>
      {has ? (
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm text-muted">{saved!.value.slice(0, 10)}…{saved!.value.slice(-4)}</span>
          <Button size="sm" variant="danger" onClick={() => db.secrets.delete('claudeApiKey')}>
            키 삭제
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="password"
            autoComplete="off"
            className={inputClass}
            placeholder="sk-ant-…"
            value={value}
            onChange={(e) => setValue(e.target.value.trim())}
          />
          <Button
            variant="primary"
            disabled={!value.startsWith('sk-ant-')}
            onClick={async () => {
              await db.secrets.put({ key: 'claudeApiKey', value })
              setValue('')
            }}
          >
            저장
          </Button>
        </div>
      )}
    </Card>
  )
}
