import { z } from 'zod'
import type { AiDinner, LocalDate } from '../engine/types'

// AI 주간 메뉴 생성 (선택 기능). 브라우저에서 사용자의 API 키로 Claude API를 직접 부른다.
// AI는 "메뉴 이름·식재료와 g·양념·조리 순서"만 정한다. 칼로리·단백질은 앱이 식품성분 표로 다시 계산하고
// 목표치는 규칙 엔진이 정한 값을 그대로 보여 줄 뿐 AI가 바꾸지 않는다.

export const AI_MODEL = 'claude-opus-5-5'

export interface MenuRequest {
  apiKey: string
  dates: LocalDate[]
  /** 규칙 엔진이 정한 둘째 끼 목표 (하루 목표 − 고정 끼니) */
  target: { kcal: number; proteinG: number; fatG: number }
  foods: { id: string; name: string; keepsLong?: boolean }[]
  pantry: { name: string; qty: number; unit: string }[]
  /** 최근에 먹은 저녁 메뉴 (중복 줄이기) */
  recent: string[]
}

const dinnerSchema = (foodIds: string[]) =>
  z.object({
    date: z.string(),
    name: z.string(),
    ingredients: z.array(z.object({ food: z.enum(foodIds as [string, ...string[]]), grams: z.number().positive() })),
    seasonings: z.array(z.string()),
    steps: z.array(z.string()),
  })

function jsonSchema(foodIds: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['dinners'],
    properties: {
      dinners: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['date', 'name', 'ingredients', 'seasonings', 'steps'],
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD' },
            name: { type: 'string', description: '한국어 메뉴 이름' },
            ingredients: {
              type: 'array',
              description: '1인분 식재료. 반드시 목록의 id만 사용',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['food', 'grams'],
                properties: { food: { type: 'string', enum: foodIds }, grams: { type: 'number' } },
              },
            },
            seasonings: { type: 'array', items: { type: 'string' }, description: '소금·후추·간장 외 양념 (영양 계산 제외)' },
            steps: { type: 'array', items: { type: 'string' }, description: '짧은 조리 순서 3~5개' },
          },
        },
      },
    },
  }
}

const SYSTEM = `너는 한국 가정식 저녁 메뉴를 짜는 영양사 보조다.
사용자의 앱이 정한 목표 칼로리·단백질·지방 범위에 맞춰 1인분 저녁 메뉴를 날짜별로 하나씩 만든다.
규칙:
- 식재료는 주어진 목록의 id만 쓴다. 목록에 없는 재료가 꼭 필요하면 양념(seasonings)에만 적는다.
- 잡곡밥을 곁들일 때는 multigrain_rice를 식재료에 넣는다.
- 같은 메뉴는 일주일에 두 번을 넘기지 않는다. 최근에 먹은 메뉴와도 겹치지 않게 한다.
- 오래 보관되는 채소(양배추·당근·양파·무)와 냉장고에 있는 재료를 먼저 쓴다.
- 조리 순서는 직접 쓴 짧은 문장 3~5개로, 다른 사이트의 글을 옮기지 않는다.
- 숫자 목표는 앱이 정한 것이다. 바꾸거나 다른 목표를 제안하지 말고 맞추는 데만 집중한다.`

export class AiMenuError extends Error {}

export async function generateDinners(req: MenuRequest): Promise<{ dinners: AiDinner[]; model: string }> {
  // SDK는 메뉴를 만들 때만 불러온다 (앱 첫 화면을 가볍게)
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: req.apiKey, dangerouslyAllowBrowser: true })
  const foodIds = req.foods.map((f) => f.id)

  const user = [
    `날짜: ${req.dates.join(', ')}`,
    `저녁 1인분 목표: ${req.target.kcal} kcal 안팎, 단백질 ${req.target.proteinG} g 이상, 지방 ${req.target.fatG} g 이하`,
    `식재료 목록 (id: 이름): ${req.foods.map((f) => `${f.id}: ${f.name}${f.keepsLong ? '(오래감)' : ''}`).join(', ')}`,
    `냉장고에 있는 재료: ${req.pantry.length ? req.pantry.map((p) => `${p.name} ${p.qty}${p.unit}`).join(', ') : '없음'}`,
    `최근 먹은 저녁: ${req.recent.length ? req.recent.join(', ') : '없음'}`,
  ].join('\n')

  try {
    const res = await client.beta.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      // 안전 분류기가 거절하면 서버가 알맞은 모델로 다시 시도한다
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: jsonSchema(foodIds) } },
      system: SYSTEM,
      messages: [{ role: 'user', content: user }],
    })
    if (res.stop_reason === 'refusal') throw new AiMenuError('AI가 요청을 처리하지 않았습니다. 잠시 후 다시 시도하세요.')
    if (res.stop_reason === 'max_tokens') throw new AiMenuError('AI 응답이 너무 길어 잘렸습니다. 다시 시도하세요.')
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    const parsed = z.object({ dinners: z.array(dinnerSchema(foodIds)) }).safeParse(JSON.parse(text))
    if (!parsed.success) throw new AiMenuError('AI 응답 형식이 맞지 않습니다. 다시 시도하세요.')
    const wanted = new Set(req.dates)
    return { dinners: parsed.data.dinners.filter((d) => wanted.has(d.date)), model: res.model }
  } catch (e) {
    if (e instanceof AiMenuError) throw e
    if (e instanceof Anthropic.AuthenticationError) throw new AiMenuError('API 키가 올바르지 않습니다. 설정에서 다시 넣어 주세요.')
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiMenuError('이 API 키로는 이 모델을 쓸 수 없습니다.')
    if (e instanceof Anthropic.RateLimitError) throw new AiMenuError('요청이 많아 잠시 막혔습니다. 1분 뒤 다시 시도하세요.')
    if (e instanceof Anthropic.APIConnectionError) throw new AiMenuError('인터넷 연결을 확인하세요.')
    if (e instanceof Anthropic.APIError) throw new AiMenuError(`Claude API 오류 (${e.status ?? '알 수 없음'})`)
    if (e instanceof SyntaxError) throw new AiMenuError('AI 응답을 읽지 못했습니다. 다시 시도하세요.')
    throw e
  }
}
