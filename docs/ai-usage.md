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
