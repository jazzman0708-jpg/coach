// 메뉴별 레시피. 재료·조리 순서는 앱이 프로그램 1인분에 맞춰 직접 정리한 요약이고,
// 자세한 방법은 sources의 원본 레시피(만개의 레시피·유튜브)를 연다. 원본 글은 옮겨 싣지 않는다.

export interface RecipeSource {
  site: '만개의 레시피' | 'YouTube'
  title: string
  author: string
  url: string
}

export interface Recipe {
  id: string
  name: string
  /** 메뉴 문구에 이 말이 들어 있으면 이 레시피를 연결한다 */
  match: string[]
  ingredients: { name: string; amount: string }[]
  steps: string[]
  tips?: string[]
  sources: RecipeSource[]
}

export const RECIPES: Recipe[] = [
  {
    id: 'aglio_olio',
    name: '새우 알리오 올리오 + 반숙 계란',
    match: ['알리오 올리오'],
    ingredients: [
      { name: '스파게티면', amount: '80 g' },
      { name: '새우(손질된 것)', amount: '150 g' },
      { name: '마늘', amount: '4~5쪽' },
      { name: '올리브유', amount: '1큰술' },
      { name: '계란', amount: '1개' },
      { name: '페페론치노 또는 건고추', amount: '약간 (선택)' },
      { name: '소금·후추', amount: '약간' },
    ],
    steps: [
      '끓는 물에 소금을 넣고 면을 포장지 시간보다 1분 짧게 삶는다. 면 삶은 물은 반 컵 남겨 둔다.',
      '다른 냄비에서 계란을 6~7분 삶아 찬물에 식혀 반숙을 만든다.',
      '팬에 올리브유와 편 썬 마늘을 넣고 약불에서 마늘이 노릇해질 때까지 향을 낸다.',
      '새우와 고추를 넣고 새우 색이 변할 때까지 볶는다.',
      '면과 면 삶은 물 2~3큰술을 넣고 섞어 소스가 면에 붙게 볶은 뒤 소금·후추로 간한다.',
      '접시에 담고 반숙 계란을 올린다.',
    ],
    tips: ['올리브유는 계량해서 1큰술만 쓴다 (지방 목표).', '냉동 새우는 전날 냉장실에서 해동해 두면 편하다.'],
    sources: [
      { site: '만개의 레시피', title: '새우 알리오 올리오 레시피 새우 오일 파스타 만들기', author: '매들린', url: 'https://www.10000recipe.com/recipe/7020632' },
      { site: 'YouTube', title: '개운한 풍미 가득한 새우 알리오올리오 파스타', author: 'SBS STORY', url: 'https://www.youtube.com/watch?v=HfFUPj_VT5s' },
    ],
  },
  {
    id: 'boiled_eggs',
    name: '삶은 계란 (운동 후 단백질)',
    match: ['삶은 계란'],
    ingredients: [
      { name: '계란', amount: '2개' },
      { name: '우유', amount: '300 mL (곁들임)' },
    ],
    steps: [
      '냄비에 계란이 잠길 만큼 물을 붓고 끓인다.',
      '물이 끓으면 계란을 넣고, 반숙은 6~7분, 완숙은 10~12분 삶는다.',
      '바로 찬물에 담가 식히면 껍질이 잘 벗겨진다.',
    ],
    tips: ['한 번에 여러 개 삶아 껍질째 냉장 보관해 두면 운동 후 바로 먹을 수 있다.'],
    sources: [
      { site: '만개의 레시피', title: '반숙계란, 완숙계란 삶는법', author: '해블랑', url: 'https://www.10000recipe.com/recipe/6850255' },
      { site: 'YouTube', title: '달걀삶는법 [만개의노하우]', author: '만개의레시피 10K Recipe', url: 'https://www.youtube.com/watch?v=xRXoPbCLIYQ' },
    ],
  },
  {
    id: 'beef_cabbage',
    name: '우삼겹 양배추 볶음',
    match: ['양배추 볶음'],
    ingredients: [
      { name: '우삼겹', amount: '100 g' },
      { name: '양배추', amount: '200 g' },
      { name: '양파', amount: '1/4개' },
      { name: '대파', amount: '약간' },
      { name: '간장', amount: '1큰술' },
      { name: '다진 마늘', amount: '1작은술' },
      { name: '후추', amount: '약간' },
    ],
    steps: [
      '양배추·양파는 한입 크기로 썬다.',
      '기름 없이 달군 팬에 우삼겹을 볶아 기름이 나오면 키친타월로 기름을 덜어 낸다.',
      '양파와 양배추를 넣고 숨이 죽을 때까지 센 불에서 볶는다.',
      '간장·다진 마늘·후추로 간하고 대파를 넣어 마무리한다.',
    ],
    tips: ['우삼겹은 지방이 많은 부위라 볶으면서 나온 기름을 덜어 내면 지방이 줄어든다.', '잡곡밥과 곁들인다.'],
    sources: [
      { site: '만개의 레시피', title: '우삼겹양배추볶음 만드는법', author: '라피네', url: 'https://www.10000recipe.com/recipe/6983884' },
    ],
  },
  {
    id: 'saury_radish',
    name: '꽁치 무조림 + 두부',
    match: ['꽁치'],
    ingredients: [
      { name: '꽁치 통조림', amount: '1/2캔 (또는 손질 꽁치 1마리)' },
      { name: '무', amount: '150 g' },
      { name: '두부', amount: '1/2모 (약 150 g)' },
      { name: '양파', amount: '1/4개' },
      { name: '대파', amount: '약간' },
      { name: '간장', amount: '1큰술' },
      { name: '고춧가루', amount: '1큰술' },
      { name: '다진 마늘', amount: '1작은술' },
      { name: '물', amount: '1컵' },
    ],
    steps: [
      '무를 1 cm 두께로 썰어 냄비 바닥에 깐다.',
      '물과 양념(간장·고춧가루·다진 마늘)을 넣고 무가 반쯤 익을 때까지 끓인다.',
      '꽁치·두부·양파를 올리고 양념 국물을 끼얹어 가며 중약불에서 국물이 자작해질 때까지 조린다.',
      '대파를 넣고 불을 끈다.',
    ],
    tips: ['통조림 국물은 짜므로 일부만 넣고 물로 조절한다.'],
    sources: [
      { site: '만개의 레시피', title: '꽁치무조림', author: '만개의레시피', url: 'https://www.10000recipe.com/recipe/6902948' },
      { site: 'YouTube', title: '꽁치무조림 [만개의레시피]', author: '만개의레시피 10K Recipe', url: 'https://www.youtube.com/watch?v=2DkvwS4rQn4' },
    ],
  },
  {
    id: 'beef_radish_soup',
    name: '소고기 무국 + 두부',
    match: ['무국'],
    ingredients: [
      { name: '소고기 국거리 (양지)', amount: '100 g' },
      { name: '무', amount: '150 g' },
      { name: '두부', amount: '1/2모 (약 150 g)' },
      { name: '국간장', amount: '1큰술' },
      { name: '다진 마늘', amount: '1작은술' },
      { name: '참기름', amount: '1작은술' },
      { name: '물', amount: '500 mL' },
      { name: '대파·소금', amount: '약간' },
    ],
    steps: [
      '무는 나박썰기, 두부는 깍둑썰기 한다.',
      '냄비에 참기름을 두르고 소고기를 볶다가 겉이 익으면 무를 넣어 함께 볶는다.',
      '물을 붓고 끓어오르면 거품을 걷어 내고 중불로 15분 끓인다.',
      '두부를 넣고 국간장·다진 마늘로 간한 뒤 부족하면 소금으로 맞춘다.',
      '대파를 넣고 한소끔 더 끓인다.',
    ],
    tips: ['두 번 분량을 끓여 다음 날 아침에 데워 먹어도 된다.'],
    sources: [
      { site: '만개의 레시피', title: '백종원 맑은 소고기 무국 끓이는 법', author: '스와티라마', url: 'https://www.10000recipe.com/recipe/6885852' },
      { site: 'YouTube', title: '백종원표 소고기뭇국 #집밥백선생3', author: 'tvN Joy', url: 'https://www.youtube.com/watch?v=f7JbB4xsnxU' },
    ],
  },
  {
    id: 'kimchi_stew',
    name: '돼지고기 두부 김치찌개',
    match: ['김치찌개'],
    ingredients: [
      { name: '돼지고기 (앞다리살·목살)', amount: '100 g' },
      { name: '신김치', amount: '150 g' },
      { name: '두부', amount: '1/2모 (약 150 g)' },
      { name: '양파', amount: '1/4개' },
      { name: '대파', amount: '약간' },
      { name: '고춧가루', amount: '1작은술' },
      { name: '다진 마늘', amount: '1작은술' },
      { name: '물', amount: '400 mL' },
    ],
    steps: [
      '냄비에 돼지고기를 볶다가 겉이 익으면 김치를 넣고 함께 2~3분 볶는다.',
      '물·고춧가루·다진 마늘을 넣고 끓어오르면 중불에서 10~15분 끓인다.',
      '두부와 양파를 넣고 5분 더 끓인다.',
      '대파를 넣고 마무리한다.',
    ],
    tips: ['삼겹살보다 앞다리살·목살이 지방이 적다.', '김치 국물이 짜면 물을 조금 더 넣는다.'],
    sources: [
      { site: '만개의 레시피', title: '돼지고기 두부 김치찌개 만들기', author: '눈히', url: 'https://www.10000recipe.com/recipe/7075202' },
      { site: 'YouTube', title: '[어남선생 레시피] 평생 김치찌개 (류수영)', author: 'KBS Entertain', url: 'https://www.youtube.com/watch?v=qRa49obXGQE' },
    ],
  },
  {
    id: 'chicken_curry',
    name: '닭가슴살 카레',
    match: ['카레'],
    ingredients: [
      { name: '닭가슴살', amount: '150 g' },
      { name: '양파', amount: '1/2개' },
      { name: '당근', amount: '1/3개 (냉동 채소로 대체 가능)' },
      { name: '감자', amount: '1/2개 (선택)' },
      { name: '카레 가루 또는 고형 카레', amount: '1인분' },
      { name: '물', amount: '300 mL' },
    ],
    steps: [
      '닭가슴살은 한입 크기로, 채소는 깍둑썰기 한다.',
      '냄비에 기름을 조금 두르고 닭가슴살과 양파를 볶다가 나머지 채소를 넣어 볶는다.',
      '물을 붓고 채소가 익을 때까지 끓인다.',
      '불을 약하게 줄이고 카레를 풀어 눌어붙지 않게 저으며 걸쭉해질 때까지 끓인다.',
    ],
    tips: ['감자를 넣으면 밥 양을 조금 줄인다.', '여러 끼 분량을 만들어 나눠 냉동해도 된다.'],
    sources: [
      { site: '만개의 레시피', title: '닭가슴살 카레 만들기', author: '조밍키', url: 'https://www.10000recipe.com/recipe/6875689' },
    ],
  },
  {
    id: 'beef_tofu_kimchi',
    name: '우삼겹 두부김치',
    match: ['두부김치'],
    ingredients: [
      { name: '우삼겹', amount: '100 g' },
      { name: '신김치', amount: '150 g' },
      { name: '두부', amount: '1/2모 (약 150 g)' },
      { name: '양파', amount: '1/4개' },
      { name: '대파', amount: '약간' },
      { name: '참기름', amount: '1작은술' },
    ],
    steps: [
      '두부는 도톰하게 썰어 끓는 물에 2~3분 데친다.',
      '기름 없이 달군 팬에 우삼겹을 볶아 나온 기름을 키친타월로 덜어 낸다.',
      '김치와 양파를 넣고 김치가 부드러워질 때까지 볶는다.',
      '대파와 참기름을 넣고, 데친 두부와 함께 담는다.',
    ],
    tips: ['우삼겹 기름을 덜어 내면 지방이 줄어든다.'],
    sources: [
      { site: '만개의 레시피', title: '우삼겹 두부김치 만드는 법', author: '구울팁', url: 'https://www.10000recipe.com/recipe/7000761' },
    ],
  },
  {
    id: 'tenderloin_steak',
    name: '소고기 안심 스테이크',
    match: ['스테이크'],
    ingredients: [
      { name: '소고기 안심', amount: '150~200 g' },
      { name: '소금·후추', amount: '약간' },
      { name: '올리브유', amount: '1작은술' },
      { name: '마늘', amount: '2~3쪽' },
      { name: '곁들임 채소 (양파·버섯·양배추 등)', amount: '한 줌' },
    ],
    steps: [
      '고기를 냉장고에서 미리 꺼내 두고, 키친타월로 물기를 닦은 뒤 소금·후추를 뿌린다.',
      '팬을 센 불로 충분히 달군 뒤 올리브유를 두르고 고기를 올린다.',
      '한 면씩 2~3분 굽고(두께에 따라 조절), 마늘을 함께 굽는다.',
      '불을 끄고 고기를 접시에 옮겨 5분 쉬게 한 뒤 썬다.',
      '같은 팬에 곁들임 채소를 볶는다.',
    ],
    tips: ['익힘 정도는 취향대로. 술 마시는 날은 밥 없이 채소를 늘린다.'],
    sources: [
      { site: '만개의 레시피', title: '집에서 두툼한 소고기 안심 스테이크 만들기', author: '만개의레시피', url: 'https://www.10000recipe.com/recipe/6933490' },
      { site: 'YouTube', title: '집에서 두툼한 소고기 안심 스테이크 만들기 [만개의레시피]', author: '만개의레시피 10K Recipe', url: 'https://www.youtube.com/watch?v=A7a7CalfmeM' },
    ],
  },
]

export function findRecipe(menuText: string): Recipe | undefined {
  return RECIPES.find((r) => r.match.some((m) => menuText.includes(m)))
}
