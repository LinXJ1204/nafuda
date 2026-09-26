# Curvegrid plan: MultiBaas docs digest and integration options

> Written 2026-09-26 15:10 JST, about 18 hours before the 09:00 JST submission deadline. **Proposal only: nothing here is built.** The author decides which option to take. Sources are the Curvegrid docs (all 122 MultiBaas pages were read on 2026-09-26), the public OpenAPI spec, and the Curvegrid pricing FAQ.

## 1. What the two Curvegrid prizes ask for

| | Best RWA Tokenization Project ($1,000) | Best Digital Asset Dashboard ($1,000) |
|---|---|---|
| Fit | Strong. The prize's idea list includes *Supply Chain Assets: custody, provenance, settlement* and *Programmable Asset Controls: permissions, allowlists, approval workflows*. Nafuda is both | Partial. *RWA Analytics: ownership distribution, valuations, liquidity flows* matches the market map, declared prices and activity. *Identify actions that need to be taken* matches the grader intake board |
| MultiBaas | Not required | Not required |
| Judged on | Idea and technical execution | Idea and technical execution |

Both prizes require the same README items:

1. A one-sentence summary. **Done.**
2. How MultiBaas was used. Optional.
3. **A brief intro to the team and their social handles. Missing:** the README still has `TODO(author)`. This item is required.
4. Clear setup and testing instructions. **Done** ("Run it").
5. Experience with MultiBaas (feedback, challenges, wins), only if it was used.

## 2. MultiBaas in one page

MultiBaas is Curvegrid's hosted middleware for EVM chains: a web UI plus a REST API (`https://<id>.multibaas.com/api/v0`, Bearer API key). A **deployment** is bound to one chain for life. Ethereum Sepolia is supported.

