# 밀핏 (Mealfit)

목표 칼로리와 탄단지에 맞춰 다음 3일의 아홉 끼, 재료 재사용, 장보기 목록을 함께 설계하는 모바일 우선 AI 식단 플래너입니다.

## 주요 기능

- 하루 칼로리·탄수화물·단백질·지방 목표 저장
- OpenAI Structured Outputs 기반 3일 × 3끼 식단 생성
- API 키가 없거나 호출이 실패해도 동작하는 한국식 데모 식단
- 레시피 재료, 조리 순서, 영양 정보, 쿠팡 검색 링크
- 날짜와 끼니를 선택하는 식단 일정 등록
- 3일 통합 장보기 목록과 중복 재료 최적화
- 즐겨찾기, 커뮤니티 공유, 브라우저 로컬 저장

## 로컬 실행

`.env.example`을 `.env.local`로 복사하고 새 OpenAI 프로젝트 키를 입력하세요. 키가 없어도 데모 모드로 모든 핵심 흐름이 작동합니다.

```bash
pnpm install
pnpm dev
```

## Vercel 배포

Vercel에서 이 저장소를 가져온 뒤 Root Directory를 `meal-planner`로 지정합니다. `OPENAI_API_KEY`를 Production/Preview 환경변수에 직접 등록하고 배포하세요. 새 키를 소스 코드나 `NEXT_PUBLIC_` 변수에 넣지 마세요.

환경변수를 등록하지 않아도 앱은 완전한 데모 데이터로 작동합니다.
