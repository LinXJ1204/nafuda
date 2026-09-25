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

