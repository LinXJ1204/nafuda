# Web v2 計劃：C 端／B 端分頁、自架

> 2026-09-25 22:03 JST，作者決定擴充前端之後、動手之前寫的。搭配 [slab-title-implementation.md](slab-title-implementation.md)，這份取代其中的 P5-8（部署），並新增 P5b。
> **合約、Sepolia 上的部署、腳本全部不動。** 這份計劃只改 `web/`，另外新增 Docker 設定。

---

## 0. 作者的決定（22:00 前後）

| 項目 | 決定 |
|---|---|
| 放在哪裡 | 作者的 Mac mini，Docker 加 Cloudflare Tunnel。作者表示機器一直在線，出事就臨時開 EC2。另外，已經設好的 Cloudflare Workers 靜態部署（`web/wrangler.jsonc`）可以當免費的熱備援 |
| 資料來源 | **不架 indexer**，前端直接用 `getLogs` 讀鏈上事件（已完成：`web/src/lib/events.ts`，4 個測試） |
| 畫面 | B：評級商後台，可以發權狀；B：已發出的權狀清單；C：持有人的「我的權狀」；C：權狀的轉手歷史 |
| C 端風格 | 「像 OpenSea」，這裡指**瀏覽型體驗**：卡片牆、單張權狀頁（屬性、持有人、交易紀錄），再加上驗證。**不做線下交易以外的線上買賣**：權狀應該跟著實體卡走，線上單獨買賣權狀就是產品計劃 §1.5 說的「卡和權狀分開賣」。如果要做，唯一合理的形式是「託管加上到貨驗證」，列在 Could 之外，另外討論 |

## 1. 範圍：scope 確實大，所以分三層

每一項標上大小（S／M／L，相對於目前已完成的單頁驗證器），並照 demo 的價值排序。**同一層做完、驗收通過，才往下一層做**；時間不夠就停在已完成的那一層，現有的單頁驗證器一直保持可用。

### 第一層 Must：讓影片的故事完整（評級商發權狀 → 買家驗證 → 過戶）

| # | 項目 | 大小 | 說明 |
|---|---|---|---|
| W1 | 分頁架構 | M | Vite multi-page：`/` 是 C 端，`/grader/` 是 B 端。共用的程式碼放在 `src/lib/`，C 端內部用 hash 路由（`#/title/12345678`），靜態主機不需要設定 rewrite |
| W2 | C：單張權狀頁 | M | 左邊是 slab 圖，右邊是名稱、持有人、屬性、ENS 名稱；下面是**轉手歷史**（issue 加上每筆 transfer，附時間和 tx 連結）；**驗證區**是把現有的驗證器搬進來；如果目前連線的錢包是持有人，就顯示**過戶**按鈕 |
| W3 | B：發權狀 | M | 用評級商錢包發權狀。晶片從預先產生的**模擬晶片池**取用（見 §2.3），發完之後直接連到 C 端的權狀頁 |
| W4 | 自架 | S | Dockerfile（node 建置、nginx 提供服務）、docker-compose（nginx 加 cloudflared）、`docs/hosting.md`。Tunnel 的 token 和 DNS 由作者設定 |

### 第二層 Should：OpenSea 的感覺，以及給評審看的透明度

| # | 項目 | 大小 | 說明 |
|---|---|---|---|
| W5 | C：卡片牆（Explore） | M | 所有已發出的權狀（來自 getLogs），每張卡顯示 slab 圖、名稱、分數、持有人，點進去就是 W2 |
| W6 | B：已發出的權狀清單 | S | 表格：證書號、卡名、分數、目前持有人、發行時間、轉手次數 |
| W7 | B：信任面板 | S | 直接從鏈上讀取並顯示 `isEmancipated()`、controller 持有 REGISTRAR、評級商剩下的角色，讓評審一眼就看到「評級商收不回權狀」 |

### 第三層 Could

| # | 項目 | 大小 | 說明 |
|---|---|---|---|
| W8 | C：我的權狀 | S | 連錢包之後列出自己持有的權狀 |