| Feature | What it does | Useful to Nafuda? |
|---|---|---|
| Contract library and linking | Upload an ABI (or Forge/Hardhat artifact), then link it to addresses. With `startingBlock` set, the contract's events are synced | **Yes.** Needed for everything else |
| Event indexing and Event Queries | Stores decoded events. Saved queries select, filter, aggregate and group event fields (like SQL over logs) | **Partly.** Only for new events (see limits) |
| Webhooks | `event.emitted` (any synced contract's event) and `transaction.included` (Cloud Wallet transactions only). HMAC-SHA256 signed over `body + timestamp`, in `X-MultiBaas-Signature` and `X-MultiBaas-Timestamp` | **Yes.** Push delivery of title events |
| Transaction composition | `callContractFunction` returns an unsigned transaction for a wallet to sign | No. The apps already build transactions with viem |
| Cloud Wallets, TXM | Server-side signing with keys in Azure Key Vault, with resubmission and gas bumping | No for the hackathon: needs an Azure account with a credit card. Worth a line under production: a real grader's issuing key belongs in an HSM |
| Safe Accounts | Manage Safe multisig transactions in the UI | No for the hackathon. Production: the grader's `REGISTRAR_ADMIN` behind a Safe |
| TX Explorer | Decodes a transaction against linked ABIs | Nice for the demo, no code needed |
| Users, RBAC, API keys | Groups: Administrators, DApp User (safe to embed in a frontend) and others | We need one Administrator key, server side only |
| SDKs, plugins | TypeScript SDK `@curvegrid/multibaas-sdk` 1.1.1 (axios, generated from OpenAPI), Go SDK, Hardhat plugin, `forge-multibaas` library | The TypeScript SDK, for the setup script |
| Curvegrid Testnet | Private PoA chain with a faucet | No. ENSv2 lives on Sepolia |
| Spreadsheet add-on | Google Sheets functions that read contracts and events through MultiBaas | Not now. Maybe for the planned card-shop client |

API calls we would use (checked against `https://data.multibaas.com/api/v0/openapi.yaml`):

- `POST /contracts/{label}` to add the ABI to the library.
- `POST /chains/ethereum/addresses` to set an alias per address, then `POST /chains/ethereum/addresses/{alias}/contracts` with `{ label, startingBlock: "-100" }` to link it.
- `POST /webhooks` with `{ url, label, subscriptions: ["event.emitted"] }`. The response contains the signing `secret`.
- `GET /events` and `POST /queries/{label}` or `GET /queries/{label}/results` for event data.
- `GET /plan` for this deployment's actual limits.

### Free-plan limits: these decide the design

From Curvegrid's pricing FAQ: 30,000 API calls per month, 5 active contracts, and **"event indexing is capped at 2 events per second starting up to 100 blocks back from the chain head."**

The OpenAPI `Plan` schema has matching limit names (`past_logs_max_depth`, `event_logging_retention_hours`, `linked_contracts`). Another team's repo reports its deployment's `GET /plan` on 2026-09-26 as: `past_logs_max_depth: 100`, `events_per_sec: 2`, `linked_contracts: 10`, `event_logging_retention_hours: 72`, `historical_blocks_feature: false`. **We have not checked our own deployment yet.** Step M0 does.

What this means for Nafuda:

- **No history.** Our contracts started at block 11,779,241. MultiBaas can index at most the last 100 blocks (about 20 minutes) before the moment of linking. The 60 issued titles and the market's past trades would never be in MultiBaas.
- **Events are kept for 72 hours** (if that reported number holds). MultiBaas can never be the system of record.
- **Contract count.** Full coverage is 6 contracts (3 registries and 3 controllers). The FAQ says 5, the reported plan says 10. The 3 registries alone cover every issuance (a mint from `0x0`) and every transfer, which is enough.

## 3. Options

| | Option | Cost | Verdict |
|---|---|---|---|
| A | **README only.** Map Nafuda to the RWA prize, fill in the team line, state that MultiBaas was not used | 30 min | The safe minimum. It must be done in every option |
| B | **MultiBaas as an independent second witness.** Link the 3 grader registries, receive their events by signed webhook, and check each against our own index. The result is shown publicly | 4 h | **Recommended** if the author wants to use MultiBaas. It fits Nafuda's rule of not trusting our own server, and it does not touch the live read path |
| C | Replace our indexer with MultiBaas Event Queries | — | **Rejected.** No backfill, 72 h retention, 2 events/s and 30k calls a month. The live site would lose its history |
| D | Browser calls MultiBaas directly with a DApp User key | — | **Rejected.** Anyone could burn the 30k monthly calls, and the browser already reads ENS directly, which is the point |

### Why B, and not a bigger integration

Nafuda already checks its server index against ENS on every title page. B adds a check run by **someone else**: Curvegrid's indexer sees the same contracts, and we show whether the two indexes agree. That is a real use of MultiBaas (contract linking, event sync, signed webhooks, optionally an event query), and it strengthens the trust story instead of adding a dependency. If MultiBaas goes down, nothing on the site breaks. Only the "second witness" panel says so.

## 4. Option B in detail

**Hard stop:** 21:00 JST. Whatever isn't working then gets dropped, and the README describes only what is real.

| # | Step | Who | Done when |
|---|---|---|---|
| M0 | Create a Curvegrid account and a MultiBaas deployment on **Ethereum Sepolia**. Create one Administrator API key. Put `MULTIBAAS_URL` and `MULTIBAAS_API_KEY` in the Mac mini's `.env` and your local `.env` (never in the repo). Read `GET /plan` and record the real limits in this file | **Author** (it's your account) | `GET /plan` output recorded |
| M1 | `scripts/src/multibaas.ts`, idempotent, using the TypeScript SDK. It uploads a minimal ABI (`TransferSingle`, and `TitleIssued`/`TitleAttribute` if the contract limit allows), sets aliases `psa-sim-registry`, `cgc-sim-registry` and `bgs-sim-registry`, links them with `startingBlock: "-100"`, and creates the webhook to `https://nafuda.sololin.xyz/api/hooks/multibaas`. It prints the webhook secret once, for `.env` | Claude | Re-running changes nothing. The MultiBaas UI shows the 3 contracts syncing |
| M2 | `POST /api/hooks/multibaas` on the API server: checks the HMAC-SHA256 of `body + timestamp` in constant time, rejects a timestamp older than 5 minutes, then stores each event in a new `multibaas_events` table keyed by MultiBaas's event `id` (redeliveries are no-ops). The route gets its own body limit (256 KB) instead of the public 8 KB limit and the 30-per-minute limit. **The webhook data is never written into titles or transfers.** The indexer keeps reading the chain | Claude | Unit tests: valid, tampered body, wrong secret, stale timestamp, redelivery. Integration test on Postgres |
| M3 | Reconciliation: each stored event is matched by `(tx hash, log index)` against our `transfers` table once our indexer has passed that block. It is `agreed`, `missing in Nafuda` or `pending`. `GET /api/status` gets a `multibaas` block (events in the window, agreed, mismatched, last event time) | Claude | Unit tests for the matcher |
| M4 | UI: a "Second witness: Curvegrid MultiBaas" panel on the collector app's Developers page, and one line on the grader console's trust panel. The public e2e suite checks `mismatched == 0` | Claude | Live: a market trade appears in the panel as `agreed` within about a minute |
| M5 | README: a Curvegrid section with the five items, a production note (grader keys in Cloud Wallets or HSM, admin role behind a Safe), and the feedback in §5. `docs/ai-usage.md` entry | Claude drafts, **author edits the feedback** | Review by the author |
| M6 (stretch) | A saved Event Query "transfers per grader, last 72 h" shown next to our own numbers | Claude | Only if M0–M5 are done before 20:00 |

