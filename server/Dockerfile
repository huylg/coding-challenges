FROM oven/bun:latest

WORKDIR /app

COPY package.json ./
RUN bun install --production

COPY . .

CMD ["bun", "run", "src/index.ts"]
