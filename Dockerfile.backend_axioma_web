## Multi-stage build para API Node/TypeScript

### Etapa de build
FROM node:20-slim AS builder
WORKDIR /app

# Instalar curl y dotenvx; ejecutar prebuild para evitar que .env quede en la imagen
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/* \
  && curl -fsS https://dotenvx.sh | sh \
  && dotenvx ext prebuild

# Instalar dependencias
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src

# Generar Prisma Client (no requiere conexión a BD)
RUN npx prisma generate

# Compilar TypeScript a JavaScript
RUN npm run build

### Etapa final - producción
FROM node:20-slim
WORKDIR /app

ENV NODE_ENV=production
ARG PORT=8000
ENV PORT=${PORT}
ENV SWAGGER_USE_DIST=true

# Herramientas para healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copiar artefactos de build y dependencias (incluye dev para prisma CLI)
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --chown=node:node package*.json ./

# Preparar directorios y permisos para usuario no-root
RUN mkdir -p /app/logs && chown -R node:node /app

# Ejecutar como usuario no-root provisto por la imagen
USER node

EXPOSE ${PORT}
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -f http://localhost:${PORT}/health || exit 1

# Comando de arranque (servidor API)
CMD ["node", "dist/index.js"]
