# Demo video script (target 3:30, hard limit 2:00–4:00)

ETHGlobal rules: 2–4 minutes, at least 720p, screen recording (no phone), **your own voice** (no AI voiceover or TTS), no music-only narration, no heavy speed-ups. Cutting out a block wait is fine; speeding up the whole video is not.

The story follows **one slab from the grader's bench to its second owner**, across both apps, and ends on why ENS makes it trustworthy.

**Before recording**
- [x] The final lock has run (2026-09-26): scene 7 shows **Final lock: Applied**, the access-control map is all green, and on a title page every attack is refused by the contract (the grader's own `REGISTRAR` grant is the one kept on purpose, shown as !).
- [ ] Two browser profiles (or two browsers), because the apps are two origins with separate wallet connections:
  - **Profile A**: MetaMask with **BGS-Sim's grader key** (`GRADER_BGS_SIM_PK`). Open https://nafuda-grader.sololin.xyz.
  - **Profile B**: MetaMask with your own wallet (`0x192F…8240`) and **kenji** (derive the key from `DEMO_MNEMONIC`, index 1). Open https://nafuda.sololin.xyz.
- [ ] In profile B, submit a card to BGS-Sim from `/submit` as **your own wallet**, so it waits on the intake board. Or record the submission as part of scene 2.
- [ ] Optional: set your primary name from your collector page, so the app shows `sololin.nafuda.eth`.
- [ ] Browser zoom so the page reads well at 720p. Close other tabs.

| # | Time | On screen | Say (draft; rephrase in your own words) |
|---|---|---|---|
| 1 | 0:00–0:20 | Collector app home: hero, stats, lifecycle | "Graded card slabs get cloned: counterfeiters copy a real cert number onto a fake slab, and the official lookup still says it exists. Chips are coming to slabs, but each grader keeps its own database, and none of them tracks who owns the card. Nafuda puts both on ENS." |
| 2 | 0:20–1:00 | **Grader console (profile A)** → Intake. Your submission: Start grading → Seal as cert → Issue the title → set the subgrades and the category (Trading card games · Pokémon · 2025 · Japanese) → review → confirm in MetaMask. Cut the block wait. "Title issued … marked issued" | "This is a grader's console. BGS-Sim, a simulated Beckett, grades my card and seals it with a chip. Issuing creates an ENS name, the cert number under bgs-sim.nafuda.eth, that records the chip and belongs to me. Every step on this board is signed by the grader's key, and the last step is on chain." |
| 3 | 1:00–1:30 | Click through to the **title page** (profile B). Point at "resolved via ENS", "index matches ENS", the subgrades. Scroll to **How ENS resolves this name** | "Here's the title in the collector app. Everything is resolved through the ENSv2 Universal Resolver in the browser. This diagram is live: the resolver sits on the grader's name as a wildcard, and it computes every record from on-chain state, subgrades included. Any ENS client gets the same answer." |
| 4 | 1:30–2:05 | **Check this slab**: genuine + holder → green; clone → red; "Attack: replay" → rejected | "At a card show, the buyer taps the slab. The chip signs a fresh challenge that matches the chip on ENS, and the seller is the holder. A clone with the same cert number fails, and an old signature can't be replayed." |
| 5 | 2:05–2:35 | Switch to kenji in profile B: **Make an offer**. Switch back to your wallet: **Transfer** to kenji with a declared price. Provenance flow updates | "Kenji makes an offer: a signed intent, not a payment. At the show he taps, pays, and I transfer the name. The sale is an ENS transfer, and the provenance shows every owner since the grader." |
| 6 | 2:35–2:55 | **Explore**, **Market map**, a collector page with `aiko.nafuda.eth` | "Across three graders and a night of trading, every name you see comes from ENS reverse resolution. Collectors have names under nafuda.eth, too." |
| 7 | 2:55–3:20 | **Grader console → Trust**, then **Name tree** | "Why ENSv2: each grader runs its own emancipated registry under one namespace. Nobody can claw back a title, not the grader and not us. Holders can only transfer, and safe transfers enforce that for every buyer. This page reads it live." |
| 8 | 3:20–3:30 | Home | "Nafuda. Every slab wears its name." |

After recording, check the length: `ffprobe -v error -show_entries format=duration -of csv=p=0 demo.mp4` must be between 120 and 240.

**Fallbacks.**
- If a transaction is slow on camera, cut the wait.
- If MetaMask misbehaves, the grader's issue step also works from the Issue page, and a transfer also works from `scripts/`: `npm run transfer -- --network sepolia --from <role> --to <role> --cert <cert>`, for the original demo roles.
