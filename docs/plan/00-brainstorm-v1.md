# 鑑定卡保管身分層 — Raw Brainstorm v1

> 狀態:未定案,拿來吵的。編號沿用 v0 的習慣,方便指著說「T8 我不同意」。
> 2026/9/25 13:30 JST,開賽當天。ENS workshop 15:00,5F Workshop Room。

---

## 0. 一句話

**PSA 告訴你「這個證書號是什麼卡」,沒人告訴你「這個證書號的卡現在在哪」。我們用 ENS 名字公開記錄保管位置,讓證書複製從偵測不到變成十秒可查。**

---

## 1. 痛點 — 今天是誰在賠錢

- **P1 買家** — 收藏展、網拍買到印了真證書號的假 slab。PSA 查詢顯示「存在、Charizard PSA 10」,完全正常
- **P2 真卡持有者** — 證書被複製後,自己的真卡要送回 PSA 拆殼重封、換新證書號。歷史斷掉,而且他什麼都沒做錯
- **P3 代幣化平台** — 要證明「這張卡真的在我們金庫」,目前只能說「相信我們」
- **P4 跨平台** — 從 A 平台贖回、到 B 平台重新入庫,鏈上歷史斷裂

? 哪一個最痛?誰會付錢?
→ 直覺:P1 最痛但最分散(買家不會付錢給基礎設施);P3 最可能付錢(透明度是競爭優勢,proof of reserve)。**付錢的是平台,受益的是買家。** 這個分離要想清楚。

---

## 2. 範圍收窄(先寫死,免得被拉走)

- ✅ 有可信保管方的卡(入庫、代幣化)
- ❌ 放在家裡的卡 — 只能自己宣稱「在我這」,等於沒說
- ❌ 鑑定真偽本身 — 那是 PSA 的工作
- ❌ NFC / 實體綁定 — 硬體,不是 36 小時的事

反方:這樣範圍太小?
→ 入庫的卡正是最值錢、最值得偽造的那批。範圍小但密度高。

---

## 3. 角色

| 角色 | 是誰 | 能寫什麼 |
|---|---|---|
| Operator | registry 營運方(黑客松 = 我) | 命名空間、registrar 規則 |
| Grader | PSA / CGC / BGS | 卡片身分 record |
| Custodian | 金庫 | 保管聲明 |
| Platform | Courtyard 之類 | token 指標 |
| Owner | token 持有人 | ? 什麼都不能寫?見 T11 |
| Verifier | 任何人 | 唯讀 |

---

## 4. 名字結構 — 兩個命名空間

### 選項 A:一個名字,custody 是 record

```
12345678.psa.cards.eth
├── grade, card, scan_hash    ← grader 才能寫
├── custody                   ← custodian 才能寫(record 級角色)
└── token                     ← platform 才能寫
```

問題:「同時只有一個保管方」要自己實作(registrar 邏輯或 override `_getSettableRoles`)。custody 的新鮮度要自己算時間戳。

### 選項 B:身分與保管拆成兩個平行命名空間 ⭐

```
12345678.psa.cards.eth              ← 卡片身分,長壽,grader 控制
psa-12345678.custody.cards.eth      ← 保管聲明,會過期,custodian 持有
```

**這個設計的關鍵:「同時只有一個保管方」由名字唯一性白拿。** 一個名字活著的時候只能被註冊一次——第二家金庫想註冊 `psa-12345678.custody.cards.eth` 直接 revert。不用寫任何角色邏輯。

而且:
- 到期 = 保管聲明過期,不用任何人動作
- 保管方續約 = 重新證明卡還在
- 過期後別家金庫可以註冊 = 保管權移轉
- 重新註冊時 eacVersionId 遞增,舊金庫的角色全部被孤立 = Mutable Token IDs 那頁描述的保證,直接拿來用

→ 傾向 B。**ENS 在這裡最承重的不是 record,是「名字唯一 + 會過期 + 重新註冊時權限歸零」這三個性質疊在一起。**

反方:兩個命名空間,查詢要打兩次,UX 變複雜?
→ 驗證頁面一次查兩個就好,使用者看不到。

? `custody.cards.eth` 一個 registry 裝所有卡的保管聲明,label 用 `<grader>-<cert>`。會不會撞?grader 前綴已經隔開了。

---

## 5. Records(身分那一側)

| key | 誰寫 | 用途 | 裝飾嗎? |
|---|---|---|---|
| `grade` | grader | 分數 | ⚠️ PSA 已有,抄來的。見 T2 |
| `card` | grader | 卡名、系列 | 同上 |
| `scan_hash` | grader | PSA 掃描圖的 hash | ✅ 有用:買家比對卡面 |
| `token` | platform | ERC-7930 地址 + tokenId | ✅ 跨鏈指標 |
| `superseded_by` | grader | 重封後的新證書 | ✅ 解 P2 |
| `supersedes` | grader | 反向指標 | ✅ |

保管那一側的 record:`vault`(金庫識別,最好本身是 ENS 名字)、`attested_at`。

---

