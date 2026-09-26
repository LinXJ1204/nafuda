# Review guide (v3, night of 2026-09-25)

For the author's morning review. It covers what changed overnight, where to click, what was tested and how, what is left, and which decisions are yours. The plan being implemented is [docs/plan/v3-plan.md](plan/v3-plan.md).

## 1. Ten-minute tour

Open these side by side. On the collector app, the header button switches English / 日本語.

| # | Where | What to look for |
|---|---|---|
| 1 | https://nafuda.sololin.xyz | Home: hero, live stats, the animated lifecycle, latest activity with **names from ENS** (`aiko.nafuda.eth`), graders |
| 2 | https://nafuda.sololin.xyz/title/bgs-sim/1004827304 | Title page: BGS-style label with **subgrades as ENS text records**, pill "index matches ENS ✓", **provenance flow**, trade interest, transfer. Scroll down: tap the slab (genuine, then clone, then "Attack: replay"); **"How ENS resolves this name"** shows the registry at each level and where the wildcard resolver is found |
| 3 | https://nafuda.sololin.xyz/explore | Filters (grader, grade, "For trade only"), sort; "Asking ¥…" badges come from signed asks |
| 4 | https://nafuda.sololin.xyz/map | Market map: who traded with whom (arrow labels show declared volume) |
| 5 | https://nafuda.sololin.xyz/collector/0x192Fe9ee6b82B6a5c2C1bE9A7eE89EAc91D38240 | **Your wallet** as a collector: it holds titles from all three graders. Connect it and a button appears to set `sololin.nafuda.eth` as your primary name (one transaction; the name and its addr record are already set up) |
| 6 | https://nafuda-grader.sololin.xyz | Grader console: dashboard, **Intake** (kanban of signed submissions), Issue (4 steps), Trust (live), **Name tree** |
| 7 | https://nafuda-grader.sololin.xyz/intake?as=cgc-sim | The "Title issued" column holds submission #13, made by the live e2e run below |

## 2. What exists now

**On Sepolia**
- Three graders under `nafuda.eth`, each with its own emancipated registry and its own controller:
  - `psa-sim` (v1): the original grader
  - `cgc-sim` (v1)
  - `bgs-sim` (**TitleControllerV2**: subgrades stored as text records)
- About 45 titles, 16 collectors including your wallet, and dozens of transfers, each carrying a declared price. The **market simulator** keeps trading on the Mac mini until 08:00 JST.
- Collector names `<name>.nafuda.eth` (official `PermissionedResolver`), and **primary names** for the 15 demo wallets.
- Contracts and transactions: [docs/deployments.md](deployments.md).

**Code** (every part is TypeScript except the contracts)
- `contracts/`: TitleControllerV2 plus 7 tests. All 6 mutations of its checks were caught.
- `packages/core` (26 tests): verification, issue rules, and EIP-712 signed messages.
- `server/` (6 unit tests plus 5 integration tests on Postgres): indexer, API, signed-intent endpoints, write limits.
- `apps/collector` and `apps/grader`: React. `web/` (v2) is gone from the tree but kept in git history.
- `e2e/`: four suites (public, live, batch, consistency), described in section 3.
- `scripts/`:
  - `deploy-grader.ts`, `seed.ts`, `market.ts`: new graders, demo data, simulated trades
  - `names.ts`, `social.ts`: collector names, demo intents
  - `collectors.ts`, `chips.ts`: demo data generators

**Hosting:** see [docs/hosting.md](hosting.md). Everything runs on the Mac mini, and nothing else there was touched.

## 3. How it was tested

| What | Result |
|---|---|
| `forge test` | 32/32 |
| `npm test` (core, server) | 26 + 6 unit tests, plus 5 API integration tests on a real Postgres (in CI with a Postgres service) |
| Typecheck and build of both apps; both Docker images | ✓ (also in CI: `.github/workflows/web.yml`) |
| `e2e/public.test.ts` against the live site | 26/26 (every page loads without console errors; index matches ENS; resolution path; S1, S2, S4; trust checks) |
| `e2e/live.test.ts` on Sepolia, driving both apps through a Node-side test wallet | Full path passed, in two runs, using the real apps and real transactions: kenji submits → CGC-Sim grades, seals and **issues 4000317221** → ENS resolves it to kenji → kenji asks, yuki bids → kenji transfers with a declared ¥84,000 → the index shows it → a non-grader wallet is refused before sending. The first run stopped at the ask, which exposed a real bug (see below); after the fix, the run resumed from that step. One check failed on test timing and has since been fixed |
| `e2e/batch.test.ts` on Sepolia | The intake board's batch issue: CGC-Sim issued every sealed submission and each was marked issued ✓ |
| `e2e/consistency.test.ts` | Every indexed title's holder and chip vs ENS: 45/45 ✓ |
| Fork rehearsals | Graders added **after** the final lock on a fork; names and primary names on a fork before Sepolia |

Found and fixed by the tests overnight:
- An ask on a title issued moments ago was refused, because the indexer had not seen the title yet. The server now checks the holder on chain in that case.
- Two containers starting at once could both run a migration. Fixed with a transaction-level advisory lock; tested by starting 3 processes at once.
- A grader's "issued" step accepted any well-formed tx hash. It is now checked against the receipt.

## 3b. Enhanced Access Control pass (2026-09-26 afternoon)

