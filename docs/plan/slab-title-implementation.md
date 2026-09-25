# Nafuda 名札 — 實作計劃書

> 搭配 [slab-title-plan.md](slab-title-plan.md)（產品計劃 v2）使用，本文件只管「怎麼做、做到什麼程度才算完成」。
> H0 = 官方開賽時間。提交截止 **2026-09-27（日）09:00 JST**，目標 **07:00 前送出**，留 2 小時緩衝。
> 每個階段結束都有一道關卡：驗收標準沒有全部達成，就照「砍功能規則」處理，不要拖進下一個階段。

---

## 0. Repo

### 0.1 位置

| 項目 | 決定 |
|---|---|
| 本機路徑 | `ENS-research-and-experiment/nafuda/`，**獨立的 git repo**。研究 repo 的 `.gitignore` 加上 `nafuda/`，比照 `contracts-v2/` 的做法 |
| 為什麼放這裡 | 在 Claude Code 的工作目錄內，不用額外授權；研究 repo 不會追蹤它；提交用的 repo 有一條從開賽才開始的乾淨歷史 |
| GitHub | 在帳號 `LinXJ1204` 下開一個新 repo，**開賽後才建**。本機沒有 `gh`，所以用網頁建立，再 `git remote add` |
| 可見性 | 建議一開始就 public：評審會看 commit 歷史，而且不會發生「提交時忘了公開」的事 |
| 名稱 | `nafuda` |

### 0.2 結構

```
nafuda/
├── README.md                 提交用，H28 之後才認真寫
├── .gitignore                .env、out/、cache/、broadcast/、node_modules/、dist/
├── .env.example
├── docs/
│   ├── plan/                 開賽前寫的規劃文件（附撰寫時間說明，見 §1 的 P0-3）
│   ├── ai-usage.md           AI 使用紀錄，每個工作段落結束時追加
│   └── deployments.md        Sepolia 地址、tx hash、Etherscan 連結
├── demo/
│   ├── slabs.json            模擬晶片：真品和複製品的私鑰與地址（公開的測試金鑰）
│   └── test-vectors.json     晶片簽名測試向量，合約測試和前端共用
├── contracts/                Foundry
│   ├── lib/contracts-v2/     submodule：ensdomains/contracts-v2 @ 71a3b733（Beta 部署 commit）
│   ├── src/TitleController.sol
│   ├── test/TitleController.t.sol
│   ├── foundry.toml
│   └── remappings.txt
├── scripts/                  Node 24 + viem 2.56.8 + TypeScript
│   └── src/  config.ts  addresses.ts  preflight.ts  deploy.ts  verify.ts  issue.ts  transfer.ts  lock.ts
└── web/                      Vite + TypeScript，不用框架
```

`demo/slabs.json` 是模擬晶片的唯一來源：部署腳本從它取出晶片地址寫上鏈，前端的模擬 slab 用它來簽名。

### 0.3 環境變數（`.env`，不 commit）

```
SEPOLIA_RPC_URL=
OPERATOR_PK=  GRADER_PK=  ALICE_PK=  BOB_PK=  MALLORY_PK=
NAME_LABEL=nafuda         # 備案名字被搶走時改這裡
```

五把都用 `cast wallet new` 產生新的 key。在 fork 上不要用 anvil 的預設帳號：#0 在 Sepolia 上有 code，ERC-1155 mint 給它會 revert。

### 0.4 共通規則

- **一個 checklist 項目一個 commit**，至少每 2 小時 push 一次。commit 訊息格式：`[P1] TitleController: label 規則`。
- **不從研究 repo 複製程式碼**，只當參考。官方合約一律透過 submodule 引用。
- **AI 使用紀錄**：每個工作段落結束時，在 `docs/ai-usage.md` 追加一段：哪些檔案、AI 做了什麼、人做了什麼決定。
- **Review 時必查**：沒有任何程式碼會因為收到晶片簽名就改變鏈上狀態（產品計劃 §3.3 的原則）。
- **不可逆操作**（P7 的鎖定）要在指令上加 `--i-understand-this-is-irreversible` 才會執行。

---

