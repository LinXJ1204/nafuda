# Demo video script (target 3:40; the rule is 2:00–4:00)

**ETHGlobal rules:**
- 2 to 4 minutes long, at least 720p.
- Audio in **your own voice**: no music, no AI voice-over, no text-to-speech.
- A screen recording.
- No heavy speed-ups. Cutting out a block wait is fine.

The story follows **one slab from the grader's bench to its next owner**, then shows why nobody has to trust us:
- the contracts refuse every attack;
- an independent indexer (Curvegrid) agrees with ours;
- the lock is on chain.

## Before recording

- [ ] **Two browser profiles**, because the two apps are separate origins with separate wallet connections:
  - **Profile A:** MetaMask with **BGS-Sim's grader key** (`GRADER_BGS_SIM_PK` in `.env`, testnet only). Open https://nafuda-grader.sololin.xyz. The key holds about 0.011 ETH, enough for about 10 issues.
  - **Profile B:** MetaMask with **your wallet** (`0x192F…8240`, about 1.5 ETH; its primary name is already `sololin.nafuda.eth`). Open https://nafuda.sololin.xyz.
- [ ] In profile B, go to `/submit`, submit a card to **BGS-Sim**, and sign. It now waits in the *Received* column of the grader's Intake board.
- [ ] Open every page of the script once before recording, so its code and data are loaded: Intake, a title page, Witness, Market, Trust.
- [ ] Browser window about 1440×900, zoom 110–125%, bookmarks bar hidden, other tabs closed. Turn on macOS **Do Not Disturb**.
- [ ] Test the mic in a 10-second recording.
- The market simulator keeps trading every 8–15 minutes. Other trades may show up in the feeds, and that's fine.

## Scenes

| # | Time | On screen | Say (in your own words) |
|---|---|---|---|
| 1 | 0:00–0:20 | Collector app, **home** | "Graded card slabs get cloned. Counterfeiters copy a real cert number onto a fake slab, and the official lookup still says it exists. The chip inside tells you nothing about who owns the card. Nafuda gives every slab an ENS name as its title." |
| 2 | 0:20–0:55 | **Profile A, grader console → Intake.** Your card: *Start grading* → *Seal as cert* → *Issue the title*. At the grade step, set the subgrades and the category (*Trading card games · Pokémon · 2025 · Japanese*) → review → confirm in MetaMask. Cut the block wait. You should see "Title issued" | "I'm the grader now: BGS-Sim, a simulated Beckett. I grade the card, seal it in a slab with a chip, and issue its title: an ENSv2 name under bgs-sim.nafuda.eth. The name records the chip, the grade and the card's category as text records, and it belongs to the person who submitted the card." |
| 3 | 0:55–1:20 | Click through to the **title page** (profile B). Point at "resolved via ENS", "index matches ENS" and the **Card records** row. Scroll to **How ENS resolves this name** | "This page reads everything through the ENSv2 Universal Resolver, right in the browser. The grader's resolver answers for every cert by wildcard and computes each record from on-chain state. Any ENS client gets the same answer." |
| 4 | 1:20–1:50 | **Check this slab:** genuine slab + holder → green. Clone → red. *Attack: replay this signature* → rejected | "At a card show, the buyer taps the slab. The chip signs a fresh challenge, the signature matches the chip on ENS, and the seller is the holder. A clone with the same cert number fails, and an old signature can't be replayed." |
| 5 | 1:50–2:20 | Scroll to **Who can do what**. Click **The grader tries to take it back**. The log fills with `EACUnauthorizedAccountRoles` | "Why trust it? ENSv2 Enhanced Access Control. The holder can do exactly one thing: transfer. Every other cell is that party's call simulated against the live contracts. Watch the grader try to take the title back: the registry refuses every step. Not us, not the grader, not a stranger." |
| 6 | 2:20–2:45 | Profile B (your wallet): **Transfer** the new title to **kenji** with a declared price, for example ¥98,000. Confirm, cut the wait. The provenance flow shows the new owner | "Selling the card is a name transfer. I declare the price in the transfer itself, and the provenance shows every owner since the grader." |
| 7 | 2:45–3:15 | Click the **✓ Curvegrid** badge in the header → **Witness**: your transfer appears as *agrees*, with the price. Then the **Market** page | "Our lists come from our own indexer, so don't take our word for it. Curvegrid MultiBaas indexes the same contracts on its own servers and sends us every event through a signed webhook. Here is my transfer: both indexes agree, down to the declared price. That feeds the market view: what a grade is worth." |
| 8 | 3:15–3:35 | **Profile A → Trust:** the access-control map, all green, *Final lock: Applied* | "Finally, the one-way lock is on chain. Nobody can re-point a grader's names, us included. What's left is only the grader's right to issue new certs, and each title page checks that too." |
| 9 | 3:35–3:45 | Home | "Nafuda. Every slab wears its name." |

The Curvegrid delivery usually arrives within a minute. If scene 7 is recorded right after scene 6 and the transfer isn't there yet, wait a moment and reload.

## Recording on a Mac

- **Record:** press ⇧⌘5 and choose *Record Entire Screen* (or a selected area of at least 1280×720). Under *Options*, pick your microphone and turn on *Show Mouse Clicks*. Stop with the ⏹ icon in the menu bar. On a Retina screen, the result is 1080p or more.
- **Easiest editing:** record each scene as its own clip. Stop during block waits.
  1. Open the first clip in QuickTime Player.
  2. Use *Edit → Add Clip to End…* for each of the others.
  3. Trim with *Edit → Trim*.
  4. Export with *File → Export As → 1080p*.

  iMovie also works.
- **Check before uploading:**
  - Length: 2:00–4:00. In Terminal, `mdls -name kMDItemDurationSeconds demo.mov` must print a number between 120 and 240.
  - Resolution: at least 720p (QuickTime: *Window → Show Movie Inspector*).
  - Audio: only your voice, with no background music.

## If something goes wrong

- A slow transaction: cut the wait.
- MetaMask misbehaves in scene 2: the grader can also issue from the **Issue** page.
- A page shows an RPC error: reload. The app falls back across four public Sepolia RPCs.
