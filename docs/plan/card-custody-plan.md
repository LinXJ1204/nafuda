# 鑑定卡保管登記 — 黑客松計劃 v1

> **已被 [slab-title-plan.md](slab-title-plan.md)（v2：評級商發權狀＋晶片）取代。** 本文件保留作為研究紀錄；v2 引用的 ETHGlobal 規則與獎項分析仍以這份為準。

> 由 Raw Brainstorm v1 收斂而來，2026-09-25（開賽日）。ETHGlobal Tokyo，ENSv2 賽道，單人參賽。
> 合約行為都對照過 `contracts-v2-beta`（= Sepolia Beta 鏈上版本），細節見 [ens-v2.md](ens-v2.md)。
> 名字暫定 `cards.eth`（`<name>.eth`），H0 的第一件事是選定名字。
> **提交截止：2026-09-27（日）09:00 JST**（ETHGlobal Tokyo 活動頁）。

---

## 0. 相對 brainstorm v1 定案了什麼

| 項目 | brainstorm v1 | 定案 | 理由 |
|---|---|---|---|
| 主角 | 收藏展的買家查驗（劇本 3） | **跨平台重複入庫的衝突（M6）**；買家查驗留作第二個場景 | 入庫是偽造者想代幣化、抵押、上架時繞不過的那一關；買家查驗在偽造者學會避開之後就沒效了 |
| 一句話 | PSA 告訴你這是什麼卡，我們告訴你它在哪 | **同一張卡，不能同時在兩個金庫。** | 原本那句承諾得比系統做得到的多 |
| 名字結構 | 選項 A / B | **B：custody 是獨立的命名空間** | A 需要 per-name 的 record 權限，Beta 沒有（`grantSetterRoles` 的權限是整個 resolver 共用） |
| 身分命名空間 | Must | **Could** | PSA 不參與的話它只是鏡像；保管側不依賴它 |
| 驗證頁文案 | 「你手上的是複製品（高信心）」 | **有出處的陳述**（§5） | 系統只知道「證書號重複了」，不知道哪一張是假的；信心來自具名保管方和它的入庫方式 |
| M6 衝突 | revert | **不 revert**：emit 事件並累加計數 | 失敗的交易不會留下事件；衝突要能在鏈上查得到 |
| T12 寬限期 | 留到 workshop 問 | **自己決定**：TTL 上限 30 天，寬限期 7 天 | registry 本身沒有寬限期，要由 registrar 實作 |
| 續約的意義 | 重新證明卡還在 | **保管方具名重申** | 沒有附證據的續約證明不了卡還在 |
| 為什麼用 ENS | 名字唯一性 | **標準解析、可查詢的權限、保管方身分即名字**（§1.3） | 唯一性用一個 mapping 就做得到 |

---

## 1. 定位

### 1.1 問題

- 偽造者從網拍照片抄下真的證書號，印在假標籤上，裝進另一張同款卡。
- PSA 證書號**不是亂數，是依序發的**（8–10 位數，號段對應年代，例如 7xxxxxxx–8xxxxxxx 大約是 2022–2024）。捏造的號碼查不到、或查出來是別張卡，所以偽造者一定得用「同卡同分數」的真證書號。來源包括刊登照片、拍賣紀錄；同一批送評的卡通常是連號，所以從一個已知號碼往前後試，也可能找到同款卡的其他證書號（PSA Public API 免費版每天 100 次查詢）。
- PSA cert 查詢只證明「這個號碼存在」。SecureScan 的掃描圖（2019 年起、Economy 以上等級）可以拿來比對，但要比到印刷點的程度，一般買家做不到。
- 各家金庫（PSA Vault、Courtyard/Brink's……）只替自己的庫存說話。同一個證書號在不同平台重複入庫，目前沒有人彙整、也沒有人抓得到。

### 1.2 誰付錢、誰受益

- **付錢**：代幣化平台、接受卡片 token 當抵押品的借貸協議、同時聚合多個平台的市場。它們要的是「這張卡沒有在別處被代幣化」。
- **受益**：入庫卡的 token 持有人（他們的卡不會被複製品稀釋價值），以及會查詢的買家。

