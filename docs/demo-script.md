# Demo video script (target 3:00, hard limit 2:00–4:00)

ETHGlobal rules: 2–4 minutes, at least 720p, screen recording (no phone), **your own voice** (no AI voiceover or TTS), no music-only narration, no heavy speed-ups.

**Before recording**
- [ ] `cd scripts && npm run reset -- --network sepolia`: both demo titles are back with alice
- [ ] Open the live page, plus a terminal in `scripts/`
- [ ] MetaMask on Sepolia with **alice** imported (for the transfer in scene 3). Otherwise use `npm run transfer` in the terminal
- [ ] Browser zoom so the page reads well at 720p

| # | Time | On screen | Say (draft; rephrase in your own words) |
|---|---|---|---|
| 1 | 0:00–0:25 | Page header; zoom on the disclaimer | "Graded card slabs are being cloned: counterfeiters copy a real cert number onto a fake slab, and the official lookup still says it exists. Chips are coming to slabs, but every grader would keep its own database, and none of them track who owns the card. Nafuda puts both on ENS." |
| 2 | 0:25–0:50 | Step 1: look up `12345678`. Point at Holder, Slab chip, Grader | "The grader, here a simulated PSA called PSA-Sim, sealed a chip in this slab and issued the name 12345678.psa-sim.nafuda.eth. It resolves to the owner, Alice, and stores the chip's address. This page reads it through the ENSv2 Universal Resolver, like any ENS client would." |
| 3 | 0:50–1:25 | Step 2 Genuine; step 3 pick alice; **Tap**: green. Then step 4: transfer to bob, re-lookup shows bob | "At a card show, Bob taps the slab. The chip signs a fresh random challenge, and the signature matches the chip on ENS. Alice is the registered holder. Bob pays, and Alice transfers the name: that's the sale. The name now resolves to Bob." |
| 4 | 1:25–1:50 | Step 2 **Clone**, tap: red | "Now Mallory brings a slab with the same cert number. The label is perfect, but its chip can't produce the signature: not the slab the grader sealed." |
| 5 | 1:50–2:10 | Step 2 Genuine, step 3 pick **mallory**, tap: amber | "What if Mallory stole the real slab? The chip checks out, but Mallory isn't the holder on ENS. Ask for the title transfer, or walk away." |
| 6 | 2:10–2:20 | Result: click **Attack: replay** | "And a signature captured earlier can't be replayed: every tap is a new challenge." |
| 7 | 2:20–2:45 | Terminal: `npm run verify -- --network sepolia` (V3 emancipated), or the README trust table | "Why ENSv2: the grader's registry is emancipated, so nobody, not the grader and not us, can claw back a title. Holders can only transfer, not re-point the records. Safe transfers enforce that for every buyer, built into v2." |
| 8 | 2:45–3:00 | README top | "Nafuda. Every slab wears its name." |

After recording: `npm run reset -- --network sepolia`, then check the length: `ffprobe -v error -show_entries format=duration -of csv=p=0 demo.mp4` must be between 120 and 240.
