FROM docker.io/oven/bun:1.3.13 AS build

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
COPY patches ./patches
COPY RadiantClient/package.json ./RadiantClient/package.json
COPY backend/package.json ./backend/package.json
COPY radiant-frontend/package.json ./radiant-frontend/package.json
COPY radiant-cli/package.json ./radiant-cli/package.json

RUN bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN bun run build

FROM docker.io/oven/bun:1.3.13 AS runner

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=8080

EXPOSE 8080

CMD ["bun", "run", "start"]