### 1.3 評審問「為什麼要用 ENS」的回答

1. **查詢介面就是標準 ENS 解析。** 任何 ENS client 用 `getEnsText("psa-12345678.custody.cards.eth", "custody.status")` 都查得到狀態，不需要我們的 API。瀏覽器擴充、錢包、explorer 都能直接用。
2. **營運方的權力可以被查詢。** custody token 是 soulbound，角色表公開，`isEmancipated()` 可以直接查。評審問營運方能做什麼，就在 demo 裡直接列出來（§2.2）。
3. **保管方的身分本身就是 ENS 名字。** allowlist 就是 `custodians.cards.eth` 這個 registry。踢掉一個保管方 = unregister 它的名字。入庫方式寫在它名字上的 `intake` record。

### 1.3.1 Roadmap（pitch 只講一句，黑客松不做）

名字是每張卡在鏈上的中立 handle。之後的報價／交易意向、成交價紀錄、資格標記，都可以掛在同一個名字下，任何 ENS client 都查得到。

限制要自己心裡有數：
- **交易意向**要由 token 持有人寫，但 custody 名字屬於金庫。而且卡片 token 在別條鏈上（例如 Courtyard 在 Polygon），在 L1 上沒辦法直接驗證寫入者是不是持有人。意向本身是多人、高頻寫入的資料，適合放在 orderbook；ENS 只負責指過去。
- **成交價紀錄**：ENS record 寫一次蓋一次，每筆成交都上鏈很貴。合理的做法是 wildcard 加 CCIP-read，由資料提供者的 gateway 回傳簽名過的資料。這樣 ENS 提供的是查詢介面，資料對不對取決於提供者。

### 1.4 誠實的邊界（pitch 要主動講，不要等評審問）

- 大多數卡的狀態都是 UNKNOWN。這是保管層，不是萬用的鑑定工具。
- 偽造者會改抄沒入庫的卡。系統能保證的是「**入庫卡的證書號，複製了也騙不過會查的買家**」，不保證複製品整體變少。
- 保管方可能說謊，也可能被騙。對策是讓每筆保管陳述都有具名保管方和它的入庫方式，信心由查詢的人自己判斷。
- T3（誰來營運 registry）還沒解決。黑客松期間營運方就是我，能做的事全部列在 §2.2。

---

## 2. 名字樹與角色

```
<name>.eth                              operator EOA 持有（ETHRegistrar，MockUSDC）
└─ cardsRegistry（UserRegistry）
   ├─ custody     → custodyRegistry（UserRegistry）      resolver = CustodyController（wildcard）
   │   └─ psa-12345678    owner = vault-a EOA，roleBitmap = 0，expiry = claim + ttl
   ├─ custodians  → custodiansRegistry（UserRegistry）   resolver = operator 的 PermissionedResolver
   │   ├─ vault-a         text intake = grader-verified
   │   └─ vault-b         text intake = platform-inspected
   └─ psa（Could）→ psaRegistry：12345678 …（§8）
```

### 2.1 Label 規則：唯一性的前提

「同時只有一個保管方」完全靠名字唯一性成立，所以**同一張卡只能對應一個 label**：

- `grader` 只能是 allowlist 裡的小寫字串：`psa` / `cgc` / `bgs` / `sgc`
- `cert` 只能是數字，而且不能有前導 0
- label = `grader + "-" + cert`，由合約組出來，不讓呼叫者傳入

少了這條規則，`psa-012345678` 和 `psa-12345678` 就是兩個不同的名字，唯一性就破功了。

### 2.2 角色配置

| 對象 | root 角色 | `isEmancipated()` | 說明 |
|---|---|---|---|
| custodyRegistry | CustodyController：`REGISTRAR \| RENEW \| UNREGISTER`；operator：只拿 admin | false（刻意的） | operator 可以透過 controller 踢掉惡意的保管方 |
| custodiansRegistry | operator：`ALL_ROLES` | false | operator 管保管方的 allowlist |
| cardsRegistry | operator：`ALL_ROLES` | false | 黑客松期間不做 emancipation；列在 Could |
| custody token | 無（roleBitmap = 0） | — | 沒有 `CAN_TRANSFER_ADMIN`，所以不能轉移（→ `TransferDisallowed`），保管權無法私下轉讓來繞過 allowlist |
| custodian token | 無 | — | 同上 |

