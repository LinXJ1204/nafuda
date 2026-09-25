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

**What the author did**: created the GitHub repo.
