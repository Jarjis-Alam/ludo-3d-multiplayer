FROM node:24-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY ludo/package.json ludo/pnpm-workspace.yaml ludo/pnpm-lock.yaml ./
COPY ludo/packages/game-engine/package.json ./packages/game-engine/
COPY ludo/apps/server/package.json ./apps/server/

RUN pnpm install --frozen-lockfile

COPY ludo/packages/game-engine ./packages/game-engine
COPY ludo/apps/server ./apps/server

RUN pnpm --filter @ludo/game-engine build
RUN pnpm --filter @ludo/server build

FROM node:24-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY ludo/package.json ludo/pnpm-workspace.yaml ludo/pnpm-lock.yaml ./
COPY ludo/packages/game-engine/package.json ./packages/game-engine/
COPY ludo/apps/server/package.json ./apps/server/

RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/packages/game-engine/dist ./packages/game-engine/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY ludo/apps/server/migrations ./apps/server/migrations

EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