**Operator 能做的事**（demo 裡要誠實列出來）：踢掉保管方、新增保管方、更換 controller、換掉整個 custody 子樹（因為還持有 cardsRegistry 的 root 權限和 `<name>.eth` 的 `SET_SUBREGISTRY`）。

**Operator 不能做的事**：替別人 claim 保管、轉移保管 token、改寫衝突計數。

---

## 3. 合約：`CustodyController`

一支合約同時當 custodyRegistry 的 registrar，以及 `custody.<name>.eth` 的 wildcard resolver。單人開發用一支比較省部署和串接的工夫，而且 resolver 本來就需要讀 registrar 存的資料。

### 3.1 狀態與參數

```solidity
IPermissionedRegistry immutable CUSTODY;       // custodyRegistry
IPermissionedRegistry immutable CUSTODIANS;    // custodiansRegistry
uint64 immutable MAX_TTL;                      // 正式 30 days
uint64 immutable GRACE;                        // 正式 7 days；黑客松部署用 120s，pitch 講正式值
mapping(uint256 labelId => string) custodianOf;   // 目前或最後一個保管方的 label（例如 "vault-a"）
mapping(uint256 labelId => uint32) conflicts;
```

### 3.2 狀態定義（全部由 `CUSTODY.getState(id)` 算出）

| status | 條件 | 誰能 claim |
|---|---|---|
| `UNKNOWN` | `expiry == 0` | 任何保管方 |
| `VAULTED` | `status == REGISTERED` | 沒人能 claim（其他人 claim → 記成 conflict） |
| `STALE` | `AVAILABLE ∧ latestOwner ≠ 0 ∧ now < expiry + GRACE` | 只有原保管方能 `renew` 復活；其他人 claim → 記成 conflict |
| `LAPSED` | `AVAILABLE ∧ latestOwner ≠ 0 ∧ now ≥ expiry + GRACE` | 任何保管方（重新註冊時舊 token 被 burn、`eacVersionId` +1） |
| `RELEASED` | `AVAILABLE ∧ latestOwner == 0 ∧ expiry ≠ 0` | 任何保管方 |

可以這樣區分，是因為自然過期不會 burn token（`latestOwner` 還在），而 `unregister` 會 burn 並把 expiry 設成當下的時間。

### 3.3 函式

| 函式 | 誰 | 行為 |
|---|---|---|
| `claim(custodianLabel, grader, cert, ttl)` | 保管方 | 先檢查 `CUSTODIANS.getOwner(id(custodianLabel)) == msg.sender`、`ttl ≤ MAX_TTL`、label 規則（§2.1）。VAULTED 或 STALE（非原保管方）→ `conflicts[id]++`、emit `CustodyConflict`、`return false`。已由自己持有（VAULTED 或 STALE）→ revert `AlreadyHeld`（請改用 `renew`）。其他狀態 → `CUSTODY.register(label, msg.sender, 0, 0, 0, now + ttl)`、寫入 `custodianOf`、emit `CustodyClaimed`。 |
| `renew(grader, cert, ttl)` | 原保管方（而且仍在 allowlist 上） | 狀態須為 VAULTED 或 STALE。`newExpiry = max(expiry, now + ttl)`。STALE 時走 registry 的 revive 路徑，token 原樣復活。 |
| `release(grader, cert)` | 目前的保管方 | `CUSTODY.unregister(id)`，emit `CustodyReleased` |
| `revoke(grader, cert)` | operator（Should） | 踢掉保管方，同樣走 `unregister` |
| `renewBatch(...)` | 保管方（Should） | 營運成本的答案：每張卡每 30 天一筆交易，要能批次送 |
| `resolve(name, data)` | 任何人（view） | `NameCoder.extractLabel(name, 0)` 取出第一個 label → `getState`。回傳的 text key：`custody.status`、`custody.custodian`（`vault-a.custodians.<name>.eth`）、`custody.expires`（unix 時間）、`custody.conflicts`。其他 key 回空字串。Should：`addr(60)` 回傳目前的保管方地址。 |
| `supportsInterface` | — | `IExtendedResolver` + ERC-165。UR 找到的 resolver 不是 leaf 時，必須支援 `IExtendedResolver`（`LibResolution.validateResolver`） |