## 1. 階段、清單與驗收

### P0　環境（H0–H1）

- [x] P0-1 確認官方開賽時間，記下來
- [x] P0-2 GitHub 建 repo → 本機 `git init` → 第一個 commit（`.gitignore`、`README.md` 骨架）→ push
- [x] P0-3 把 `slab-title-plan.md`、`card-custody-plan.md`、本文件複製到 `docs/plan/`，並在 `docs/plan/README.md` 註明每份的撰寫時間和官方開賽時間
- [x] P0-4 研究 repo 的 `.gitignore` 加上 `nafuda/`
- [x] P0-5 `contracts/`：加 submodule 並釘在 `71a3b733` → `git submodule update --init --recursive` → 設定 remappings
- [x] P0-6 `scripts/`：`package.json`（viem 固定 2.56.8）、`tsconfig`、`config.ts`（讀 `.env`、fork / sepolia 切換）
- [x] P0-7 產生 5 把 EOA、寫 `.env`、領 Sepolia ETH：operator 和 grader 各 ≥ 0.05，alice 和 bob 各 ≥ 0.01
- [x] P0-8 再查一次 `nafuda` 能不能註冊；被搶走就依序改用 `kamifuda` → `hanko` → `menko`（2026-09-25 查過全部可以註冊）
- [x] P0-9 `preflight.ts`

**驗收（Gate 0）**

| # | 標準 | 怎麼驗 |
|---|---|---|
| 1 | 第一個 commit 的時間晚於官方開賽 | `git log --reverse --format='%ci' \| head -1` |
| 2 | 合約編譯成功 | `cd contracts && forge build` exit 0 |
| 3 | 腳本型別檢查成功 | `cd scripts && npm run typecheck` exit 0 |
| 4 | preflight 全部 ✓：5 個地址的餘額都超過門檻；`ETHRegistrar.isAvailable("nafuda") == true`；Beta 核心合約（ETHRegistry、ETHRegistrar、VerifiableFactory、UserRegistryImpl、MockUSDC、UR `0xeEeE…`）都有 code | `npm run preflight` exit 0 |
| 5 | `.env` 沒有被追蹤 | `git ls-files \| grep -c '\.env$'` 等於 0 |

### P1　`TitleController`（H1–H7）

- [x] P1-1 骨架：`REGISTRY`、`GRADER`（immutable）、`Slab` struct、事件、自訂 error
- [x] P1-2 label 規則：只能是數字、不能有前導 0、1–10 位
- [x] P1-3 `issue()`：只有 GRADER 能呼叫；檢查 `chip != 0`、還沒發過 → `register(cert, holder, 0, 0, CAN_TRANSFER_ADMIN, type(uint64).max)` → 寫入 `slabs` → emit
- [x] P1-4 測試用的部署流程（setUp）：在本地建出 root registry → eth registry → nafudaRegistry（`nafuda` 的 subregistry）→ psaRegistry（`psa-sim` 的 subregistry）這一串，grader 撤掉 root 上 `REGISTRAR_ADMIN`、`SET_PARENT`（連同 admin）、`CAN_NAME`（連同 admin）以外的所有角色，讓 psaRegistry 變成 emancipated。**注意**：只撤掉 `UNEMANCIPATED_ROLE_BITMAP` 不夠，grader 還會留著 `ROLE_REGISTRAR`，可以繞過 controller 直接註冊權狀，並給持有人 `SET_RESOLVER`（實作時發現，已寫成測試 `test_setup_graderKeepsOnlyNonDangerousRootRoles`）
- [x] P1-5 `resolve(name, data)`：支援 `addr(bytes32)`、`addr(bytes32,uint256)`（coinType 60）、`text(bytes32,string)`；其他 selector 回傳空值
- [x] P1-6 `supportsInterface`：`IExtendedResolver` 和 ERC-165
- [x] P1-7 `demo/test-vectors.json`：固定的晶片私鑰、訊息、簽名、預期的地址
- [x] P1-8 測試 T1–T7（下表），另外把原本排在 P7-3 的 T8（經過 UniversalResolverV2 的端到端解析）提前完成，因為官方 `V2Fixture` 已經附帶 UR

