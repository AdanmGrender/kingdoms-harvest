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

# Persistent state lives under /data (mounted as a volume). Chown al usuario
# no-root `node` (uid 1000, ya presente en la imagen) para que pueda escribir la
# DB sql.js sin correr como root.
RUN mkdir -p /data/db /data/secrets \
    && ln -sf /data/db ./server/data \
    && ln -sf /data/secrets ./server/secrets \
    && chown -R node:node /data

# Correr sin privilegios (defensa en profundidad ante un RCE).
USER node

EXPOSE 3001

# Healthcheck: el orquestador reinicia el contenedor si /api/health no responde.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server/src/index.js"]