事件：`CustodyClaimed`、`CustodyRenewed`、`CustodyReleased`、`CustodyRevoked`、`CustodyConflict(labelId, label, holder, challenger, challengerLabel)`。

### 3.4 Foundry 測試（Gate A 要全部通過）

1. claim 後狀態是 VAULTED；`safeTransferFrom` 和 `unsafeTransfer` 都 revert
2. 第二家 claim：不 revert、`conflicts == 1`、有 emit 事件
3. 不在 allowlist 上的地址 claim → `NotCustodian`；被踢掉的保管方 renew → `NotCustodian`
4. label 規則：前導 0、大寫、未知的 grader 都 revert
5. 過期後變 STALE：他人 claim 記成 conflict；原保管方 renew 後回到 VAULTED
6. 過了寬限期變 LAPSED：他人 claim 成功，舊的 resource 失效
7. release 後變 RELEASED：他人 claim 成功
8. `resolve()`：用 DNS-encoded name + `text(node, key)` calldata 直接呼叫，五種狀態的 `custody.status` 都正確，UNKNOWN 也能回傳
9. （Should）透過 Beta 測試 fixture 的 UniversalResolverV2 走一次完整解析

---

## 4. 部署（Sepolia Beta）

所有地址集中放在一個 `addresses.ts`，部署腳本要能**一鍵重跑**，以防 Beta 在活動期間重新部署。

1. 選名字，用 `ETHRegistrar.isAvailable` 確認可以註冊（另外準備 3 個備選）
2. `MockUSDC.mint` → `commit` → 等 60s → `register`（1 年，5 個字以上的名字 $8）
3. 部署 custodyRegistry、custodiansRegistry、cardsRegistry（`VerifiableFactory.deployProxy(UserRegistryImpl)` 各一次），以及 operator 的 PermissionedResolver（opResolver）
4. 部署 `CustodyController(custodyRegistry, custodiansRegistry, 30 days, 120)`
5. `ETHRegistry.setSubregistry(<name>, cardsRegistry)`，接著 `cardsRegistry.setParent`
6. `cardsRegistry.register("custody", op, custodyRegistry, controller, …)`、`register("custodians", op, custodiansRegistry, opResolver, …)`，接著兩個子 registry 各自 `setParent`
7. `custodyRegistry.grantRootRoles(REGISTRAR | RENEW | UNREGISTER, controller)`
8. `custodiansRegistry.register("vault-a" / "vault-b", vaultEOA, 0, opResolver, 0, 1y)`，再用 `setText` 寫 `intake`
9. 驗收（**Gate B**）：用 viem 的 `getEnsText` 查到 `vault-a.custodians.<name>.eth` 的 `intake`，以及 `psa-1.custody.<name>.eth` 的 `custody.status == UNKNOWN`

先在 `anvil --fork-url` 上完整跑一遍（可以 warp 時間），再上 Sepolia。三個 EOA（operator、vault-a、vault-b）都要是新的，並且先領好 Sepolia ETH。

---

## 5. 驗證頁

- Vite + TypeScript + viem 2.56.8，不用框架。要顯式傳 `universalResolverAddress: 0xeEeE…EeEe`
- 輸入 grader + cert → 查 4 個 `custody.*` text，再查保管方名字上的 `intake` → 組成一句有出處的陳述：

| status | 文案 |
|---|---|
| VAULTED | 此證書號目前由 **vault-a.custodians.<name>.eth** 保管（入庫檢驗：grader-verified），最後一次重申：〈時間〉。同一個證書號不會有兩張真卡；如果你手上這張不是從 vault-a 贖回的，請送回重新鑑定。 |
| STALE | vault-a 已經 〈N〉 沒有重申保管。先向 vault-a 確認。 |
| LAPSED | 最後由 vault-a 保管，之後停止重申。無法判斷。 |
| RELEASED | vault-a 在 〈時間〉 釋出了這張卡（贖回或移轉）。無法判斷。 |
| UNKNOWN | 沒有任何保管方登記過這個證書號。無法判斷。 |

