# syntax=docker/dockerfile:1.7
# ── CarValue ML — Next.js web app + prediction API ───────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Retrain inside the image with:  docker build --build-arg RETRAIN=true .
ARG RETRAIN=false
RUN if [ "$RETRAIN" = "true" ]; then npm run data:generate && npm run train; fi
RUN npm test
# The pool is created lazily, so a placeholder URL is enough at build time.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/models ./models
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