| 測試 | 驗收內容 |
|---|---|
| T1 | `issue` 之後：owner 是 alice；alice 在 token 上的 roles **完全等於** `CAN_TRANSFER_ADMIN`（比的是相等，不是包含） |
| T2 | 同一個證書號發第二次 → revert；非 GRADER 呼叫 → revert（兩個都要指定 error selector） |
| T3 | `"012345"`、`"12a45"`、`"12345678901"`、`""` 都 revert |
| T4 | `isEmancipated() == true`；alice `safeTransferFrom` 給 bob 成功；bob 再轉給 alice 也成功 |
| T5 | alice 呼叫 `setResolver` 和 `setSubregistry` → `EACUnauthorizedAccountRoles` |
| T6 | `resolve`：`addr` 是 alice，轉手後變成 bob；`slab.chip`、`card`、`grade`、`title.status == ISSUED` 都正確；沒發過的證書號回 `NONE`，`addr` 回 0 |
| T7 | test vectors：用晶片私鑰簽的會還原成 chip 地址；用 clone 私鑰簽的不會 |

**驗收（Gate A，H7）**

1. `forge test -vv` 全部通過，T1–T7 都在測試清單裡
2. 合約不可升級、沒有 owner；GRADER 以外的人沒有任何寫入函式可以呼叫
3. 程式碼裡沒有任何「收到晶片簽名就改變狀態」的路徑

**砍功能規則**：H9 還沒過 Gate A → 砍掉 `issued_at` 和 coinType 形式的 `addr`，只保留 `addr(bytes32)` 和四個 text key。**resolver 本身不能砍。**

### P2　部署腳本與 fork 彩排（H7–H10）

- [x] P2-1 `deploy.ts`：產品計劃 §4 的第 1–9 步。**可以重跑**：每一步先檢查鏈上狀態，已經做過的就跳過。狀態寫進 `docs/deployments.md`
- [x] P2-2 `issue.ts`：從 `demo/slabs.json` 發兩張權狀給 alice（`12345678`、`12345679`）
- [x] P2-3 `verify.ts`：下表 V1–V8，任何一項失敗就 exit 1
- [x] P2-4 `transfer.ts`：`--from alice --to bob --cert 12345678`
- [x] P2-5 在 anvil fork 上從零跑一次，再重跑一次

| # | 檢查項目 |
|---|---|
| V1 | `nafuda.eth` 的 owner 是 operator |
| V2 | nafudaRegistry 和 psaRegistry 的 `getParent()` 都指回上一層 |
| V3 | `psaRegistry.isEmancipated() == true` |
| V4 | controller 在 psaRegistry root 上持有 `REGISTRAR` |
| V5 | 透過 viem（UR `0xeEeE…`）：`getEnsAddress("12345678.psa-sim.nafuda.eth") == alice` |
| V6 | `getEnsText(…, "slab.chip")` 等於 `demo/slabs.json` 裡的地址 |
| V7 | `getEnsText("99999999.psa-sim.nafuda.eth", "title.status") == "NONE"` |
| V8 | 只在 fork 上跑：alice → bob 轉手後 V5 變成 bob，再轉回 alice |

**驗收**：在 fork 上 `deploy` 從零跑完；第二次跑沒有送出任何交易；`verify` V1–V8 全部 ✓。

實際結果（2026-09-25 21:30）：fork 上從零部署共 12 筆交易；第二次跑區塊高度不變（沒有送出任何交易）；V1–V8 全部 ✓，其中 V5–V7 走的是 viem 加上 Beta 的 UR proxy `0xeEeE…`。跟產品計劃 §4 的差異：`nafuda.eth` 的 subregistry 直接在 `ETHRegistrar.register` 時帶入，省掉一筆 `setSubregistry`。

### P3　上 Sepolia（H10–H12）

- [x] P3-1 `npm run deploy -- --network sepolia`
- [x] P3-2 `npm run issue -- --network sepolia`
- [x] P3-3 `npm run verify -- --network sepolia`（V1–V7）
- [x] P3-4 `docs/deployments.md`：所有地址、tx hash、Etherscan 連結
- [ ] P3-5 在 ENS App Beta / Explorer 上查 `12345678.psa-sim.nafuda.eth`，把結果記下來（會影響 demo 主畫面用哪一個）

