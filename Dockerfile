# Multi-arch: docker buildx build --platform linux/amd64,linux/arm64 -t headless-crm .
FROM node:22-slim AS base
WORKDIR /app

# Install dependencies only
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/db/package.json packages/db/
COPY packages/core/package.json packages/core/
COPY packages/auth/package.json packages/auth/
COPY packages/events/package.json packages/events/
COPY packages/mcp-server/package.json packages/mcp-server/
COPY packages/cli/package.json packages/cli/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install

# Copy source and build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsc --project apps/api/tsconfig.json

# Production image
FROM base AS runner
ENV NODE_ENV=production

# Install tsx globally for running TypeScript directly
RUN npm install -g tsx

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/package.json ./

EXPOSE 3001
CMD ["tsx", "apps/api/src/server.ts"]