- `conflicts > 0` 時顯示醒目的標示：「此證書號有 N 次重複入庫的嘗試」
- 頁面上附一段 viem 程式碼，標明「任何 ENS client 都查得到」
- Should：每 12 秒輪詢一次，demo 時衝突一發生就會跳出來
- 保管方的操作（claim / renew / release）用終端機腳本 `custody.ts <cmd> --as vault-a|vault-b`，不做錢包 UI（單人開發，而且 demo 時切換 MetaMask 帳號太慢）

---

## 6. Demo 劇本（影片 2–4 分鐘）

活動規定：影片長度 2–4 分鐘，超出範圍會被退件；至少 720p；不能用手機錄；不能用 AI 配音或 TTS；不能只放音樂沒有旁白；不能過度加速。旁白要自己錄。

1. **問題**（20s）：一個證書號、PSA 查詢只證明號碼存在、各家金庫各說各話
2. vault-a `claim psa-12345678` → 驗證頁顯示 VAULTED，出處是 vault-a，入庫方式 grader-verified
3. 收藏展情境：有人拿同證書號的 slab 出來賣 → 查詢 → 出現有出處的陳述
4. **高潮**：vault-b（手上是複製品）claim 同一張 → 交易成功但記成 `CustodyConflict`，驗證頁跳出「重複入庫嘗試 1 次」→ 帶出一句話：**同一張卡，不能同時在兩個金庫**
5. 在終端機用純 viem 一行 `getEnsText` 查同一個名字 → 證明查詢不需要我們的 API
6. 權力透明：嘗試轉移 custody token → `TransferDisallowed`；列出 operator 能做和不能做的事（§2.2）
7. （Should）一張短 TTL 的卡：STALE → 寬限期內 vault-b claim 記成 conflict → 過了寬限期變 LAPSED → vault-b claim 成功

Sepolia 上不能快轉時間：第 7 步那張卡要在錄影前 3 分鐘先 claim（ttl 設 180s）。

---

## 7. 36 小時時程（單人）

H0 = hacking 開始。H36 不能晚於 9/27 09:00 JST 的提交截止。**開賽之後才建新 repo**（見 §9 ETHGlobal 規則）。

| 時段 | 工作 | 關卡 |
|---|---|---|
| H0–H1 | 新 repo：Foundry，官方 `ensdomains/contracts-v2` 以 submodule 釘在 `71a3b733`，重新設定 remappings；Node 24 + viem 腳本骨架；選定名字 | |
| H1–H6 | `CustodyController` 的 registrar 部分，加上測試 1–7 | |
| H6–H8 | `resolve()`，加上測試 8 | **Gate A（H8）**：測試全過。到 H10 還沒過 → 砍 `revoke` / `renewBatch` 和 STALE／LAPSED 的細節，**不能砍 resolver**：ENS 獎項頁點名的就是「從 parent 的 resolver 用 wildcard resolution 解析 subname」（§13） |
| H8–H11 | 部署腳本，在 anvil fork 上彩排 | |
| H11–H13 | 部署到 Sepolia、註冊名字、建立保管方 | **Gate B（H13）**：§4 第 9 步通過 |
| H13–H19 | 睡覺 | |
| H19–H24 | 驗證頁、`custody.ts` | |
| H24–H26 | 在 Sepolia 上跑一遍劇本 1–6 | **Gate C（H26）**：劇本 1–6 在 Sepolia 上從頭到尾跑得通 |
| H26–H29 | Should：`revoke`、`renewBatch`、`addr(60)`、輪詢、劇本 7 | 過了 Gate C 才做 |
| H29–H32 | README、簡報、錄 demo 影片 | |
| H32–H36 | 提交、緩衝時間、準備評審問答 | |

Could（§8）只有在 H26 前通過 Gate C、而且精神還行的時候才碰。老實說大概率不會做到。

---

## 8. Could

