# CareGap Backend
Node.js 22.15+ ESM · TypeScript 7.0.2 · Express 5 · Zod 4 · pg/SQL.

1. pnpm install --frozen-lockfile
2. .env.example을 .env로 복사
3. pnpm dev (127.0.0.1:3002)
4. 로컬 Docker가 있을 때만 docker compose up -d, pnpm migrate

pnpm typecheck / pnpm test / pnpm build. Docker 실행은 선택이며 /health는 DB 연결 검사가 아닙니다.
공유 서버·공용 DB·Supabase 변경 금지. 실제 개인정보/토큰/녹음은 커밋 금지.
BE1/BE2 업무 구현은 담당자에게 남겨 둡니다. docs/contracts.md 및 docs/openapi.yaml 참고.
main은 공통 초기 환경, feature/ai-foundation은 BE3 작업용. 각 담당자는 feature/auth-*, feature/appointments-*, feature/ai-* 브랜치 및 PR 리뷰 사용.