**不做**：線上買賣或託管、indexer 和資料庫、帳號系統。

## 2. 設計重點

### 2.1 資料從哪裡來

| 用途 | 來源 | 理由 |
|---|---|---|
| 單張權狀的持有人、晶片、屬性（權威資料） | ENS 解析（viem 加 UR），跟現在一樣 | 這正是「任何 ENS client 都查得到」的示範 |
| 清單、歷史、「我的權狀」 | `getLogs` 建出來的索引 | 不用資料庫，資料永遠跟鏈上一致 |
| 評級商的信任面板 | 直接讀 registry（`isEmancipated`、`roles`） | 鏈上事實，前端不做任何判斷 |

卡片牆**不會**對每一張卡做 UR 解析（公開 RPC 會被限流），只用索引裡的資料。點進權狀頁時，才用 UR 讀權威資料，並在畫面上標示「resolved via ENS」。

### 2.2 slab 圖

用程式產生 SVG：上方是 PSA-Sim 樣式的標籤（證書號、分數），下方是依證書號 hash 決定配色的卡面和卡名。**不使用任何真實卡圖**（T15）。文字一律透過 DOM 的 `textContent` 寫入，不拼接字串。

### 2.3 模擬晶片池

B 端發新權狀需要新的晶片。做法是**事先在 `demo/slabs.json` 產生一批**模擬晶片（例如 `12345680`–`12345689`，一樣是公開的測試金鑰），B 端發行時從池子裡取。好處是任何瀏覽器都能在 C 端「碰」這個 slab；如果把晶片存在 localStorage，就只有發行的那台瀏覽器能用。

### 2.4 錢包

- B 端：作者把 grader 的私鑰匯入 MetaMask（僅限測試網）。發行前先比對連線帳號是不是 `TitleController.GRADER()`，不是就擋下並顯示原因，不送出注定會 revert 的交易。
- C 端：過戶和「我的權狀」沿用現有的 `wallet.ts`。

### 2.5 自架（W4）

- `Dockerfile`（build context 是 repo 根目錄，因為前端會讀 `deployments/` 和 `demo/`）：`node:22-alpine` 建置 → `nginx:alpine` 只放 `web/dist`。
- `.dockerignore` 要排除 `contracts/`（submodule 有 215 MB）、`.env`、`node_modules`、`deployments/.secret-*`。映像檔裡只有靜態檔案。
- `docker-compose.yml`：`web`（nginx）加上 `cloudflared`（`tunnel run --token ${TUNNEL_TOKEN}`），都設 `restart: unless-stopped`。
- 作者要做的：在 Cloudflare Zero Trust 建立 Tunnel、拿 token、設定 public hostname（`nafuda.<domain>` → `http://web:80`）。

## 3. 驗收標準

| # | 標準 | 怎麼驗 |
|---|---|---|
| A1 | 所有測試通過；build 同時產出 `index.html` 和 `grader/index.html` | `npm test`；`npm run build`；`ls dist/grader/index.html` |
| A2 | 權狀頁：`#/title/12345678` 的持有人跟 ENS 解析結果一致；歷史包含發行和每一筆轉手 | 手動比對 `npm run verify` 的 V5，以及 Etherscan |
| A3 | 原本驗證器的情境 S1–S6，在權狀頁上都能重現 | 手動走一遍 |
| A4 | B 端：用 grader 錢包發一張新權狀（例如 `12345680`）→ 交易成功 → 在 C 端卡片牆和 B 端清單都看得到 → 在**另一個瀏覽器**的權狀頁碰它的模擬晶片，結果是 ✓ | 手動走一遍 |
| A5 | B 端：用非 grader 的錢包 → 送出前就被擋下並顯示原因；發一張已經存在的證書號 → 顯示「已經發過」 | 手動走一遍 |
| A6 | Docker：`docker compose up -d` 之後，`localhost:8080/` 和 `/grader/` 都能用；映像檔裡找不到 `.env` 的任何值 | `curl`；`docker run --rm <image> grep -r …` |
| A7 | 透過 Tunnel 在公開網址打開 C 端和 B 端，而且用無痕視窗 | 作者設好 Tunnel 之後驗 |