- **身分側**：`psa.<name>.eth` → psaRegistry，由 mock grader 註冊 `12345678` 並寫入 `scan`（圖的 URI）。psaRegistry 做成 emancipated（demo `isEmancipated() == true`）
- **M7 重封鏈**：舊證書另外部署一個 PermissionedResolver，呼叫 `initialize([], [setText(superseded_by …)])`。grants 為空，而初始化期間會跳過權限檢查，所以寫完之後沒有人有任何角色，連 upgrade 權限都沒有。然後 `setResolver` 指向它，再撤掉 token 上的 `SET_RESOLVER`（連同 admin）→ 永久鎖定
- **往上的 emancipation 鏈**：撤掉 `<name>.eth` token 和 cardsRegistry root 上的 `SET_SUBREGISTRY`（連同 admin），讓 operator 換不掉整棵樹（demo 環境別做，做了就改不回來）
- 瀏覽器擴充的 mock 畫面（只放 pitch 投影片）

---

## 9. 風險

| 風險 | 對策 |
|---|---|
| Beta 在活動期間重新部署 | 部署腳本一鍵重跑、地址集中管理；workshop 問清楚 |
| 名字已被註冊 | 準備 3 個備選，H0 就查 |
| ENS App / Explorer 不顯示 wildcard 的 text | demo 主畫面用自己的驗證頁，加上終端機的 viem |
| viem 與 Beta 的 UR 版本不合 | 固定用 2.56.8，並顯式傳 UR 地址 |
| fork 上 anvil 的預設帳號 #0 有 code，ERC-1155 mint 會 revert | 全部用新的 EOA |
| ETHGlobal 規定：專案程式碼要在活動期間寫，git 歷史會被看，一次大 commit 可能被取消資格 | 新 repo 在開賽後才建；官方合約用 submodule（公開 library）；研究 repo 的程式碼只當參考、不整段複製；頻繁小 commit |
| 單人體力 | 嚴格照關卡砍功能；H13–H19 一定要睡 |
| ETHGlobal 的 AI 規則：必須揭露 AI 在哪裡、怎麼被使用；AI 應該是「輔助」而不是「做出整個專案」；完全依賴 AI、隊員沒有實質貢獻的作品，可能失去 partner prize（ENS 賽道就是 partner prize）和決選資格 | 核心合約要自己主導並能逐行講解；README 寫 AI 使用揭露；本計劃和相關 prompt 要放進提交的 repo |

---

## 10. 15:00 ENS workshop

依優先序：

1. **活動期間 Sepolia Beta 會不會重新部署？** 會的話 → 部署腳本的一鍵重跑列為 Must，而且 demo 前再確認一次地址
2. **ENS App Beta / Explorer 會不會顯示自建 UserRegistry 底下的名字？會不會呼叫 wildcard ExtendedResolver 取 text？** 不會的話 → 劇本第 5 步改成主要證據
3. PermissionedResolver 之後會不會加回 per-name 權限？會的話 → pitch 可以說「選項 A 將來可行」
4. 評審會特別看 v2 專屬功能（soulbound、subregistry、emancipation）嗎？非 agent 的用例會不會被打折？答案決定 Could 裡的身分側 emancipation 值不值得硬做

16:00 Curvegrid workshop：確認 README 的必要內容、MultiBaas 是否真的不是必要項目，以及同一個專案能不能同時角逐 RWA 和 Dashboard 兩個獎。

提交前也要確認：每個專案最多能勾選幾個 partner prize。

---

## 11. 提交清單

- [ ] 公開 repo，commit 歷史連續
- [ ] README：一句話、問題、架構圖（§2）、Sepolia 地址與名字清單、安裝與測試指令、誠實的邊界（§1.4）、營運方權力（§2.2）、Curvegrid 的五點
- [ ] Demo 影片（§6）
- [ ] 驗證頁的公開網址（ENS 獎的必要條件：functional demo with live link）
- [ ] 寫明正式參數（TTL 30 天 / 寬限期 7 天）與 demo 參數（寬限期 120s）不同
- [ ] AI 使用揭露：哪些檔案或部分由 AI 產生、哪些是 AI 協助；把本計劃等規劃文件放進 repo
- [ ] 確認本計劃的撰寫時間與官方開賽時間的先後；如果早於開賽，在 README 誠實說明

