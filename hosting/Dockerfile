# syntax=docker/dockerfile:1
# Nafuda web: consumer app (/) and grader console (/grader/) as static files behind nginx.
# Build context is the repo root (the app reads deployments/sepolia.json and demo/slabs.json):
#
#   docker build -f hosting/Dockerfile -t nafuda-web .
#
# The final image contains only nginx and the built static files. No keys: the app talks to a
# public Sepolia RPC from the visitor's browser, and wallets sign in the visitor's wallet.

FROM node:24-alpine AS build
WORKDIR /repo/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY deployments/sepolia.json /repo/deployments/sepolia.json
COPY demo/ /repo/demo/
COPY web/ ./
# Optional: a domain-restricted RPC URL. It ends up in the public bundle, so never use a secret one.
ARG VITE_SEPOLIA_RPC_URL=""
ENV VITE_SEPOLIA_RPC_URL=${VITE_SEPOLIA_RPC_URL}
RUN npm test && npm run build

FROM nginx:1.27-alpine
COPY hosting/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
