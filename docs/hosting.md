# Hosting

**Live:** https://nafuda.sololin.xyz (collector app) and https://nafuda-grader.sololin.xyz (grader console)

Everything runs in Docker on the author's Mac mini and is published through a **Cloudflare Tunnel**, so no inbound port is open on the home network.

```
visitor ──https──▶ Cloudflare ──tunnel──▶ cloudflared (on the host)
                                              │
                        127.0.0.1:8088 ──▶ apps :80  collector app ─┐
                        127.0.0.1:8089 ──▶ apps :81  grader console ┤── /api ──▶ api ──▶ db (Postgres)
                                                                     │              ▲
                                                           indexer ──┴── getLogs ───┘ (Sepolia)
                                                           market  (demo trades, optional profile)
```

The browser talks to Sepolia directly for everything authoritative (ENS resolution, wallets, transactions). The server only indexes events and stores signed, off-chain intents.

## Services ([hosting/compose.yaml](../hosting/compose.yaml))

| Service | Image | What it does | Ports |
|---|---|---|---|
| `apps` | `hosting/apps.Dockerfile` | nginx serving both React apps (single-page, clean URLs) and proxying `/api` to `api`. Strict CSP, no framing | 127.0.0.1:8088 (collector), 127.0.0.1:8089 (grader) |
| `api` | `hosting/server.Dockerfile` | Read API over the index, plus the signed-intent endpoints (offers, submissions). Writes are limited to 8 KB bodies and 30 writes per minute per client | internal |
| `indexer` | same image | Follows Sepolia 2 blocks behind the head; writes issuances, attributes, transfers (with declared prices) into Postgres | internal |
| `db` | `postgres:17-alpine` | Its own Postgres with a named volume. Not shared with any other project on the host | internal |
| `market` | `node:24-alpine` (profile `market`) | The demo market simulator ([scripts/src/market.ts](../scripts/src/market.ts)); runs until `MARKET_UNTIL` and stops | none |
| `tunnel` | `cloudflare/cloudflared` (profile `tunnel`) | Only for a host without cloudflared of its own | none |

The compose project is named `nafuda`, and every host port is bound to loopback, so nothing collides with other projects on the Mac mini.

## Configuration

`hosting/.env` (gitignored; see [hosting/.env.example](../hosting/.env.example)):

| Variable | Used by | Notes |
|---|---|---|
| `DB_PASSWORD` | db, api, indexer | Any random string |
| `INDEXER_RPC_URL` | indexer, api | Sepolia RPC for the server side. It stays on the server; publicnode is the fallback |
| `WEB_PORT`, `GRADER_PORT` | apps | Default 8088 and 8089 |
| `MARKET_UNTIL`, `MARKET_BUDGET`, `MARKET_MIN`, `MARKET_MAX`, `MARKET_BURST` | market | When to stop (default `2026-09-30T00:00:00+09:00`), the gas budget in ETH (0.1), seconds between actions (480–900), quick trades at start (0) |
| `MULTIBAAS_WEBHOOK_SECRET` | api | Signing secret of the Curvegrid MultiBaas webhook (second witness). `npm run multibaas -- webhook --secret-out <file>` writes it to a file; append that file here. Unset, the witness is off. The MultiBaas API key is **not** needed on the server |
| `TUNNEL_TOKEN` | tunnel | Only with the `tunnel` profile |

The market simulator also reads the repo's root `.env` (demo keys: `ALICE_PK` …, `GRADER_*_PK`, `DEMO_MNEMONIC`). These are **testnet** keys, and they stay on the host: they are never copied into an image.

## Run and update

```bash
cd hosting
docker compose up -d --build                                  # apps, api, indexer, db
docker compose --profile market up -d market                  # optional: demo trades
docker compose ps
docker compose logs -f indexer
```

To update: `git pull && docker compose up -d --build`. Both the api and the indexer run the migrations in `server/migrations/` at start. Each step holds a transaction-level advisory lock, so two containers starting together never apply a migration twice.

## Cloudflare Tunnel

The Mac mini already runs cloudflared, so the tunnel has two public hostnames:

| Hostname | Service |
|---|---|
| `nafuda.sololin.xyz` | `http://localhost:8088` |
| `nafuda-grader.sololin.xyz` | `http://localhost:8089` |

A second-level name such as `grader.nafuda.sololin.xyz` would not work: Cloudflare's free Universal SSL covers only one level of subdomain. **Do not turn on Cloudflare Access** for these hostnames: judges must be able to open them without logging in.

## Keep it running

- Docker Desktop: turn on **Start Docker Desktop when you sign in**. Services use `restart: unless-stopped`. The market uses `on-failure`, so it does not restart after its scheduled stop.
- Stop the Mac from sleeping: **System Settings → Energy → Prevent automatic sleeping when the display is off**.
- Fallback host: the same compose file runs on any Docker host, for example an EC2 instance with the `tunnel` profile and a tunnel token.

## Security notes

- The images contain only built static files (apps) or the server code (api, indexer). A whitelist [.dockerignore](../.dockerignore) keeps `.env`, `contracts/` and deployment secrets out of every build context.
- The collector app and the grader console run on separate origins, so wallet connections never leak between them.
- Every write to the API carries an EIP-712 signature, and the signer is recovered on the server. The server checks asks against the current holder, including on chain for titles not indexed yet, and checks the grader's "issued" step against the transaction receipt.
