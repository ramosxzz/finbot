FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src

RUN npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production

RUN mkdir -p /app/storage/data

EXPOSE 3000

CMD ["node", "src/index.js"]