**驗收（Gate B，H12）**：V1–V7 在 Sepolia 上全部 ✓，而且 `docs/deployments.md` 已經 push。

實際結果（2026-09-25 21:37）：Sepolia 上 V1–V7 全部 ✓，地址見 `docs/deployments.md`（由 `npm run report` 產生）。P3-5 需要人工用瀏覽器確認（Explorer 是前端渲染的網站，抓下來只有空殼）。

### P4　睡覺（H12–H18）

- [ ] 睡前 push；在 `docs/ai-usage.md` 記錄進度；把起床後的第一件事寫在 commit 訊息裡

### P5　前端（H18–H23）

- [x] P5-1 買家頁：輸入證書號 → 顯示卡名、分數、持有人、晶片地址、`title.status`
- [x] P5-2 模擬 slab 面板：真品和複製品各一顆，介面是 `sign(message)`（和 libhalo 相同），畫面上標示「模擬晶片」
- [x] P5-3 挑戰與驗證：產生 32 bytes 的 nonce 和時間戳；簽名；用 viem 還原簽名者並比對 `slab.chip`；超過 60 秒就拒絕
- [x] P5-4 「賣家是誰」：輸入賣家地址，或讓賣家錢包簽同一個挑戰（Should）
- [x] P5-5 結果：依產品計劃 §1.3 的四種情況顯示
- [x] P5-6 過戶：用注入的錢包（MetaMask 匯入 alice 和 bob）呼叫 `safeTransferFrom`；`transfer.ts` 當備案
- [x] P5-7 頁面附一段 viem 程式碼，示範任何 client 都查得到
  （前端的判斷邏輯另有 `web/src/verify.test.ts`，用 node:test 跑 S1–S5、挑戰逾時、格式錯誤的簽名，共 9 個測試；bundle 已掃描過，找不到 `.env` 的任何值）
- [ ] P5-8 部署到公開網址：GitHub Pages，由 `.github/workflows/pages.yml` 發布到 `https://linxj1204.github.io/nafuda/`。**需要作者先到 repo 的 Settings → Pages → Source 選「GitHub Actions」**

**驗收**

| 情境 | 輸入 | 預期 |
|---|---|---|
| S1 真品，賣家是持有人 | `12345678`、真品晶片、賣家 = alice | 「真 slab、賣家是登記持有人」 |
| S2 複製品 | `12345678`、複製品晶片 | 「不是評級商封的 slab」 |
| S3 偷來的真卡 | `12345678`、真品晶片、賣家 = mallory | 「slab 是真的，但賣家不是持有人」 |
| S4 沒有權狀 | `99999999` | 「無法判斷」 |
| S5 重放 | 把 S1 的簽名拿去對一個新的挑戰驗證 | 拒絕 |
| S6 過戶 | 在頁面上 alice → bob | 重新查詢後持有人是 bob |

- 在無痕視窗打開公開網址，S1–S6 全部重現
- `web/dist` 裡搜尋不到 `.env` 的任何值；唯一的私鑰是 `demo/slabs.json` 裡標明為模擬的晶片金鑰
- viem 版本是 2.56.8，而且顯式傳了 UR 地址

### P6　完整彩排（H23–H25）

- [ ] 在 Sepolia 上用公開網址把產品計劃 §6 的劇本 1–7 跑一遍，記錄每一步花了多久
- [ ] 準備備案：任何一筆交易卡住時，改用哪一個腳本

**驗收（Gate C，H25）**：劇本 1–7 一次跑完、沒有手動修補；總長度不超過 5 分鐘（剪接後才能壓在 4 分鐘以內）。

### P7　Should（H25–H28，照順序做，時間到就停）

