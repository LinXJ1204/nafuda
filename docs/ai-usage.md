# AI usage log

This project uses **Claude Code** (Anthropic, model Claude Opus 5.5) as a development assistant. ETHGlobal requires teams to document where and how AI tools were used. This log records that in chronological order, along with which decisions the author made.

A new entry is appended at the end of each work session.

---

## Planning (before kickoff, 2026-09-25)

**What the AI did**
- Checked each idea for feasibility against the ENSv2 Beta source (`contracts-v2` @ `71a3b733`)
- Critiqued the author's brainstorm (`docs/plan/00-brainstorm-v1.md`)
- Researched external facts: how PSA cert numbers are assigned, vault intake processes, the state of chip-embedded slabs, ETHGlobal rules, and sponsor prize requirements
- Wrote plan v1, plan v2, and the implementation plan in `docs/plan/`

**Decisions made by the author**
- Pivot from "vault custody registry" to "grader-issued title + chip verification", because offline trading is the bigger and more convincing need
- Simulate the chip for the hackathon
- Recover lost wallets by sending the slab back to the grader for re-slabbing. This is future work, because all trust in the system already rests on the grader
- Enter only ENS and Curvegrid RWA; skip World and Uniswap
- Project name Nafuda; simulated grader PSA-Sim; repo public from the start

## P0 setup (from 2026-09-25 21:08 JST)

**What the AI did**: created the repo skeleton, `.gitignore`, and README draft; added the `contracts-v2` submodule; organized the planning documents and this log.

**What the author did**: created the GitHub repo and sent faucet ETH to the operator account. The AI-written `fund.ts` then distributed it to the other demo accounts.

## P1 TitleController (from 2026-09-25 ~21:15 JST)

**What the AI did**: drafted `contracts/src/TitleController.sol` and `contracts/test/TitleController.t.sol` (25 tests, T1–T8, built on the official ENSv2 `V2Fixture`), generated the deterministic demo chip keys and EIP-191 test vectors in `demo/`, and mutation-tested the guards: five deliberate bugs, all caught by the tests.

**Found during implementation**: revoking only `UNEMANCIPATED_ROLE_BITMAP` from the grader is not enough. The grader would keep `ROLE_REGISTRAR` and could register titles directly, bypassing the controller, even with `SET_RESOLVER` for the holder. The setup now leaves the grader only `REGISTRAR_ADMIN`, `SET_PARENT`, and `CAN_NAME`, and a test pins this.

**What the author does**: line-by-line review of the contract and tests. The review outcome will be recorded here.

## P2 deploy scripts and fork rehearsal (from 2026-09-25 ~21:30 JST)

**What the AI did**: wrote `scripts/src/{lib,deploy,issue,verify,transfer}.ts`. The deploy is idempotent, and the commit-reveal commitment is computed locally with a CSPRNG secret. The AI ran the full rehearsal on an anvil fork of Sepolia: deploy from scratch, issue the demo titles, run V1–V8, then re-run everything to confirm no transactions are sent.

**What the author does**: reviews the scripts; approves going to Sepolia (P3).

## P3 Sepolia deployment (2026-09-25 ~21:35 JST)

**What the AI did**: ran the deploy, issue, and verify scripts against Sepolia, after the author said to continue while reviewing in parallel. The AI also fixed a bug in `issue.ts` (the tx hash was not saved to the state file) and added `report.ts`, which generates `docs/deployments.md`.

**What the author did**: approved going to Sepolia.

## P5 web app (from 2026-09-25 ~21:40 JST)

**What the AI did**:
- Wrote `web/`: the pure verification logic with node tests, the simulated chip behind a HaLo-compatible `sign()` interface, ENS lookup through the Universal Resolver, the wallet-based seller proof and title transfer, and the UI
- Scanned the bundle for leaked secrets
- Added the GitHub Pages and Foundry CI workflows

**What the author does**: reviews, enables GitHub Pages, and checks the page in a browser.

## P7/P8 lock script, README, demo prep (2026-09-25 ~21:38–21:48 JST)

**What the AI did**:
- Wrote `scripts/src/lock.ts` (dry run by default) and the post-lock checks V9–V11, and rehearsed the lock on an anvil fork of the live Sepolia state. The lock has not been executed on Sepolia; that needs the author's explicit go-ahead.
- Added a state-file network guard after noticing that a copied state file could write fork transactions into the Sepolia record.
- Drafted the README (English), `scripts/src/reset.ts`, and a narration draft in `docs/demo-script.md`. The author records the video in their own voice.

