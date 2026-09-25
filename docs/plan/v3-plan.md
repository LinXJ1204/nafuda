# v3 計劃：產品化（多評級商、B/C 兩個獨立前端、後端索引、視覺化、大量資料）

> 2026-09-25 23:10 JST 寫成，作者說「目前的網站太 brief」之後、動手之前。整晚照這份做，作者早上 7 點 review，下午再細修。
> 合約：沿用現有的 `TitleController`，不改；唯一可能新增的合約是 X1（可選，見 §2）。

---

## 0. 作者的要求（23:00 前後）

- 網站太 brief：要多做視覺化的流程，交易歷史要像 flow 那樣呈現
- 資料太少：要多幾筆，最好有**不同的評級商和買賣家**；gas 作者還有 2.65 SepoliaETH
- 先提完整方案，不用考慮做不做得完；早上 7 點要有一大堆東西可以 review
- 可以有後端；Mac mini 上有現成的 db container
- 黑客松很卷，產品看起來越成熟越好
- **B 端（評級商）和 C 端（收藏家）在網頁上要切乾淨**，做成兩個獨立前端也可以，因為兩邊連的錢包不同
- 作者自己的測試錢包：`0x192Fe9ee6b82B6a5c2C1bE9A7eE89EAc91D38240`

## 1. 需要作者拍板的決定（括號內是我的建議）

| # | 決定 | 建議與理由 |
|---|---|---|
| D1 | 前端框架 | **改用 React**，搭配 wagmi（錢包）、TanStack Query（資料）、React Flow（流程圖、轉手 flow）、Recharts（圖表）。畫面會從現在的 6 個長到 20 個以上，還有流程圖、動畫、互動圖表，用手寫 DOM 會越來越難維護，也難做到「成熟」的樣子。純邏輯模組（`verify`、`routes`、`roles`、`events`、`rules`、`trust-rules`）和它們的測試原樣保留。舊版留在 git 裡 |
| D2 | B/C 怎麼切 | **兩個獨立前端、兩個網域**：`nafuda.sololin.xyz`（收藏家）和 `nafuda-grader.sololin.xyz`（評級商後台）。MetaMask 的連線授權是以網域為單位的：放在同一個網域下，評級商和收藏家就會共用同一個「已連線帳號」，切換帳號時兩邊一起被改掉。**不要用 `grader.nafuda.sololin.xyz`**，因為 Cloudflare 免費的 Universal SSL 只涵蓋一層子網域 |
| D3 | 資料庫 | **不共用 mini 上現有的 db container**，在 nafuda 的 compose 裡開一個自己的 Postgres（不對外開 port，用 named volume）。現有的 savori、solog、rag 是別的專案的：它們重設或遷移時會連帶影響這邊，帳密也得共用。多開一個 Postgres 大約只多 30 MB 記憶體 |
| D4 | 新的評級商 | **新增兩家，做法跟 PSA-Sim 一樣**：BGS-Sim（仿 Beckett：0.5 分一級，含四項子分數）、CGC-Sim（仿 CGC Cards）。名稱一律加 `-Sim`，並附上免責聲明。另一個選項是再加一家虛構的日本評級商，增加在地感 |
| D5 | 後端的定位 | **後端只是索引快取，不是信任來源**。權狀頁仍然在瀏覽器端用 ENS 解析，並把後端資料跟鏈上的結果比對，顯示「與鏈上一致 ✓」。這條要守住，否則 ENS 的敘事會變成「資料在我們的資料庫」 |
| D6 | 經費 | 請轉 **1 SepoliaETH** 到 operator `0xa5183ea7E97bf57935c4F8ddbaa6E21cCD6DAa82`。以現在的 1.07 gwei 估算：發一張權狀約 0.0003 ETH、轉手一次約 0.00008 ETH、部署一家評級商約 0.0025 ETH。整份計劃用不到 0.1 ETH，1 ETH 是留給 gas 突然飆高的緩衝 |

## 2. 範圍

依整晚的**執行順序**排，這是順序，不是拿來砍的。每一項完成就 commit。

### A. 鏈上資料（最先做：交易需要時間，而且讓整晚都有真實的活動）

