# Demo video transcript (draft; rewrite it in your own words)

This is the narration for [demo-script.md](demo-script.md): `[ ]` = what to do on screen (in Chinese), quotes = what to say. It is about 470 words, roughly 3:30 at a calm pace. If a take runs over 4:00, drop the sentences marked *(optional)*.

Pronunciation: Nafuda = nah-FOO-dah · ENS = E-N-S · MultiBaas = multi-bass.

---

**1 · Home (0:00–0:20)**
[首頁，不用操作]
> "Hi, I'm ___. This week in Akihabara I bought a graded card, and I realized I had no real way to check it. Fake slabs copy a real cert number, and the official lookup still says it exists. It can't tell you who owns the card, either. So I built Nafuda: every slab gets an ENS name as its title."

**2 · Grader console: issue (0:20–0:55)**
[切到 profile A，評級商後台 → Intake]
> "This is the grader console. I'm BGS-Sim, a simulated grader modeled on Beckett. A collector just sent me this card."

[點 Start grading]
> "I grade it,"

[點 Seal as cert]
> "seal it in a slab with a chip inside,"

[點 Issue the title → 設子分數、選 Trading card games · Pokémon · 2025 · Japanese]
> "and issue its title. I add the subgrades, and I file it as a Japanese Pokémon card from 2025."

[Review → Issue title → MetaMask 確認；等區塊的時間剪掉]
> "Issuing registers an ENSv2 name under bgs-sim dot nafuda dot eth. It records the chip, the grade and the category, and it belongs to the collector."

**3 · Title page (0:55–1:20)**
[切到 profile B，打開剛發的權狀頁]
> "Now the collector's side. This page reads everything from ENS, right in the browser, through the ENSv2 Universal Resolver."

[指 Card records 那一列]
> "The category is just ENS text records."

[往下捲到 How ENS resolves this name]
> "The grader's resolver answers for every cert by wildcard, and computes the records from on-chain state. *(optional)* Any ENS client gets the same answer."

**4 · Check the slab (1:20–1:50)**
[捲到 Check this slab → 選 Genuine slab 和 (holder) → 按 Tap the slab and verify]
> "At a card show, the buyer taps the slab. The chip signs a fresh challenge. It matches the chip on ENS, and the seller is the holder. Green: safe to buy."

[選 Clone slab → 再按一次]
> "A clone with the same cert number fails,"

[回到 Genuine、驗證一次 → 按 Attack: replay this signature]
> "and an old signature can't be replayed."

**5 · Who can do what (1:50–2:20)**
[捲到 Who can do what]
> "But why should anyone trust this? Because of ENSv2 Enhanced Access Control. Each cell here is a real call, simulated from that person's address against the live contracts. The holder can do exactly one thing: transfer."

[按 The grader tries to take it back，等 log 跑完]
> "Now the grader tries to take the title back. The registry refuses every step. The same goes for us, and for a stranger."

**6 · Sell it (2:20–2:45)**
[Transfer this title → 選 kenji → 申報價填 98000 → Transfer title → MetaMask 確認；等待剪掉]
> "Selling the card is just a name transfer. I send it to Kenji and write the price into the transfer."

[轉移完成，指所有權歷史]
> "The ownership history now shows every owner since the grader."

**7 · Curvegrid and the market (2:45–3:15)**
[點 header 的 ✓ Curvegrid → Witness 頁]
> "Our lists come from our own server, so why believe them? Curvegrid MultiBaas watches the same contracts on its own servers, and sends us every event through a signed webhook. We compare both sides, in both directions."

[指剛才那筆轉移：agrees，價格有顯示]
> "Here's my transfer: both sides agree, down to the price."

[點選單的 Market]
> "Those confirmed prices feed the market view. *(optional)* Here's what a grade is worth."

**8 · The lock (3:15–3:35)**
[切到 profile A → Trust，全綠的地圖]
> "One last thing: the one-way lock is on chain. Everything is green. Nobody can re-point a grader's names, and that includes me. The grader can only issue new certs, and every title page checks those too."

**9 · Close (3:35–3:45)**
[回首頁]
> "Nafuda. Every slab wears its name. Thanks for watching."
