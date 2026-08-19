# 밀핏 (Mealfit)

모바일 우선 식단 기록·3일 AI 식단 계획 서비스입니다. 기존 Next.js UI는 Vercel에 유지하고, 인증·식사 기록·예정 식단·즐겨찾기·커뮤니티·식약처 검색·AI 호출은 Gabia의 Fastify/PostgreSQL 백엔드가 처리합니다.

## 구성

```text
브라우저 → HTTPS Vercel Next.js /backend-api/* → HTTP(S) Gabia Fastify → PostgreSQL / MFDS / AI API
```

Gabia 주소는 서버 전용 `GABIA_BACKEND_ORIGIN`에만 존재하며 브라우저 번들에는 포함되지 않습니다. 인증은 원문 토큰을 DB에 저장하지 않는 HttpOnly 세션 쿠키 방식입니다.

## 로컬 빌드

```bash
pnpm install
pnpm exec tsc --noEmit
pnpm lint
pnpm build
pnpm --dir backend prisma:validate
pnpm --dir backend test
pnpm --dir backend build
```

백엔드 설정과 Gabia 명령은 [backend/README.md](backend/README.md)를 참고하세요.

## Vercel 설정

프로젝트 Settings → Environment Variables에 다음 값을 추가하고 Production과 Preview를 선택합니다.

```env
GABIA_BACKEND_ORIGIN=http://GABIA_PUBLIC_IP:3001
```

저장 후 Deployments에서 최신 배포를 Redeploy하거나 `main` 브랜치에 새 커밋을 push합니다. `NEXT_PUBLIC_GABIA_IP`는 만들지 않습니다. 기존 Vercel `OPENAI_*`와 `PUBLIC_FOOD_*` 변수는 레거시 Route Handler용이며, 실제 로그인 후 흐름의 AI/MFDS 키는 Gabia `backend/.env`에서 관리합니다.

## 배포 후 2계정 수용 테스트

1. 시크릿 창 A에서 `/signup`으로 사용자 A를 만듭니다.
2. 오늘 저녁에 `돼지고기 제육볶음`을 기록하고 편집 화면의 `커뮤니티에 공유`를 누릅니다.
3. MY에서 로그아웃합니다.
4. 시크릿 창 B에서 사용자 B를 만들고 커뮤니티를 엽니다.
5. A의 게시물이 보이는지 확인하고 좋아요와 댓글을 남깁니다.
6. `나도 먹어볼래요` → 내일 → 저녁으로 등록합니다.
7. 내일 기록에서 `먹을 예정`으로 보이며 섭취 칼로리에 합산되지 않는지 확인합니다.
8. `먹었어요`를 누르고 예정 식단이 사라지며 칼로리·탄단지가 증가하는지 확인합니다.
9. 개발자 도구로 A의 기록/게시물/댓글 ID를 넣어 B 쿠키로 PATCH/DELETE를 시도하고 `404`가 반환되는지 확인합니다.