| # | 項目 |
|---|---|
| A1 | `deploy-grader.ts`：部署一家新的評級商。產生新的 grader 錢包，透過 factory 部署 UserRegistry，部署 TitleController，註冊 `<label>.nafuda.eth`（subregistry 和 resolver），setParent，授予 REGISTRAR，最後由 grader 撤掉其他角色。流程跟 psa-sim 一樣，腳本可以重複執行 |
| A2 | 卡片目錄和晶片池產生器擴充：每家評級商有自己的證書號格式（PSA-Sim 8 位數、BGS-Sim 和 CGC-Sim 10 位數）和各自的晶片池；原創卡片目錄約 40 張（妖怪、動物、日式主題），一律標示為 demo card |
| A3 | 收藏家：約 12 個 demo 錢包，每個有自己的角色設定。金鑰由 `.env` 裡的一組 mnemonic 衍生，不進 git。**作者的測試錢包也是其中一位收藏家**，會拿到幾張權狀，讓作者可以用自己的 MetaMask 示範「我的權狀」和過戶 |
| A4 | 種子資料：三家評級商共約 60 張權狀，分數分布接近真實 |
| A5 | 市場模擬器：在 mini 上整晚執行，隨機間隔送出轉手（約 150 筆），讓時間戳分散在幾個小時裡，圖表和活動紀錄才有意義。每筆轉手都附宣告價格（見 C5）。有預算上限，花完自動停 |
| A6 | 收藏家的 ENS 名稱（**要先研究**）：確認 ENSv2 Beta 有沒有 reverse/primary name。有的話，替收藏家設定 `aiko.collectors.nafuda.eth` 之類的名稱和 primary name，UI 就用 `getEnsName` 顯示名字而不是地址，這會是 ENS 評分的加分項。沒有的話，就改用 UI 裡的已知名稱表 |
| X1 | （可選，新合約）TitleController v2：可以存額外的屬性，例如 BGS 的四項子分數，存成 ENS text record，由 BGS-Sim 使用。這能展示「每家評級商可以帶著自己的 resolver schema 加入」。代價是多一份合約和測試要 review；權狀發出後就改不了（因為 emancipated），發現 bug 只能改用新的 label。**預設要做**，你說不要就跳過 |

### B. 後端（TypeScript）

| # | 項目 |
|---|---|
| B1 | `server/`：Node 24、Hono、postgres.js。indexer 從 startBlock 開始增量 getLogs，涵蓋所有評級商，等 N 個確認之後才寫入，避開 reorg。資料表：graders、titles、transfers、holders、blocks。RPC 在伺服器端用作者的 key，不會出現在前端 |
| B2 | API：`/api/stats`、`/api/activity`、`/api/titles`（依評級商、分數、持有人篩選、排序、搜尋）、`/api/titles/:grader/:cert`（含歷史）、`/api/holders/:addr`、`/api/graders/:label`（簡介和分數分布）、`/api/status`（indexer 落後幾個區塊） |
| B3 | 交易意向（鏈下）：持有人標記「可在卡展交易」並附開價，買家送出出價或約見面，全部用 EIP-712 簽名後存進後端。**不轉移任何資產**，跟「權狀跟著實體卡走」的原則一致 |
| B4 | 評級商的收件流程：送評單的狀態（收件 → 評分中 → 封裝，指定晶片 → 已發權狀）。用 SIWE 登入，最後一步才上鏈 |
| B5 | Docker：compose 加上 api、indexer、db；nginx 把 `/api` 轉給 api。測試：indexer 的純邏輯，加上在 CI 裡接 Postgres 跑的 API 測試 |

### C. 收藏家 app v3（`nafuda.sololin.xyz`）

