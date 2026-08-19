# Mealfit Backend

Fastify + Prisma + PostgreSQL로 구성된 독립 실행 백엔드입니다. 브라우저는 이 서버를 직접 호출하지 않고 Vercel의 `/backend-api/*` Route Handler를 통해 호출합니다.

## 로컬 검증

```bash
pnpm install
pnpm --dir backend prisma:generate
pnpm --dir backend prisma:validate
pnpm --dir backend typecheck
pnpm --dir backend test
pnpm --dir backend build
```

개발 서버를 실행하려면 `backend/.env.example`을 `backend/.env`로 복사하고 값을 채운 뒤 `pnpm backend:dev`를 실행합니다.

## Gabia 배포

서버의 저장소 루트에서 실행합니다.

```bash
git pull origin main
cp backend/.env.example backend/.env
nano backend/.env
docker compose build mealfit-backend
docker compose run --rm mealfit-backend pnpm prisma:migrate:deploy
docker compose up -d mealfit-backend
docker compose ps
curl http://127.0.0.1:3001/health
```

`backend/docker-compose.service.yml`의 서비스를 기존 Compose 파일에 합치세요. 기존 PostgreSQL 서비스 이름은 `postgres`, 공용 Docker 네트워크는 `mealfit`이어야 합니다. PostgreSQL의 `5432` 포트는 외부에 공개하지 않습니다.

`SESSION_SECRET`은 다음처럼 서버에서 생성할 수 있습니다.

```bash
openssl rand -base64 48
```

방화벽에서는 백엔드 포트 `3001`만 Vercel에서 접근 가능하게 열어야 합니다. 도메인과 TLS를 마련하면 `GABIA_BACKEND_ORIGIN`을 HTTPS 주소로 교체하세요.

## 환경 변수

- `DATABASE_URL`: `postgresql://mealfit:PASSWORD@postgres:5432/mealfit`
- `SESSION_SECRET`: 32자 이상의 무작위 비밀값
- `SESSION_TTL_DAYS`: 세션 유지 일수
- `MFDS_FOOD_API_KEY`, `MFDS_FOOD_API_URL`: 식약처 음식 영양 API
- `AI_API_KEY`, `AI_MODEL`: 서버 전용 AI 설정
- `PORT`, `HOST`, `NODE_ENV`: 실행 환경

실제 비밀값은 Git에 커밋하지 않습니다.