- [x] P7-1 賣家用錢包簽名證明自己是持有人（P5-4 的簽名版；在 P5 一起完成，賣家簽的訊息前綴是 `NAFUDA-SELLER|`，跟晶片的 `ENS-SLAB|` 分開，避免被混用）
- [x] P7-2 鏈上的 `verifyChip()`，並用同一組 test vectors 測試（在 P1 一起完成）
- [x] P7-3 用 Beta fixture 的 UniversalResolverV2 做端到端測試（在 P1 一起完成，即 T8）
- [ ] P7-4 **最後鎖定（不可逆）**：`npm run lock -- --network sepolia --execute --i-understand-this-is-irreversible`。腳本已完成，預設只做模擬；在 live Sepolia 狀態的 fork 上彩排過：3 個步驟全部成功，鎖定後 V1–V11 全部 ✓，權狀照樣可以轉手。**在 Sepolia 上執行之前要作者明確同意**

P7-4 的驗收：`verify` 多跑三項 ——
- nafudaRegistry `isEmancipated() == true`
- grader 在 `psa-sim` token 上沒有 `SET_SUBREGISTRY` / `SET_RESOLVER`（連同 admin）
- operator 在 `nafuda.eth` token 上沒有 `SET_SUBREGISTRY`（連同 admin）

另外，用 `eth_call` 模擬這三個呼叫，結果都要是 revert。

### P8　提交素材（H28–H31）

- [x] README 草稿（2026-09-25 21:45，英文；團隊介紹留給作者填），逐項打勾：一句話；問題；運作方式（直接用產品計劃 §1.6 的圖）；用到哪些 v2 功能，附程式碼行號連結；公開網址；Sepolia 地址；安裝與測試指令；誠實的邊界；營運方的權力；團隊介紹；AI 使用揭露；規劃文件的撰寫時間說明；Curvegrid 要求的內容（一句話摘要、團隊介紹、安裝說明；MultiBaas 標註「未使用」）
- [ ] 影片：自己配音、螢幕錄影（旁白草稿見 `docs/demo-script.md`；錄影前後各跑一次 `npm run reset -- --network sepolia`）
- [ ] 簡報（選做，可以用 README 的圖）

**驗收**

- `ffprobe -show_entries format=duration` 介於 120 到 240 秒之間
- 解析度 ≥ 720p；沒有 AI 配音或 TTS；不是手機錄的；沒有過度加速
- 在 GitHub 上看 README，Mermaid 圖正常顯示

### P9　提交（H31–H36，07:00 前送出）

- [x] 從乾淨環境驗證：`git clone --recursive <repo>` → `cd contracts && forge test` 通過（由 GitHub Actions 的 `contracts` workflow 在每次 push 時執行）
- [ ] repo 是 public；在無痕視窗打開公開網址，S1–S4 能用
- [ ] ETHGlobal 表單：repo、公開網址、影片、勾選 ENS「Best Use of ENSv2」和 Curvegrid「Best RWA Tokenization」、AI 使用揭露
- [ ] 送出之後再打開一次提交頁，確認所有連結都正確

---

## 2. 整體完成的定義

| 來源 | 要求 | 對應 |
|---|---|---|
| ENS 獎 | 建在 Sepolia 的 ENSv2 上 | P3 |
| ENS 獎 | v2 功能是核心，不是裝飾 | wildcard resolver、emancipated registry、safe transfer、階層 registry（P1、P2） |
| ENS 獎 | 有可以操作的 demo 和公開網址 | P5、P9 |
| ENS 獎 | 開源 | P9 |
| Curvegrid | repo 裡有合約、測試、文件；README 有一句話摘要、團隊介紹、安裝說明 | P1、P8 |
| ETHGlobal | 開賽後才開始；commit 歷史連續；揭露 AI 使用；影片 2–4 分鐘 | P0、§0.4、P8 |

---

## 3. 還要你決定的

- [x] 專案名 Nafuda、`nafuda.eth`、repo `nafuda`
- [x] 模擬評級商 PSA-Sim（label `psa-sim`）
- [ ] GitHub repo 的可見性（建議一開始就 public）
- [ ] 前端放在哪裡（P5-8；Vercel、Netlify、GitHub Pages 都可以）
- [ ] 營運方的收入模式（pitch 用，產品計劃 §1.6 標為待定）