**Still with the author**: team intro in the README, enabling GitHub Pages, checking the Explorer and ENS App display, review, and the final-lock decision.


## P5b web v2: collector app, grader console, self-hosting (2026-09-25 22:03–22:35 JST)

**Decisions made by the author**: split the web app into a consumer side (OpenSea-style browsing plus verification) and a grader side (PSA-Sim console); host it on the author's Mac mini with Docker and a Cloudflare Tunnel; read lists and history from on-chain events instead of running an indexer; plan first, then build all three tiers of [docs/plan/web-v2-plan.md](plan/web-v2-plan.md); use TypeScript on both sides.

**What the AI did**:
- Wrote the plan, then built W1–W8 one commit each: a two-page Vite build with hash routes, the title page (generated slab art, ENS-resolved facts, buyer check, event history, holder-only transfer), the grader console (issue from a simulated chip pool with pre-send checks, issued list, trust panel read live from the registries), Explore, and My titles.
- Added `scripts/src/chips.ts`, which regenerates `demo/slabs.json` deterministically and adds a pool of 10 sealed-but-untitled simulated slabs for the console.
- Moved the pure logic into tested modules (routes, role decoding, issue pre-checks, trust scoring): 31 node tests.
- Checked the pages in headless Chrome: S1–S5 against live Sepolia, and A4 (issue a new title and tap it from another browser), A5 (non-grader wallet and duplicate cert are blocked before sending), S6 (transfer), and the post-lock trust panel on an anvil fork with a mock wallet, so the live demo state was not touched.
- Wrote the Docker image (tests run in the build; nginx with a strict CSP; a whitelist `.dockerignore`), the compose file, and `docs/hosting.md`, and checked that no `.env` value is in the image.
- Deployed the web container to the author's Mac mini over SSH at the author's request. Before deploying, the AI checked the ports already in use there and moved off 8080, which another service was using.

**Still with the author**: add a public hostname for `localhost:8088` to the Mac mini's existing Cloudflare Tunnel, issue a pool slab from the console on Sepolia (A4 on the live network), and review.

## v3 productization (2026-09-25 23:10 JST – 2026-09-26 morning, overnight)

**Decisions made by the author**:
- The site felt too thin. Make it look like a mature product, with visual flows and flow-style transfer history, and much more data: more graders, and more buyers and sellers.
- A backend is fine. Keep the grader side and the collector side strictly separate (two frontends are fine, since they use different wallets).
- Everything in TypeScript.
- Approved the plan in [docs/plan/v3-plan.md](plan/v3-plan.md) as proposed:
  - React
  - two origins
  - its own Postgres, not the other projects' containers on the Mac mini
  - BGS-Sim and CGC-Sim
  - TitleControllerV2 for subgrades
- Funded the operator and set up the second hostname.
- On AI use: the ideas are the author's and are never outsourced. Nearly all of the code is written by the coding agent, which is the author's normal way of working.

**What the AI did** (the author was asleep for most of it; everything is in git, one commit per item):
- **Contracts:** TitleControllerV2, which adds attributes as text records, with tests and a mutation check. `deploy-grader.ts`, rehearsed on a fork, including after the final lock. Deployed `cgc-sim` (v1) and `bgs-sim` (v2) on Sepolia.
- **Demo data:**
  - A deterministic seed plan (60 titles across 3 graders) and 16 collectors, one of them the author's wallet.
  - A market simulator that trades on the Mac mini through the night, with declared prices.
  - Collector names (`<name>.nafuda.eth`, through the official PermissionedResolver) and primary names.
- **Backend:** indexer and API (Hono, Postgres), signed off-chain intents (offers, grading submissions) verified on the server, write limits, and Docker services.
- **Frontends:** the collector app and the grader console in React. Visual flows include:
  - provenance with React Flow
  - the step-by-step buyer check
  - the live ENS resolution path
  - the market map and the name tree

  Also: an intake kanban, English / 日本語, and code splitting.
- **Tests:**
  - Unit tests: core 26, server 6.
  - e2e suites in Chrome: a read-only suite on the live site (26 checks), and a live suite that walked submit → grade → seal → issue → ask/bid → transfer on Sepolia.
  - The e2e runs found three bugs, now fixed: asks on a just-issued title, concurrent migrations, and an unverified "issued" transaction hash.
