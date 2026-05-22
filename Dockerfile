FROM docker.io/oven/bun:1.3.13

WORKDIR /home/discloud

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg nodejs \
	&& rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=8080
EXPOSE 8080

CMD ["bash", "-c", "bun run discloud:start"]
