# Stage 1: Build the React Application
FROM node:22-alpine as builder

WORKDIR /app

# Habilitar corepack y preparar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar configuración de dependencias e instalar
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copiar código fuente y compilar
COPY . .
RUN pnpm run build

# Stage 2: Production Server (Node.js)
FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar archivos de dependencias e instalar solo producción
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copiar recursos compilados y backend
COPY --from=builder /app/dist ./dist
COPY server ./server

# Expose port (default 3000 or defined by env)
EXPOSE 3000

# Start the server
CMD ["node", "server/index.js"]