## 12. 還沒決定的

- 名字（H0 決定）
- 驗證頁放在哪裡（Vercel / GitHub Pages 都可以，到 H24 再決定）
- 平台和保管方是否為同一個實體：MVP 不區分，`intake` record 就足夠表達

---

## 13. 投哪些獎（對照 ETHGlobal Tokyo 2026 獎項頁）

| 獎 | 金額 | 對得上嗎 | 要做什麼 |
|---|---|---|---|
| **ENS：Best Use of ENSv2** | $6,000（1st $3,000） | **主獎**。獎項頁點名「hierarchical registry structure: resolve subnames straight off a parent's resolver with wildcard resolution」，就是 `CustodyController.resolve()`；也點名 Enhanced Access Control（root 角色配置、roleBitmap = 0 的 soulbound）和 permissioned resolvers（custodians 的 `intake`） | 必要條件：建在 Sepolia 的 ENSv2 上、v2 功能是核心而不是裝飾、有 live link、開源。**AI agent 有加分**：不做 agent（T14），但 pitch 可以講一句「任何 agent 都能用標準 ENS 解析直接查保管狀態，不用串接」，這句是真的，成本為零 |
| **Curvegrid：Best RWA Tokenization Project** | $1,000 | 對得上。題目點子裡直接寫了 supply-chain assets（保管、來歷）和 programmable asset controls（allowlist、核准流程） | README：一句話摘要、團隊介紹、安裝說明、MultiBaas 使用回饋（有用才要寫）；repo 裡要有合約、測試、文件。不用 MultiBaas 也能參加 |
| Curvegrid：Best Digital Asset Dashboard | $1,000 | 勉強對得上，而且要多做東西：一個給保管方用的主控台，列出「快到期、要續約」的保管和持有卡的衝突數（題目寫的是「identify actions that need to be taken」） | Should 等級，過了 Gate C 才考慮。先在 16:00 確認同一個專案能不能同時拿 Curvegrid 兩個獎 |
| World：Best Use of IDKit | 最多 2 隊，每隊 $2,500 | 不推薦。防黃牛（公平搶購）和保管是兩個不同的專案。唯一跟本專案一致的切入點是「目擊回報」：買家看到在庫證書號的 slab 在外面販售時回報，用 Proof of Human 加上以證書號為 action 的 nullifier，讓每個真人對每個證書號只能回報一次，防止競爭者洗版打壓行情。技術障礙：World ID 4.0 的鏈上驗證只支援 World Chain / Arc，**不支援 Ethereum Sepolia**；Sepolia 上的 v3 router 只收 Orb 憑證，而且官方標示為 legacy。所以只能靠後端驗證再轉送交易，等於在「不需要我們的 API」的設計裡加進一台受信任的伺服器 | Could，排在 Curvegrid Dashboard 之後 |
| Uniswap：Best Uniswap Stack Contribution | $6,000（1st $3,000） | **資格上符合，得獎機會低，不做**。規則寫「any part of the Uniswap stack … new v4 hooks」，一個 hook 就符合資格。但是：(1) Uniswap 處理的是可互換 token 的流動性，本專案沒有任何可互換的資產，要自己捏造一個「碎片化卡片份額」；現實中不存在這種市場，評審一問「誰會交易它」就答不出來；(2) 用外部狀態擋 `beforeSwap` 是最常見的 hook 模式之一（KYC pool、oracle 斷路器），Uniswap 評審看的是 Uniswap 用得多深，這部分只佔專案一小塊，比不過整個專案都在做 hook 的隊伍；(3) 要花 5–7 小時。原本想靠它回答「為什麼要上鏈」，改成在 pitch 裡講「鏈上狀態可以直接被合約讀取」就好 | — |
| World ID for Agents、Intercepta（x402）、1inch Aqua、Sui | — | 對不上：這幾個獎要的是 agent 付款、DeFi 部位或 Sui 鏈 | — |
| ENS／World／1inch／Uniswap／Intercepta 的 Continuity Track 獎 | — | 不適用：那些是給延續既有專案的隊伍，我們是 Classic Track | — |