- **Docs:** README v3, hosting, deployments, the demo script, and [docs/review-guide.md](review-guide.md) for the author's review.
- **Operations:**
  - Checked the Mac mini's ports and containers before deploying, and touched nothing else there.
  - Paused the market simulator while other scripts signed with the same keys.
  - A dev Postgres container was briefly started on the Mac mini by mistake (the local docker context points there). It was removed within minutes, and the mistake is reported in the review guide.

**Still with the author**: the review, the final lock, the author's own primary name, the README team line, and the video.

## Enhanced Access Control pass (2026-09-26 afternoon)

**The author asked** how well Nafuda uses ENSv2 Enhanced Access Control, then chose four follow-ups (A–D) and asked for EAC to be shown better in the apps.

**What the AI did:**
- Read the EAC rules from the pinned ENSv2 Beta source and found an overstated claim: the grader holds `REGISTRAR_ADMIN`, so it could grant itself `REGISTRAR` for new certs. The claim was corrected (A).
- Added per-title EAC checks on every title page (B), [docs/access-control.md](access-control.md) and `npm run roles` (C), and gave collectors `SET_RESOLVER` on their own names (D, 16 transactions). A first attempt failed because admin roles cannot be granted on a name; only the base role can.
- Found that `lock.ts` locked only one of the three graders, and fixed it (dry run on Sepolia).
- Built the "who can do what" matrix (each cell a live `eth_call`), the attack buttons, the role bitmaps, and the grader console's access-control map.

## Curvegrid MultiBaas: second witness (2026-09-26, 15:30–16:15 JST)

**The author decided** to go for the Curvegrid prizes. Another Claude session had digested the MultiBaas docs into [plan/curvegrid-plan.md](plan/curvegrid-plan.md). The author created the MultiBaas deployment and its API key.

**What the AI did:**
- Reviewed the plan and changed it in three ways:
  - compare the indexes in both directions, not only Curvegrid → Nafuda;
  - decode the raw log instead of MultiBaas' display values;
  - keep the API key off the server.
- Built:
  - the webhook receiver (HMAC check, replay window, idempotent storage);
  - the reconciliation, with unit and Postgres integration tests;
  - the panels and the setup script (MultiBaas TypeScript SDK).
- Found that the indexer ignored `TransferBatch`, which ENSv2 registries emit when one call moves several names. Fixed it and checked on chain that no batch transfer had happened.
- Connected the deployment:
  - first signature probes against the live endpoint;
  - linking the three registries, which hit a server-side `bin` requirement;
  - two demo trades to watch the first deliveries arrive and agree.
- Restarted the market simulator at a slow pace for the judging period, as the author agreed.
- **A mistake:** checking the compose file with `docker compose config` printed two demo wallets' testnet keys (alice, bob) into the session log. Nothing was committed. The author was told.

**Still with the author:** the MultiBaas feedback in the README (keep only what they ran into), the README team line, and rotating the MultiBaas API key that was pasted into the chat.

## Card categories, light version (2026-09-26, 16:15–16:30 JST)

**The author chose** the light version of planned upgrade U1, out of three options the AI laid out: the full version (V3 and a resolver swap), the light version, or skipping it.

**What the AI did:**
- Category rules and tests in `packages/core/src/categories.ts`.
- The Issue page picker.
- The slab label line, the title page, the Explore filter and `/api/categories`.
- An idempotent script that issued eight categorized BGS-Sim titles. The market simulator was paused while the script signed with the grader key.
- While testing the flow, it noticed that the intake board skipped the grade step, where subgrades and the category are set, for v2 graders, and changed that.

## Curvegrid visibility, confirmed prices, Market page (2026-09-26, 16:40–17:45 JST)

**The author** said Curvegrid was hard to see and asked what it does. The author then proposed using the webhook for price tracking.

**The AI objected:**
- declared prices are self-reported, because payment happens off chain;
- our own index already has the price history;
- so the webhook adds nothing to price tracking as such.

It proposed two things instead:
- **(A)** make the witness also confirm each declared price, from the calldata MultiBaas sends;
- **(B)** a valuation dashboard built on our own index.

**The author chose both.** The AI also:
- made the witness visible across both apps;
- found and fixed a header overflow, which was partly there before these changes;
- fixed charts that drew no bars.
