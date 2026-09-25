# Hosting

The web app is static files: the collector app at `/` and the grader console at `/grader/`. It talks to Sepolia from the visitor's browser, and every transaction is signed in the visitor's own wallet. There is no backend and no key on the server.

**Main host:** the author's Mac mini runs nginx in Docker and publishes it through a **Cloudflare Tunnel**, so no inbound port is opened on the home network.
**Standby:** the same build can be deployed to Cloudflare Workers static assets (`web/wrangler.jsonc`) if the Mac mini is down.

```
visitor ──https──▶ Cloudflare ──tunnel──▶ cloudflared ──▶ web (nginx, static files)
   │                                        (both containers on the Mac mini)
   └──▶ Sepolia RPC (public) and the visitor's wallet, straight from the browser
```

## What is in the image

[`hosting/Dockerfile`](../hosting/Dockerfile) builds in two stages: Node runs the tests and `vite build`, then `nginx:alpine` serves `web/dist` only. [`.dockerignore`](../.dockerignore) is a whitelist (`web/`, `demo/`, `deployments/sepolia.json`, `hosting/nginx.conf`), so `.env`, `contracts/` and deployment secrets are never even sent to the Docker daemon.

[`hosting/nginx.conf`](../hosting/nginx.conf) adds a strict Content-Security-Policy (scripts and styles from the site only; network calls to https only), `nosniff`, no framing, long-lived caching for hashed assets, and `no-cache` for HTML.

## Run it locally

```bash
cd hosting
docker compose up -d --build     # http://localhost:8088/ and http://localhost:8088/grader/
```

The port is bound to loopback only and can be changed with `WEB_PORT` in `hosting/.env`. The compose project is named `nafuda`, so it does not collide with other projects on the same machine.

## Put it on the internet with a Cloudflare Tunnel

### If the host already runs cloudflared (the author's Mac mini does)

Run only the `web` container, and add a route to the existing tunnel:

1. `cd hosting && docker compose up -d --build`
2. In **Zero Trust → Networks → Tunnels**, open the tunnel the host runs, then **Public hostname → Add**: subdomain `nafuda`, your domain, service type **HTTP**, URL **`localhost:8088`**.

### Otherwise: a tunnel of its own

1. In the Cloudflare dashboard, go to **Zero Trust → Networks → Tunnels → Create a tunnel**, pick **Cloudflared**, and name it `nafuda`.
2. On the install screen, copy the token (the long value after `--token`). You do not need to install anything: the `tunnel` container runs cloudflared.
3. `cp hosting/.env.example hosting/.env` and set `TUNNEL_TOKEN=` to that token. `hosting/.env` is gitignored.
4. Add a **public hostname** to the tunnel: subdomain `nafuda`, your domain, service type **HTTP**, URL **`web:80`**. That is the web container's name on the compose network.
5. Start both containers:

   ```bash
   cd hosting
   docker compose --profile tunnel up -d --build
   docker compose ps               # web healthy, tunnel running
   docker compose logs tunnel      # "Registered tunnel connection" ×4
   ```

6. Open `https://nafuda.<your-domain>/` and `/grader/` in a private window.

**Do not turn on Cloudflare Access** for this hostname. Judges must be able to open it without logging in.

## Keep it running on the Mac mini

- Docker Desktop: turn on **Start Docker Desktop when you sign in**. Both containers use `restart: unless-stopped`, so they come back after a reboot.
- Stop the Mac from sleeping: **System Settings → Energy → Prevent automatic sleeping when the display is off**.
- To deploy a new version: `git pull && cd hosting && docker compose --profile tunnel up -d --build`.

## Standby: Cloudflare Workers

If the Mac mini or the home connection fails, deploy the same build to Cloudflare Workers and point the hostname there:

```bash
cd web && npm ci && npm run build && npx wrangler deploy
```

An EC2 instance running the same `docker compose --profile tunnel up -d` also works. The tunnel token lets any machine serve the hostname.

## RPC

By default, the browser uses the public `https://ethereum-sepolia-rpc.publicnode.com`. To use another endpoint, set `VITE_SEPOLIA_RPC_URL` in `hosting/.env` and rebuild. It is compiled into the public JavaScript, so use only a key that is restricted to your domain.