Dependencies and risks:

- **Uncommitted work in the repo.** The title-integrity changes (`TitleIntegrity.tsx`, `integrity.ts`, `VerifyPanel.tsx` and others) are uncommitted. They must be finished and committed before B starts, so the two don't get mixed.
- **Live deployment.** M2–M4 need the `api` and `apps` images rebuilt on the Mac mini. Same path as before (`ssh mac-mini`, compose project `nafuda`). The indexer is not touched.
- **The market simulator must still be running** during judging, or MultiBaas sees nothing within its 72-hour window. Check `MARKET_UNTIL`.
- **Reorgs.** A webhook can report an event from a block that is later reorganised. The matcher only judges events older than our confirmation depth.

## 5. Feedback for the README (draft; the author confirms it after using MultiBaas)

Observed while reading the docs. Keep only what the author also finds in practice:

- **Win:** the full OpenAPI spec is public (`data.multibaas.com/api/v0/openapi.yaml`), which made the API easy to check without an account.
- **Win:** `startingBlock` accepts a relative value like `-100`, so a script doesn't need to read the chain head first.
- **Challenge:** the 100-block lookback on the free plan appears only in the pricing FAQ, not on the Event Indexing page. A contract deployed a day earlier can't be backfilled, which matters for any team that deploys first and adds MultiBaas later.
- **Challenge:** the Supported Networks table and the API reference pages render in the browser only ("Loading network data…"), so scripts and LLM tools can't read them. There is no `llms.txt`.
- **Docs bug:** the API Keys page's curl example uses `/api/v1/contract`, but the server and the SDKs use `/api/v0`.
- **Docs gap:** the webhook page shows how the *sender* signs, but gives no receiver example, and doesn't mention a constant-time comparison or a replay window.
- **Docs bug:** the frontend guide's ethers.js sample has unreachable code after `return tx;` that references undefined `dataHash` and `signature`.
- **Challenge:** Cloud Wallets need an Azure account with billing set up, which rules them out for a hackathon.

## 6. Questions for the author

1. **A or B?** B costs about 4 hours today, on top of the video, the final lock and the README team line.
2. **Can Nafuda enter both Curvegrid prizes, and how many partner prizes can one project select?** This was the question for the 9/25 16:00 Curvegrid workshop. If both are allowed, the Dashboard prize costs only README text (market map, declared prices, activity, intake board).
3. **Team line and social handles.** Required by both prizes. Only the author can write it.
