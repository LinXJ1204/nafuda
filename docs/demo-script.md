# Demo video script (target 3:00, hard limit 2:00–4:00)

ETHGlobal rules: 2–4 minutes, at least 720p, screen recording (no phone), **your own voice** (no AI voiceover or TTS), no music-only narration, no heavy speed-ups. Cutting out a block wait is fine; speeding up the whole video is not.

The story follows **one slab through its whole life** on the live site, https://nafuda.sololin.xyz: the grader issues its title, a buyer checks it at a card show, the seller transfers it, and the trust panel shows why nobody can take it back.

**Before recording**
- [ ] Decide on the final lock (`scripts/src/lock.ts`). If it has run, the Trust page shows **Final lock: Applied** in scene 7. If not, say "the final lock is the last step before launch" instead.
- [ ] MetaMask on Sepolia with two accounts imported, testnet keys only: **grader** (`GRADER_PK`) for scene 2 and **alice** (`ALICE_PK`) for scene 5. Start with grader selected.
- [ ] On https://nafuda.sololin.xyz/grader/#/issue, note the first slab marked **Awaiting title**; below it is `12345680`. Each take uses up one pool slab, because a title can never be issued twice. There are 10.
- [ ] Browser zoom so the page reads well at 720p. Close other tabs.
- [ ] Optional: `cd scripts && npm run reset -- --network sepolia` puts the two original demo titles back with alice.

| # | Time | On screen | Say (draft; rephrase in your own words) |
|---|---|---|---|
| 1 | 0:00–0:20 | Collector app, Explore: hero and the gallery | "Graded card slabs get cloned: counterfeiters copy a real cert number onto a fake slab, and the official lookup still says the number exists. Chips are coming to slabs, but each grader keeps its own database, and none of them tracks who owns the card. Nafuda puts both on ENS." |
| 2 | 0:20–0:55 | **Grader console → Issue.** Point at the green "Connected as the PSA-Sim grader". Pick `12345680` on the bench, holder **alice**, **Issue title**, confirm in MetaMask. Cut the block wait. "Title issued" | "This is the grader's side: a simulated PSA we call PSA-Sim. The card is graded and sealed with a chip. Issuing creates an ENS name, 12345680.psa-sim.nafuda.eth, which records the chip's address and belongs to the submitter, Alice. The console checks everything the contract would reject before it asks me to sign." |
| 3 | 0:55–1:15 | Click **Open it in the collector app**. Title page: "resolved via ENS", Holder alice, Slab chip; scroll to **Any ENS client can read it** | "Now the collector's side. Everything here is resolved through the ENSv2 Universal Resolver, exactly like any ENS client would. There is no Nafuda API." |
| 4 | 1:15–1:55 | **Check this slab before you buy.** Genuine, seller **alice**, **Tap**: green. Then **Clone**, tap: red. Then Genuine with seller **mallory**: amber. Then **Attack: replay**: rejected | "At a card show, Bob taps the slab. The chip signs a fresh challenge, and it matches the chip on ENS, and Alice is the holder. A clone with the same cert number fails: its chip can't sign as the real one. If Mallory stole the real slab, the chip passes but Mallory isn't the holder. And an old signature can't be replayed." |
| 5 | 1:55–2:20 | Switch MetaMask to **alice**. **Transfer this title** to bob, confirm. The page reloads: holder bob, History shows the transfer | "Bob pays, and Alice transfers the name. That's the sale. The name now resolves to Bob, and the history is read straight from on-chain events. No indexer, no database." |
| 6 | 2:20–2:30 | **Explore**, then **My titles** or bob's holder page | "Every title and its owner, browsable like a marketplace, but the trade itself happens in person, with the slab in hand." |
| 7 | 2:30–2:55 | **Grader console → Trust** | "Why ENSv2: the grader's registry is emancipated, so nobody can claw back a title, not the grader and not us. Only the controller can issue, the grader kept no power over issued titles, and holders can only transfer. ENSv2's safe transfers enforce that for every buyer. This page reads it live from the chain." |
| 8 | 2:55–3:00 | Explore hero | "Nafuda. Every slab wears its name." |

After recording, check the length: `ffprobe -v error -show_entries format=duration -of csv=p=0 demo.mp4` must be between 120 and 240.

If a transaction is slow on camera, the terminal is the fallback for scene 5: `cd scripts && npm run transfer -- --network sepolia --from alice --to bob --cert 12345680`.
