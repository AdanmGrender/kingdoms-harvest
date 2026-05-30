# ─── Stage 1: build client bundle ────────────────────────────────────────────
FROM node:20-bookworm-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client ./
COPY shared /app/shared
RUN npm run build

# ─── Stage 2: server runtime ─────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Server deps
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev --omit=optional

# Server source + shared
COPY server ./server
COPY shared ./shared

# Client bundle from stage 1
COPY --from=client-build /app/client/dist ./client/dist

# Persistent state lives under /data (mounted as a volume)
RUN mkdir -p /data/db /data/secrets \
    && ln -sf /data/db ./server/data \
    && ln -sf /data/secrets ./server/secrets

EXPOSE 3001
CMD ["node", "server/src/index.js"]
