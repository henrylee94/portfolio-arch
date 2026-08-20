FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src/ ./src/
RUN npx tsc -p tsconfig.standalone.json

FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist-standalone/ ./dist-standalone/
EXPOSE 3000
CMD ["node", "dist-standalone/main.standalone.js"]
