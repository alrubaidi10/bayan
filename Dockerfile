# Bayan ERP — Docker image (for Railway / Render / any VPS)
FROM node:20-slim

WORKDIR /app

# Install dependencies first (better caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the application
COPY server ./server
COPY public ./public

# SQLite data lives here — mount a persistent volume on /data
ENV DATA_DIR=/data
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# better-sqlite3 needs a writable data dir
RUN mkdir -p /data

CMD ["node", "server/index.js"]