## 4. 風險

| 風險 | 對策 |
|---|---|
| 改版把現在能用的驗證器弄壞 | 新頁面在同一個 build 裡平行開發，每一層通過驗收才切換首頁；每一層都 commit |
| 公開 RPC 對 `getLogs` 或 UR 限流 | 卡片牆只讀索引；可以用 `VITE_SEPOLIA_RPC_URL` 換成作者自己的 RPC，但要注意 key 會出現在前端 bundle 裡，只能放有網域限制的 key |
| 家裡的機器或網路出問題 | Cloudflare Workers 的靜態部署當熱備援（同一份 build 輸出） |
| 範圍一直長大 | 照 §1 分層，第一層沒過驗收，就不碰第二層 |
| 這些都不會增加 ENS 評分 | 誠實面對：這是 UX 和影片說服力的投資。ENS 的核心（wildcard、emancipation、safe transfer）已經完成，也驗證過了 |

## 5. 建議的順序

W1 → W2 → W3 → W4（第一層驗收：A1–A6）→ W5 → W6、W7 → W8。A7 等作者設定 Tunnel 時一起驗。

## 6. 進度（2026-09-25 22:35 JST）

三層都做完，每一項各自一個 commit。

| # | 狀態 | 備註 |
|---|---|---|
| W1 分頁架構 | 完成 | `/`、`/grader/`，hash 路由有測試 |
| W2 權狀頁 | 完成 | 舊的單頁驗證器已經移除，因為權狀頁能重現 S1–S6 |
| W3 B 端發權狀 | 完成 | 晶片池放在 `demo/slabs.json` 的 `pool`，由 `scripts/src/chips.ts` 產生；送出前的檢查是純函式，有測試 |
| W4 自架 | 完成 | 已經部署到 Mac mini 的 `127.0.0.1:8088`（8080 被別的服務占用）。Mac mini 本來就有 cloudflared 在跑，所以不另開 tunnel 容器 |
| W5 卡片牆 | 完成 | |
| W6 B 端清單 | 完成 | |
| W7 信任面板 | 完成 | 在 Sepolia 上看到的是鎖定前的狀態（標題相關 5 項 ✓、鎖定 3 項待辦）；在 fork 上執行鎖定之後，8 項全部 ✓ |
| W8 我的權狀 | 完成 | 也可以用 `#/holder/<address>` 看任何地址，含「以前持有過」 |

| # | 驗收結果 |
|---|---|
| A1 | 通過：31 個 node 測試；build 產出 `index.html` 和 `grader/index.html` |
| A2 | 通過：權狀頁上的持有人和 ENS 解析結果一致（alice），歷史包含發行紀錄 |
| A3 | 通過：用 headless Chrome 自動操作。S1–S5 在 Sepolia 上跑；S6（過戶）在 anvil fork 上用模擬錢包跑 |
| A4 | 在 fork 上通過（發 `12345680`、`12345681` → 清單和卡片牆都看得到 → 另一個沒有錢包的瀏覽器碰晶片，結果 ✓）。**Sepolia 上的 A4 留給作者**，可以直接在影片裡示範 |
| A5 | 通過：非 grader 錢包、已經發過的證書號，都在送出前就被擋下並顯示原因 |
| A6 | 通過：`/`、`/grader/` 回 200，`/grader` 用相對網址轉址；CSP 生效時 S1–S5 仍然通過；映像檔裡找不到 `.env` 的 11 個值 |
| A7 | 通過（22:45）：作者為既有的 tunnel 加上 `nafuda.sololin.xyz` → `http://localhost:8088`。用全新的 headless Chrome profile（等同無痕視窗）打開公開網址：S1–S5 通過，Explore、B 端清單、信任面板、發行頁都能載入；`/.env` 回 404；Cloudflare 沒有注入任何 script，所以 CSP 不受影響 |
