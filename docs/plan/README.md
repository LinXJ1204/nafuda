# Planning artifacts

ETHGlobal requires teams to include spec files, prompts, and planning artifacts in the submission repo. This folder holds every planning document for the project, with honest timestamps.

**Official hacking start: 2026-09-25 21:00 JST.** The first commit in this repo was made at 21:08:40 JST.

| Document | What it is | Written by | Time (JST, 2026-09-25) |
|---|---|---|---|
| [00-brainstorm-v1.md](00-brainstorm-v1.md) | The first idea: a custody registry for vaulted graded cards | The author, by hand | Around 13:30, **before kickoff** |
| [card-custody-plan.md](card-custody-plan.md) | Plan v1: custody registry (superseded by v2) | Written by Claude Code after discussion with the author | Created 16:51, last edited 18:39, **before kickoff** |
| [slab-title-plan.md](slab-title-plan.md) | Plan v2: grader-issued ENS title + chip verification (current direction) | Same as above | Created 18:39, **before kickoff**; last pre-kickoff edit at 21:06 (rename to Nafuda) |
| [slab-title-implementation.md](slab-title-implementation.md) | Implementation plan: phased checklist with acceptance criteria | Same as above | Created 21:02, last edited 21:06 |
| [web-v2-plan.md](web-v2-plan.md) | Web v2 plan: separate consumer and grader pages, self-hosting, event-based index | Same as above | 2026-09-25 22:03, **after kickoff** |

All planning documents are in Traditional Chinese, the author's working language. The pre-kickoff ones are kept as written; later edits are in git history. English summaries:

- **Brainstorm v1**: vaults publicly claim custody of a cert number through a unique, expiring ENS name, so a cloned slab of a vaulted card can be detected.
- **Plan v1**: a feasibility review of v1 against the ENSv2 Beta source, plus a critique. The main problem is that counterfeiters can simply avoid vaulted cert numbers, so the value moves to cross-platform double-vaulting detection.
- **Plan v2 (current)**: the grader seals an NFC chip into the slab and issues a transferable ENS name, `<cert>.psa-sim.nafuda.eth`, recording the chip's address and the holder. A buyer verifies the chip signature and checks that the name resolves to the seller. A sale is a `safeTransferFrom` of the name. The title registry is emancipated, so nobody can claw titles back.
- **Implementation plan**: phases P0–P9 with checklists, commands, and acceptance criteria.
- **Web v2 plan**: splits the web app into a consumer side (OpenSea-style browsing, title pages with transfer history, verification) and a grader console (issue titles, issued list, trust panel). It is self-hosted with Docker and Cloudflare Tunnel, reads lists and history from on-chain events via getLogs (no indexer), and is scoped in three tiers.

Notes:

- **Nothing but planning documents existed before kickoff.** All code is in this repo, starting from the first post-kickoff commit.
- The author made every direction and trade-off decision. Claude Code researched, critiqued, and wrote the documents down. See [../ai-usage.md](../ai-usage.md).
- The documents mention `ens-v2.md`, `contracts-v2-beta`, and `ens-v2-experiments`. These are the author's pre-event study notes and experiments on ENSv2: reading the official source line by line and verifying behavior on Sepolia Beta. They are not part of this repo, and no code was copied from them.
- Every post-kickoff change to these documents is recorded in git history.
