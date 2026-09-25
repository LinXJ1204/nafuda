# syntax=docker/dockerfile:1
# Nafuda server: the indexer and the read API (same image, different command).
#   docker build -f hosting/server.Dockerfile -t nafuda-server .
# No keys in the image: the RPC URL and DATABASE_URL come from the environment at run time.

FROM node:24-alpine
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/ packages/
COPY apps/ apps/
COPY server/ server/
COPY demo/ demo/
COPY deployments/sepolia.json deployments/sepolia.json
RUN npm ci --workspace @nafuda/server --no-audit --no-fund && npm test --workspace @nafuda/server --workspace @nafuda/core
WORKDIR /repo/server
USER node
CMD ["node", "src/main.ts", "api"]