- [docs/access-control.md](access-control.md) maps every resource and role, and what the lock changes. `npm run roles -- --network sepolia` prints the live map.
- **Corrected claim:** the grader holds `REGISTRAR_ADMIN`, so it could grant itself `REGISTRAR` for new certs. The README and the trust panel no longer say it "cannot bypass" the controller.
- **Per-title EAC checks** on every title page and as the last step of the buyer check: resolver at the grader level is its controller; the controller issued it; the holder has only `CAN_TRANSFER_ADMIN`; the holder is the sole assignee; the registry is emancipated.
- **Collectors own their identity names:** each got `SET_RESOLVER` on `<name>.nafuda.eth` (16 transactions). Titles stay transfer-only.
- **EAC on screen:**
  - The title page has **"Who can do what"**: a live matrix where each cell is that actor's call simulated against the contracts, **attack buttons** that replay attacks and show the contract's own revert, and the **role bitmaps**.
  - The grader console's Trust page has an **access-control map** with a "Today (live)" / "After the final lock (projected)" toggle: 5 resources with powers left today, 0 after.
- **`lock.ts` now locks every grader.** It used to lock only psa-sim. Dry run on Sepolia: all 5 steps would succeed.

## 3c. Curvegrid MultiBaas: second witness (2026-09-26, 15:30–16:15)

- **What it is.** MultiBaas indexes the three grader registries on its own infrastructure and pushes every transfer to `POST /api/hooks/multibaas` through a signed webhook. The server compares that with its own index, both ways. Open https://nafuda.sololin.xyz/developers#witness: at 16:10 it showed 4 witnessed events, 4 agreeing and 0 unwitnessed.
- **Where else it shows:**
  - the Activity page: a status line, and "✓ Curvegrid" on each witnessed event;
  - the grader console's Trust page: one line.
- **Tests:**
  - server: 24/24, including signed, tampered, stale and replayed deliveries, both directions of the comparison, and batch transfers on Postgres;
  - the public e2e suite: three new checks.
- **Found and fixed:** the indexer ignored `TransferBatch`, so a sale of two or more names in one call would have been missing from every list. No such transfer had happened on chain.
- **Market simulator:** running again on the Mac mini until 2026-09-30 00:00 JST. It trades once every 8–15 minutes, with a 0.1 ETH budget; a transfer costs about 0.0001 ETH. Stop it with `docker stop nafuda-market-1`.
- **Keys.** The MultiBaas API key is only in your local `.env`, and it was pasted into the chat: **rotate it** (create a new key, delete the old one). The server only has the webhook secret, in the Mac mini's `hosting/.env`.

## 3d. Card categories, light version (2026-09-26, 16:15–16:30)

- **What it is.** BGS-Sim's controller (v2) now also records the card's category at issuance, as ENS text records: `card.category`, `card.game` or `card.sport`, `card.year` and `card.language`. There were no contract changes.
- **Demo titles.** Eight BGS-Sim titles were issued with categories, 1004827401–408: Pokémon ×2, Yu-Gi-Oh! ×2, One Piece, Magic, baseball and basketball. 1004827402, Pokémon · ENG · PRISTINE 10, is **yours**.
- **Where to look:**
  - https://nafuda.sololin.xyz/explore?category=pokemon: the category row filters titles.
  - https://nafuda.sololin.xyz/title/bgs-sim/1004827401: the label line "2025 POKÉMON JPN", and the "Card records" row.
  - The grader console's Issue page, as BGS-Sim: a category picker at the grade step. Coming from the intake board, v2 graders now stop at that step.
- **Checks:**
  - core tests 41;
  - server tests 25, including the category filter on Postgres;
  - read through the Universal Resolver with viem: `card.game` = `pokemon`.
- **Limits.**
  - PSA-Sim and CGC-Sim (v1) cannot record categories.
  - Older titles stay unclassified, since records are fixed at issuance.
  - Game names are real; the cards are fictional demo cards.

## 4. Decisions that are yours

1. **The final lock** (`scripts/src/lock.ts --execute`). It is irreversible. New graders and names can still be added after it: this was rehearsed on a fork. When it has run, the Trust page shows "Applied".
2. **Your primary name**: `sololin.nafuda.eth` is registered to your wallet and waits for one `setName` transaction from you (the button is on your collector page).
3. **README team line**: the `TODO(author)` in the Team section.
4. **Demo script**: [docs/demo-script.md](demo-script.md) is rewritten for v3. The recording is yours.

## 5. Known gaps and honest notes

- **i18n is partial.** Navigation, the home page, the buyer check and its outcomes, and section titles are translated. Detail pages are English.
- **The market's trades are simulated,** and prices are declared by the (simulated) sellers. The site says so.
- **Mobile:** the core pages were checked at 390 px. The grader console is desktop-first.
- **MetaMask itself was not driven by the tests.** The e2e wallet signs in Node with the demo keys. Please try one issue and one transfer with the real extension.
- **Heads-up:** your local docker context is `mini-ts` (the Mac mini). While testing, a throwaway Postgres container briefly ran on the mini, bound to `0.0.0.0:55433` with password `dev` and no data. It existed for about 2 minutes and was removed. Local testing then used `--context colima`.
- **Sepolia ETH:** the operator went from 1.327 ETH (after your 1 ETH) to 0.997 ETH. Most of the difference was not burned: it was moved to the demo collectors and graders to pay their gas, and about 0.27 ETH of it is still in their wallets. Gas was about 1 gwei all night.
