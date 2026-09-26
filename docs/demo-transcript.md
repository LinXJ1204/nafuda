# Demo video transcript (draft; rewrite it in your own words)

This is the narration for [demo-script.md](demo-script.md).
- `[ ]` = what to do on screen (in Chinese); quotes = what to say.
- **Core:** 550 words, about 4:40 at 150 words a minute and 4:56 at 140. Talk while you click, and cut out block waits.
- ***(optional)*** sentences add 98 words. Record the core first, check the length, then add back only the optional lines that fit under 4:00.

Pronunciation: Nafuda = nah-FOO-dah · ENS = E-N-S · MultiBaas = multi-bass · HMAC = H-mac.

---

**1 · What Nafuda is, and why (0:00–0:35)**
[首頁，不用操作]
> "Hi, I'm ___, and this is Nafuda. It gives every graded trading-card slab an ENS name that works as its title. The grader seals a chip into the slab and issues the name. The name records the chip and resolves to the owner, and selling the card is simply transferring the name."

[還是首頁，可以慢慢往下捲到流程圖]
> "Why does that matter? This week in Akihabara I bought a graded card, and the only check I had was the cert lookup. Counterfeiters beat exactly that: they copy a real cert number onto a fake slab, and the lookup still says it's valid. It can't tell you who owns the card, either. *(optional)* And a chip alone doesn't fix it: a chip only proves itself."

> "Let me show you the life of one slab, starting at the grader."

**2 · The grader issues a title (0:35–1:10)**
[切到 profile A，評級商後台 → Intake]
> "I'm BGS-Sim, a simulated grader modeled on Beckett, and a collector just submitted this card."

[點 Start grading → Seal as cert → Issue the title]
> "I grade it, seal it with a chip, and issue its title."

[評分步驟：設子分數，選 Trading card games · Pokémon · 2025 · Japanese]
> "The subgrades and the card's category, here a 2025 Japanese Pokémon card, go in as ENS text records."

[Review → Issue title → MetaMask 確認；等區塊的時間剪掉]
> "One transaction registers the cert number under bgs-sim dot nafuda dot eth. The grader's contract enforces the rules: one title per cert, the chip is recorded and can never change, and the holder gets exactly one role, the right to transfer."

**3 · Reading it through ENS (1:10–1:35)**
[切到 profile B，打開剛發的權狀頁]
> "On the collector's side, nothing comes from our server. The browser asks the ENSv2 Universal Resolver directly."

[往下捲到 How ENS resolves this name]
> "The title has no resolver of its own: the grader's contract answers for every cert under its name by wildcard, and computes the records from the registry's state. So the address record is always the current owner, and any ENS client gets the same answer."

**4 · Checking the slab (1:35–2:05)**
[捲到 Check this slab → 選 Genuine slab 和 (holder) → 按 Tap the slab and verify]
> "At a card show, the buyer taps the slab. We send a fresh challenge, the chip signs it, and we recover the signer and compare it with the chip on ENS. Then we compare the seller with the holder. Green: this is the slab the grader sealed, and this person owns it."

[選 Clone slab → 再按一次；回到 Genuine 驗證一次 → 按 Attack: replay this signature]
> "A clone with the same cert number fails, and a recorded signature can't be replayed. *(optional)* And a chip signature is proof, never authorization: it can't move anything."

**5 · Why the title can be trusted (2:05–2:40)**
[捲到 Who can do what]
> "Why trust the title itself? ENSv2 Enhanced Access Control. This matrix isn't our claim: every cell is that party's call, simulated against the live contracts."

[按 The grader tries to take it back，等 log 跑完]
> "Watch the grader try to take it back: transfer it, change its resolver, unregister it. The registry refuses every one, because the grader's registry is emancipated and the grader holds no role on this name. *(optional)* The one warning cell is honest: the grader can still authorize a new issuer for future certs, so every title page also checks that its own title came through the grader's contract."

**6 · The sale (2:40–2:55)**
[Transfer this title → 選 kenji → 申報價填 98000 → Transfer title → MetaMask 確認；等待剪掉]
> "The sale itself is one name transfer, with the declared price written into it. *(optional)* Offers on the site are signed off-chain intents; they never move the title."

[轉移完成，指所有權歷史]
> "Roles move with the name: Kenji now holds exactly what I held."

**7 · A second witness, and the market (2:55–3:25)**
[點 header 的 ✓ Curvegrid → Witness 頁]
> "Our lists and charts come from our own indexer, so don't take our word for them. Curvegrid MultiBaas indexes the same registries on its own servers, and pushes every event to us through an HMAC-signed webhook. We check both directions: everything they saw must be in our index, and everything we indexed since they started watching must have been seen by them. That second direction is what would catch us inventing a trade."

[指剛才那筆轉移：agrees，有價格]
> "Here's my transfer, and they read the same price from the transaction's calldata."

[點選單的 Market]
> "*(optional)* Those confirmed prices build the market view: what each grade is worth, by grader and by card."

**8 · The lock (3:25–3:45)**
[切到 profile A → Trust，全綠的地圖]
> "Finally, the lock. On chain, we revoked our own power, and every grader's, to re-point a grader's names. The map is all green: no one, not us and not a grader, can change an existing title. *(optional)* New graders can still join under nafuda.eth, each with its own registry."

**9 · Close (3:45–3:52)**
[回首頁]
> "Nafuda. Every slab wears its name. Thanks for watching."