## 6. 機制

### M1 註冊卡片身分
Grader 評完分 → 透過 registrar 註冊 `<cert>.psa.cards.eth` → 寫 grade / card / scan_hash。
Demo:mock grader。

### M2 保管聲明(選項 B)
```
CustodyRegistrar.claim(grader, cert, ttl):
  require(custodianAllowlist[msg.sender])        // 見 T9
  require(ttl <= MAX_CUSTODY_TTL)                // 例如 30 天
  label = grader + "-" + cert
  registry.register(label, owner=msg.sender, roleBitmap=..., expiry=now+ttl)
  // 已被註冊且未過期 → revert,單一保管方由此成立
```

### M3 續約 = 重新證明
保管方定期 `renew()`。停止續約 → 過期 → 狀態變成 STALE。
? 續約要不要附證據(例如盤點照片的 hash)?還是信任保管方?→ 36 小時信任就好。

### M4 保管移轉
- 金庫 A → 平台贖回 → A 主動 `unregister` → 狀態 RELEASED
- 金庫 B 收到 → `claim` → 狀態 VAULTED
- 中間的空窗 = IN_TRANSIT(或就是 UNKNOWN)

### M5 驗證狀態

| 狀態 | 條件 | 對手上 slab 的意義 |
|---|---|---|
| VAULTED_FRESH | 保管名字活著 | **你手上的是複製品**(高信心) |
| VAULTED_STALE | 保管名字剛過期 | 可疑,要問 |
| RELEASED | 保管方主動釋出 | 無法判斷 |
| UNKNOWN | 從未入庫 | 無法判斷 |

→ 只有第一種能給出強訊號。見 T5、T6。

### M6 衝突事件
第二家金庫嘗試註冊 → revert。**這次失敗本身就是詐騙訊號**(有人手上拿著同證書號的卡想入庫)。要不要記錄下來?失敗的交易不留事件……
? 用一個 `reportConflict()` 函式讓第二家主動回報?

### M7 重封 / 證書停用(解 P2)
舊名字:寫 `superseded_by` → 撤銷所有 record 角色 + admin → **永久鎖定**,誰都改不了
新名字:寫 `supersedes`
→ 歷史鏈保留。真卡持有者的來歷不會因為被複製而斷掉。

### M8 Token 指標
Platform 寫 `token`。贖回時 platform 清掉。
格式沿用 ENSIP-25 用的 ERC-7930 interoperable address(跨鏈)。

---

## 7. 張力 — 要吵的地方

### T1 PSA 已有查詢,ENS 加了什麼?
答:PSA 管真偽(authenticity),我們管位置(possession)。
守住的方式:**demo 裡 grade 不能是主角**。主角是「這張卡現在在金庫,所以你手上這個是假的」。

### T2 grade 這些 record 是不是裝飾?
PSA 不參與的話,grade 只是從 PSA 網站抄的。
- (a) 全部拿掉,身分名字只放 scan_hash + superseded_by
- (b) 保留當顯示用,但說清楚是鏡像
- (c) 只留 scan_hash
→ 傾向 (c) 或 (a)。評審如果問「grade 為什麼在鏈上」而答不出來,扣分。

### T3 誰營運 registry
中立的身分層需要中立的營運方。黑客松是我,現實呢?
- ENS DAO 下的公共命名空間?
- Grader 聯盟?
- 每個 grader 自己營運自己那段(`psa.cards.eth` 給 PSA)?← 這個利用了階層,但 `cards.eth` 根仍是我
→ demo 時當開放問題講,不要假裝解決了。

### T4 身分名字要不要 emancipate?
ENS 題目直接提到「甚至父層無法控制的永久名字」。
- Emancipate:營運方永遠改不了卡的歷史 → 可信中立
- 不 emancipate:營運方可以修錯誤(grader 寫錯)
→ 這條很好吵,而且用到題目點名的功能。傾向:身分名字 emancipate,保管名字不 emancipate(營運方要能踢掉惡意保管方)。

### T5 贖回後的盲點
RELEASED 之後,複製品又偵測不到了。價值只存在於入庫期間。
反方:入庫的正是高價卡,而且代幣化市場的卡大部分時間都在庫裡。

### T6 UNKNOWN 是大多數卡的狀態
沒入庫的卡查了什麼都不知道。訊號很稀疏。
→ 誠實承認。這是保管層,不是萬用驗證器。

### T7 買家真的會查嗎?
Slab 上的 QR 連到 PSA,不是我們。
需要一個入口:網頁、瀏覽器擴充(在網拍頁面上自動標示)、收藏展用的 app。
→ Demo 做網頁就好,但 pitch 要講擴充功能那個畫面。

### T8 過期 vs 時間戳
保管聲明用「會過期的名字」比「一個 attested_at 時間戳」好在哪?
- 過期是協議層的狀態,任何解析器看到的都一樣,不用各自算
- 重新註冊時舊角色自動孤立
- 單一保管方由名字唯一性保證(時間戳做不到這個)
反方:第三點才是真的,前兩點讀者自己算一下也行。
→ **所以選項 B 的論點其實只靠「名字唯一性」。** 這條要守住,別讓評審覺得過期只是換個方式存時間戳。