| # | 項目 |
|---|---|
| C1 | 首頁：產品故事，依序是問題、權狀生命週期的**動畫流程圖**（評分 → 封入晶片 → 發 ENS 權狀 → 碰卡驗證 → 過戶）、為什麼用 ENS、給收藏家和給評級商的說明；即時統計和最新活動 |
| C2 | Explore：像交易平台的卡片牆。可依評級商、分數、持有人篩選，依最新、轉手最多、分數排序，也可以搜尋證書號、ENS 名稱或地址。每家評級商就是一個「系列」 |
| C3 | 權狀頁 v3：**轉手 flow 圖**（React Flow：評級商 → 持有人 1 → 持有人 2 …，每條邊標上時間、宣告價格、tx）；**驗證過程視覺化**（挑戰 → 晶片簽名 → 還原地址 → 比對 ENS 的 slab.chip → 比對持有人，一步一步帶出實際數值，另外有手機碰卡的動畫）；**ENS 解析路徑圖**（.eth → nafuda.eth → psa-sim（UserRegistry，resolver 是 TitleController，ENSIP-10 wildcard）→ 12345678，顯示即時數值）；完整的 record 表；「與鏈上一致 ✓」；宣告價格走勢；slab 標籤用的 QR code |
| C4 | Activity：全站活動紀錄（像 OpenSea 的 Activity），可依評級商和事件類型篩選 |
| C5 | 宣告成交價：過戶時可以選擇附上價格（日圓），寫在 `safeTransferFrom` 的 `data` 欄位，indexer 從交易的 input 解出來。價格是自己申報的，畫面上會標明 |
| C6 | 收藏家頁：名稱和頭像（程式產生）、目前持有、以前持有、活動、統計；「我的權狀」 |
| C7 | 市場關係圖：所有收藏家是節點、轉手是邊，看誰跟誰交易過 |
| C8 | 評級商目錄和各家的頁面（像系列頁）：統計、分數分布圖、每天發行數的圖、即時的信任徽章 |
| C9 | 交易意向的介面（B3） |
| C10 | 語言切換：English / 日本語 |
| C11 | 開發者頁：怎麼用 viem 讀權狀、text record 的格式、合約地址 |

### D. 評級商後台 v3（`nafuda-grader.sololin.xyz`，獨立的前端）

| # | 項目 |
|---|---|
| D1 | 多家評級商：連上錢包之後，讀每個 controller 的 `GRADER()` 判斷你是哪一家，介面換成那家的品牌色（PSA-Sim 紅、BGS-Sim 銀、CGC-Sim 藍） |
| D2 | 儀表板：KPI、每天發行數、分數分布、這家評級商的最新活動 |
| D3 | 收件流程看板（kanban）：送評單 → 評分 → 封裝（指定晶片）→ 發權狀（上鏈）。資料存在後端，用 SIWE 登入 |
| D4 | 發行流程 v2：分步驟（選 slab → 評分 → 持有人 → 確認 → 簽名），沿用現有的送出前檢查；支援批次發行 |
| D5 | 已發出清單：搜尋、篩選、匯出 CSV |
| D6 | 信任面板（每家評級商各一份），加上所有評級商的 ENS 樹狀圖（nafuda.eth → psa-sim、bgs-sim、cgc-sim） |
| D7 | 評級商加入說明：一家評級商怎麼加入（自己的 registry、自己的 controller） |

### E. 品質

| # | 項目 |
|---|---|
| E1 | 把 e2e 測試收進 repo（現在放在 scratchpad）：用模擬錢包、在 anvil fork 上跑，涵蓋兩個前端的主要流程 |
| E2 | 細節打磨：載入骨架、交易狀態通知（附 Etherscan 連結）、空狀態和錯誤狀態、手機版 |
| E3 | 文件：README v3（截圖、含後端的架構圖）、hosting（兩個網域）、AI 使用紀錄 |
| E4 | 部署到 mini：收藏家前端、評級商前端、api、indexer、db |

## 3. 早上 7 點你會看到什麼

1. 三家評級商都在 Sepolia 上，約 60 張權狀，整晚持續有轉手紀錄。其中幾張在你的錢包裡
2. `nafuda.sololin.xyz`：v3 收藏家 app，C 大部分完成
3. `nafuda-grader.sololin.xyz`：v3 評級商後台，**要等你在 Cloudflare 加好第二個 hostname 才上線**；沒加的話，本機的 `localhost:8089` 也能先看
4. 後端和 indexer 在 mini 上運作；`/api/status` 可以看到 indexer 追到哪個區塊
5. 一份 review 導覽（`docs/review-guide.md`）：每個畫面的網址、要看什麼、截圖、還沒完成的項目

## 4. 驗收標準（每一項完成時就驗）

