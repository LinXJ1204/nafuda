# 規劃中的升級

> 2026-09-26 15:00 JST 寫成。作者在秋葉原逛過卡牌店之後提出這兩項，決定**先寫進計劃，暫時不做**。這份文件記下設計和決策點，等作者決定要不要做、什麼時候做。

---

## U1. 權狀依卡片分類（Pokémon、遊戲王、球員卡……）

**作者的想法**：resolver 應該能依卡片分類，欄位可以寬鬆一點。

### 欄位

依照 PSA 官方 cert 頁的欄位設計，這是業界通用的格式：

| 欄位 | 說明 | 例子 |
|---|---|---|
| `card.category` | 大類 | `tcg`、`sports`、`non-sport` |
| `card.game` | TCG 的遊戲 | `pokemon`、`yugioh`、`one-piece`、`mtg`、`duel-masters` |
| `card.sport` | 球員卡的運動 | `baseball`、`basketball`、`soccer`、`football` |
| `card.year` | 年份 | `2021` |
| `card.brand` | 品牌或系列（PSA 的 Brand/Title） | `POKEMON JPN SWSH`、`TOPPS CHROME`、`BBM` |
| `card.number` | 卡號 | `189` |
| `card.subject` | 角色或球員（PSA 的 Subject） | `VAPOREON`、`SHOHEI OHTANI` |
| `card.variety` | 版本（PSA 的 Variety/Pedigree） | `FA`、`REFRACTOR`、`1ST EDITION` |
| `card.language` | 語言 | `JPN`、`ENG` |
| 球員卡另外可加 | | `card.team`、`card.rookie`、`card.auto`、`card.serial`（`12/99`） |
| 其他 `card.*` | 寬鬆：任何以 `card.` 開頭的鍵都可以用 | |

### 合約

- **現況裝不下這些欄位。** PSA-Sim 和 CGC-Sim 是 v1，沒有自訂欄位；BGS-Sim 的 V2 最多 8 個欄位，子分數已經占掉 4 個。
- **建議寫 TitleControllerV3**：
  - 欄位上限提高到 16 個。
  - 加入「舊版 fallback」：新 controller 查不到的證書號，轉去問舊 controller，所以已發出的權狀照常解析，一張都不會動到。
  - 三家評級商都換成 V3。評級商用 `REGISTRAR_ADMIN` 把發行權交給 V3、撤掉舊 controller 的 `REGISTRAR`，再換掉自己名稱的 resolver（評級商在 lock 之前持有 `SET_RESOLVER`）。
- **ENS 上的賣點**：評級商升級發行合約時，舊權狀完全不受影響，而且整個過程都由 EAC 角色控管。
- **限制**：換 resolver **必須在 final lock 之前**做，而且會改到線上狀態，要先在 fork 上完整演練。U1 和 lock 的先後順序要一起決定。

### 示範資料

分類使用真實的遊戲名稱（`pokemon`、`yugioh`……），卡本身仍然是虛構的，並標示 demo card。作者買的シャワーズ（PSA 152468975）**不上鏈**：用 PSA-Sim 替 PSA 真實的證書號發權狀，看起來就像我們在替 PSA 發紀錄。

### 工作量估計

約 4.5 小時：合約和測試 1.5 小時、fork 演練和 Sepolia 1 小時、indexer／API／UI 的分類與篩選 1.5 小時、分類示範資料 0.5 小時。

---

## U2. 卡牌店入口（第三種 client）

**作者的想法**：逛了很多卡牌店，應該有一個專門給卡牌店用的地方，店家也算是一種 client。

### 設計

- **第三個獨立前端**：`nafuda-shop.sololin.xyz`（`127.0.0.1:8090`）。理由跟 B/C 分開一樣：店家用店的錢包，連線要跟個人錢包分開。
- **櫃台模式**：給平板用的大按鈕流程。輸入證書號 → 碰卡驗證 → 確認賣家是持有人 → 收購時請客人把權狀過戶給店家（畫面顯示店家的 ENS 名稱和 QR）。
- **庫存**：店家錢包持有的權狀，可以批次上架（簽名開價）。
- **公開店面頁**：收藏家 app 裡加一個「店家」目錄，每家店有 `<店名>.nafuda.eth`。
- **示範店家一律用虛構店名**，不用真實店名，避免冒用。

### 作者要做的

在 Cloudflare 加上 `nafuda-shop.sololin.xyz` → `http://localhost:8090`。

### 工作量估計

約 4 到 5 小時。如果時間不夠，縮成收藏家 app 裡的「店家模式」，約 2 小時。

---

## 決策點（等作者決定）

1. U1 要不要做；做的話，三家都換 V3，還是只有新評級商有分類
2. U2 做成第三個網域，還是收藏家 app 裡的一個模式
3. 功能凍結時間：建議不晚於 9/26 21:00，留時間錄影和提交