### T9 誰能當保管方
任何人都能 `claim` 的話,詐騙者自己宣稱保管就好。
需要 custodian allowlist → 誰管 allowlist → 回到 T3。
→ Demo:operator 管 allowlist。保管方的身分本身是 ENS 名字(`vault-a.custodians.cards.eth`),可問責。

### T10 保管方說謊
保管方宣稱卡在庫裡,其實已經被換掉。
→ 這本來就是代幣化卡的信任模型,不是我們新增的風險。我們讓說謊**可被追溯到一個具名的保管方**,不是讓說謊不可能。

### T11 Owner 在這個系統裡是誰?
token 持有人什麼都不能寫?那他的角色是什麼?
- 只是受益者
- 還是他應該能寫一個 `listed_for_sale` 之類的?
→ 先不給寫入權。持有人能寫就能作假。

### T12 Grace period(從 v0 延續,仍未解)
保管名字過期後,是否有寬限期只有原註冊者能續?還是任何人都能註冊?
這決定 M4 的保管移轉能不能運作。**今天 workshop 第一個要問的。**

### T13 隱私 / 安全
公開「哪張高價卡在哪個金庫」→ 竊盜標的?
→ 金庫是高安全設施,平台本來就公開庫存。家裡的卡不在範圍,不會暴露個人住址。這條反而是收窄範圍的另一個理由。

### T14 丟掉 agent 加分
要不要留一個 bridge(買方 agent 查驗後才付款)?
→ 不要。這個題目的力量在於它解一個現在就存在的痛,硬塞 agent 會稀釋它。

### T15 IP
Demo 不用寶可夢卡圖或名稱。用原創佔位卡。

---

## 8. Demo 劇本

1. Mock PSA 評完一張卡 → `12345678.psa.cards.eth` 上線
2. 金庫 A `claim` 保管 30 天 → `psa-12345678.custody.cards.eth` 上線
3. 收藏展上有人賣同證書號的 slab → 驗證頁顯示 VAULTED_FRESH → **複製品**
4. 金庫 B 嘗試 `claim` 同一張 → revert(衝突)

加分:
5. 快轉時間 → 保管過期 → STALE
6. 贖回 → RELEASED → 金庫 B 成功 claim
7. 重封 → 舊名字永久鎖定,新名字 `supersedes` 舊的

---

## 9. 36 小時切法

- **Must**:CustodyRegistrar(claim / renew / unregister)、身分名字註冊、驗證頁面、劇本 1–4
- **Should**:STALE 狀態、custodian allowlist、劇本 5–6
- **Could**:重封鏈(M7)、token 指標(M8)、emancipate 身分名字
- **Won't**:真的接 PSA、NFC、agent、瀏覽器擴充

---

## 10. 可疊加的 sponsor(今天題目全出來了)

- **Curvegrid「Best RWA Tokenization Project」$1,000** — 題目點子列表裡直接寫了「供應鏈資產:追蹤移動、保管、來歷」跟「可程式化的資產控制:權限、白名單、核准流程」。MultiBaas 非必要。README 要五點(一句話摘要、團隊介紹、安裝測試說明等)。**幾乎零成本疊加。** workshop 16:00。
- **World「Best Use of IDKit」$7,500** — 誠實:對不上核心。硬要的話是「贖回實體卡」那個信任時刻,但 World ID 證明的是「唯一真人」而不是「合法持有者」,擋不了身為真人的小偷。他們範例裡的「稀缺商品的公平存取」(抽選、防轉賣)很誘人,但那是另一個專案,別混。
- Intercepta(x402 agent 付款篩查)、Sui、Uniswap、1inch — 不適用

---

## 11. 15:00 ENS workshop 要問的(依優先序)

1. **PermissionedRegistry 過期後有沒有寬限期?寬限期內誰能續約、誰能重新註冊?**(T12,決定 M4 能不能做)
2. 一個 registry 裝大量 label(每張卡一個保管名字)有沒有問題?
3. Sepolia 部署版的 `getState()` 回傳結構、`register()` 的確切簽章
4. Sepolia 上的 Permissioned Resolver 有沒有 `authorizeTextRoles` 這些 record 級函式?
5. Emancipate 在 Sepolia 上能用嗎?(T4)
6. 非 agent 的用例在評分上會不會被打折?加分項的權重多大?

---

## 12. 還沒想清楚的

- 名字。
- 保管 TTL 設多久?30 天?7 天?越短越新鮮,但保管方的營運成本越高
- 平台跟保管方是不是同一個實體?(有些平台用第三方金庫)→ 影響角色表
- M6 的衝突要不要留紀錄?失敗的交易不留事件
- 要不要 indexer 做歷史查詢(ENS 有 indexing 文件)
- 一句給評審的話,要白話版:「PSA 告訴你這是什麼卡,我們告訴你那張卡現在在哪。」← 目前最好的版本
