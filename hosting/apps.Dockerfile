# syntax=docker/dockerfile:1
# v3 frontends: the collector app and the grader console, served by one nginx.
#   docker build -f hosting/apps.Dockerfile -t nafuda-apps .
# Only static files end up in the image; no keys (the browser talks to a public RPC and /api).

FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/ packages/
COPY apps/ apps/
COPY server/package.json server/package.json
COPY demo/ demo/
COPY deployments/sepolia.json deployments/sepolia.json
RUN npm ci --no-audit --no-fund
RUN npm test --workspace @nafuda/core && npm run build --workspace @nafuda/collector --workspace @nafuda/grader

FROM nginx:1.27-alpine
COPY hosting/apps.conf /etc/nginx/conf.d/default.conf
COPY hosting/common.inc /etc/nginx/conf.d/common.inc
COPY --from=build /repo/apps/collector/dist /usr/share/nginx/collector
COPY --from=build /repo/apps/grader/dist /usr/share/nginx/grader
EXPOSE 80 81
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/ && wget -q -O /dev/null http://127.0.0.1:81/ || exit 1