- 所有測試都通過（純邏輯的 node 測試、API 測試、e2e），CI 全綠
- 每張權狀的持有人和晶片，後端的資料和 ENS 解析的結果一致（有一支腳本會全部比對一遍）
- 兩個前端分別連不同的錢包，互不影響
- 映像檔裡沒有私鑰；RPC key 只在伺服器端
- 市場模擬器在預算內，會自動停；每筆交易都記錄下來

## 5. 風險

| 風險 | 對策 |
|---|---|
| 整晚由 AI 寫程式，ETHGlobal 可能因為「太依賴 AI」而影響贊助獎評分 | 如實寫進 `ai-usage.md`：方向和取捨由作者決定，程式由 AI 寫，作者早上 review。這是事實，不要淡化 |
| 後端不會增加 ENS 分數 | ENS 的分數來自多評級商（階層式命名空間，每家各自的 registry）、收藏家的 ENS 名稱（A6）、解析路徑視覺化（C3）。後端只負責讓產品看起來成熟 |
| 發出去的權狀收不回來（emancipated） | 種子資料一律用原創卡名，發出前先檢查一遍；一旦發出就是永久的公開資料 |
| 市場模擬器需要收藏家的私鑰，而且放在 mini 上 | 都是測試網的 demo 金鑰；只放在 mini 的 `.env`（gitignored，不進映像檔）；有預算上限 |
| 改用 React 重寫可能帶進回歸錯誤 | 純邏輯和測試原樣保留；e2e 測試收進 repo，每個畫面都跑過 |
| 最後的鎖定 | 鎖定之後仍然可以新增評級商（nafudaRegistry 的 REGISTRAR 不在 emancipation 的範圍內），所以不影響 A1。鎖定一樣要等作者決定 |

## 6. 需要你在睡前做的事

1. 轉 1 SepoliaETH 到 operator `0xa5183ea7E97bf57935c4F8ddbaa6E21cCD6DAa82`
2. 在 Cloudflare 的同一條 tunnel 加上 `nafuda-grader.sololin.xyz` → `http://localhost:8089`（早上再加也可以）
3. 回覆 D1–D4（或者一句「照建議」）

## 7. 進度（2026-09-26 凌晨）

全部項目都有 commit，細節見 [../review-guide.md](../review-guide.md)。

| 區塊 | 狀態 | 備註 |
|---|---|---|
| A1 多評級商 | 完成 | Sepolia 上已部署 `cgc-sim`（v1）和 `bgs-sim`（v2）；fork 上驗證過鎖定後仍能新增評級商 |
| A2–A4 種子資料 | 完成 | 36 張權狀立刻發行，其餘由市場模擬器分散在夜間發行 |
| A5 市場模擬器 | 運作中 | 在 mini 上跑到 08:00；轉手都附宣告價格 |
| A6 收藏家 ENS 名稱 | 完成 | `<name>.nafuda.eth` 加上 15 個 primary name；作者錢包的名稱已經註冊，只差作者自己發一筆 setName |
| X1 TitleControllerV2 | 完成 | 7 個測試；6 個 mutation 全部被抓到 |
| B1–B2 indexer、API | 完成 | |
| B3 交易意向 | 完成 | EIP-712；只有持有人能開價；新發的權狀直接查鏈 |
| B4 評級商收件 | 完成 | 評級商簽名推進狀態；「已發權狀」這一步會對照交易收據 |
| B5 Docker | 完成 | 接真實 Postgres 的 API 整合測試：5 項，CI 以 Postgres service 執行 |
| C1–C11 收藏家 app | 完成 | C10 語言切換只翻譯主要文字 |
| D1–D7 評級商後台 | 完成 | D3 看板改用「每個動作簽名」，沒有另做 SIWE session；D4 的批次發行做在收件看板上：一次發行所有已封裝的送評單，在 Sepolia 上用 e2e 驗證過 |
| E1 e2e | 完成 | public 26 項全過；live 在 Sepolia 上走完整條流程 |
| E2 打磨 | 大致完成 | 手機版已檢查 390px；評級商後台以桌面為主 |
| E3 文件 | 完成 | |
| E4 部署 | 完成 | 兩個網域都已上線 |
| §4 index 對 ENS 的全面比對腳本 | 完成 | `e2e/consistency.test.ts`：45/45 一致 |
