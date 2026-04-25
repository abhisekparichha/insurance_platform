FROM node:20-slim

# Build tools needed for better-sqlite3 native module
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip build-essential python3-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY requirements.txt ./
RUN pip install -r requirements.txt --break-system-packages --quiet

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm --silent && pnpm install --frozen-lockfile --silent

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/
RUN cd frontend && pnpm install --frozen-lockfile --silent

# Copy source
COPY . .

# Build React frontend
RUN cd frontend && pnpm build --silent

EXPOSE 3001

ENV PORT=3001
ENV NODE_ENV=production

CMD ["node", "--import", "tsx/esm", "server/index.ts"]
