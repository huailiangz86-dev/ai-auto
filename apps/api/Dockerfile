# ============================================================
# AI auto - NestJS Dockerfile
# ============================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy monorepo files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Install deps
RUN corepack enable && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm --filter @ai-auto/api build

# ----- Production stage -----
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install production deps only
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Set non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
