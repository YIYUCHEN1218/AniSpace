---
name: version_control
description: 協助管理任何專案的 Git 版本控制，落實多分支策略（Pro/Dev/Feature/Hotfix）與完整 Conventional Commits 規範。適用於所有類型的專案。
---

# Version Control Skill

此 Skill 提供通用的 Git 版本控制原則與操作流程，適用於任何規模與類型的專案。

---

## 0. 環境偵測（Windows 注意事項）

在 Windows PowerShell 環境中，`git` 指令可能不在 PATH 內。  
執行前請先確認，若 `git` 無法使用，改以完整路徑呼叫：

```powershell
# 確認 git 是否可用
git --version

# 若找不到，使用完整路徑（Windows 常見安裝位置）
& "C:\Program Files\Git\bin\git.exe" <command>
```

---

## 1. 核心分支策略 (Branching Strategy)

採用彈性的四級分支模型，可依專案規模縮減使用：

### `main` / `Pro` — 正式環境
- **定義**: 永遠保持穩定、可直接部署到正式環境的狀態。
- **規則**: **嚴禁直接 push**。只接受來自 `develop`/`Dev` 的合併，或緊急 `hotfix` 合併。
- **別名**: 大型專案用 `main`；本專案慣例用 `Pro`。

### `develop` / `Dev` — 開發整合
- **定義**: 所有功能整合與日常開發的基準線。
- **規則**: 小型修復可直接在此操作；Feature 分支開發完後合併回此。
- **別名**: 通用慣例用 `develop`；本專案慣例用 `Dev`。

### `feature/<name>` — 功能開發
- **定義**: 每個重大功能或大型更新的獨立工作空間。
- **命名範例**: `feature/user-auth`、`feature/dashboard-v2`、`feature/api-refactor`
- **規則**: 從最新的 `Dev`/`develop` checkout，完成後 PR/MR 回 `Dev`/`develop`。

### `hotfix/<name>` — 緊急修復
- **定義**: 針對正式環境的緊急 Bug 修復，不走正常開發流程。
- **命名範例**: `hotfix/login-crash`、`hotfix/payment-null-error`
- **規則**: 從 `main`/`Pro` checkout，修復後同時合併回 `main`/`Pro` 與 `Dev`/`develop`。

---

## 2. Conventional Commits 規範

所有 commit 訊息都必須遵守以下格式（Conventional Commits v1.0.0）：

```
<type>(<scope>): <description>
```

- `<type>`: 必填，見下表
- `(<scope>)`: 選填，標示影響範疇（如元件名、模組名）
- `<description>`: 必填，用**繁體中文**或英文撰寫，清楚說明「做了什麼」

### Type 對照表

| Type | 用途 | 範例 |
|------|------|------|
| `feat` | 新增功能或畫面 | `feat(auth): 新增 Google OAuth 登入流程` |
| `fix` | 修復 Bug 或非預期行為 | `fix(card): 修正封面圖片在 Safari 的顯示異常` |
| `style` | 純格式調整，不影響邏輯 | `style: 統一縮排為 2 space` |
| `refactor` | 重構，不新增功能也不修 Bug | `refactor(scraper): 拆分抓取邏輯為獨立函式` |
| `perf` | 效能優化 | `perf(list): 以 useMemo 優化動畫清單渲染` |
| `test` | 新增或修改測試 | `test(api): 新增 Jikan API 錯誤處理測試案例` |
| `docs` | 文件或規範增刪 | `docs: 更新 README 安裝步驟` |
| `chore` | 建置工具、依賴升級、環境設定 | `chore: 升級 Vite 至 6.0` |
| `ci` | CI/CD 設定異動 | `ci: 新增 GitHub Actions 自動部署流程` |
| `revert` | 還原前次 commit | `revert: 還原 feat(auth) 因登入異常` |

> **Breaking Change**: 在 description 後加上 `BREAKING CHANGE:` 說明，或在 type 後加 `!`。  
> 範例：`feat(api)!: 移除舊版 v1 端點，改用 v2`

---

## 3. 標準操作流程 (Standard Workflow)

當被要求「提交程式」或「管理版本」時，依序執行以下步驟：

### Step 1 — 確認環境狀態
```bash
git status          # 查看未追蹤/已修改的檔案
git branch -a       # 確認當前分支與所有遠端分支
git log --oneline -10  # 回顧最近 10 筆 commit
```

### Step 2 — 判斷分支策略

```
需求類型判斷：
├── 小修復 / 設定調整 → 在 Dev/develop 直接操作
├── 大型新功能        → 從 Dev 建立 feature/<name>
└── 線上緊急 Bug      → 從 main/Pro 建立 hotfix/<name>
```

建立新分支（若需要）：
```bash
git checkout Dev
git pull origin Dev
git checkout -b feature/<name>
```

### Step 3 — 分裝提交（單一職責原則）

**不要一次 `git add .` 全部打包**。按照變更的職責分群提交：

```bash
# 例：分三次提交，職責明確
git add src/components/AnimeCard.tsx src/components/AnimeCard.css
git commit -m "feat(card): 新增評分星號與 hover 動畫效果"

git add src/services/api.ts
git commit -m "refactor(api): 統一錯誤處理為 Result 型別"

git add docs/CHANGELOG.md
git commit -m "docs: 更新 CHANGELOG 說明新版卡片設計"
```

### Step 4 — 推播至遠端

```bash
# 推送目前分支
git push origin <branch-name>

# 首次推送新建分支
git push -u origin feature/<name>
```

---

## 4. 常用輔助指令速查

```bash
# 查看變更內容
git diff                        # 未 staged 的差異
git diff --staged               # 已 staged 的差異
git diff HEAD~1                 # 與上一個 commit 的差異

# 暫存工作中的變更（切換分支前）
git stash push -m "說明"
git stash pop                   # 恢復暫存

# 修改最後一次 commit（尚未 push 的情況下）
git commit --amend -m "修正後的 commit 訊息"

# 整理 commit 歷史（互動式 rebase）
git rebase -i HEAD~3            # 整理最近 3 筆

# 查看特定檔案的 commit 歷史
git log --follow -p src/App.tsx

# 還原單一檔案至最後一次 commit 的狀態
git restore src/components/AnimeCard.tsx
```

---

## 5. 品質檢查清單

提交前確認以下項目：

- [ ] Commit 訊息符合 Conventional Commits 格式
- [ ] 每個 commit 只包含一類型的變更（單一職責）
- [ ] `.env`、密鑰、個人設定檔未被納入（確認 `.gitignore`）
- [ ] 沒有遺留 `console.log` / 除錯用程式碼
- [ ] 分支名稱明確反映功能內容

---

## 6. 分支生命週期圖

```
main/Pro ──────────────────────────────── (永遠穩定)
    │                              ↑
    │                         merge (PR)
    │                              │
Dev/develop ──────┬─────────────── ┤ ─────
                  │                │
              checkout        merge back
                  │                │
feature/xxx ──────┴────────────────┘
```
