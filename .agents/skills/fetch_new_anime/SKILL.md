---
name: fetch_new_anime
description: 使用 AniList 抓取指定動畫，自動查詢中文翻譯，並檢查移除重複資料。
---

# Fetch New Anime (獲取新動畫資料)

此 Skill 提供了一套自動化的流程，利用外部 API (AniList) 抓取動畫，整合本專案優先使用的 Bangumi 進行中文翻譯查詢，並過濾掉重複資料。

## 執行步驟

當使用者要求抓取新動畫時，身為 AI 必須依照以下步驟執行：

### 1. 確認抓取條件
向使用者確認需要抓取的「年份 (例如：2024)」與「季度 (例如：SPRING, SUMMER, FALL, WINTER)」。

### 2. 執行腳本
利用內建的 Node.js 腳本進行自動化抓取與去重。此腳本將會：
- 透過 **ACG Secrets.HK** 獲取官方標題 (優先第一順位)。
- 透過 **AniList GraphQL** 獲取動畫清單基礎資料與 `extraLarge` 超高清封面。
- 透過 **Bangumi API** 查找繁體中文/中文譯名 (第二順位)，若查無則依序採用維基百科、繁體強制轉換 (`opencc-js`)。
- **維基百科最終校驗 (Phase 5)**：將所有處理後的標題發送至 Wikipedia 進行 `zh-tw` 官方譯名強制校正。
- **Jikan API 嚴格分級**：引入 MyAnimeList 的年齡分級機制，遇到 `R+` 或 `Rx` 才會標記並篩選出真正的 `紳士` 作品。
- 針對獲取回來的資料進行 ID 去重與檢查。

**命令：**
```bash
node .agents/skills/fetch_new_anime/scripts/fetch_anime.mjs <YEAR> <SEASON>
```
*(請將 `.agents/skills/fetch_new_anime/scripts/...` 視為相對路徑，建議從專案根目錄下執行)*

### 3. 提供結果給使用者
該腳本會在專案環境產生一個 `new_anime_results.json` 檔案。
請利用 `view_file` 工具讀取該檔案的內容，然後根據專案內要求的格式，協助使用者將新的動畫資料導入前端儲存 (例如填入預設的 JSON 初始清單、寫入 CSV 提供匯入等)。

### 4. 輔助檢查系統重複動畫
除了單次抓取的內容去重之外，若使用者的前端應用程式中有提供匯出 `CSV` 或 JSON，請協助使用者比對 `new_anime_results.json` 與他們現有的資料庫，確保沒有把已經在列表中的動畫加進庫內。
