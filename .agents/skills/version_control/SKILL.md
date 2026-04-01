---
name: version_control
description: 協助管理 Animation Tracker 專案的 Git 版本控制，落實 Pro/Dev/Feature 多分支策略與 Semantic Commits 規範。
---

# Version Control Skill

此 Skill 專為維護 Animation Tracker 專案的 Git 版本控制原則與流程而設計。

## 1. 核心分支策略 (Branching Strategy)

本專案將採用嚴謹的三級分支管理模型：

*   **`Pro` (主要/正式環境)**
    *   **定義**: 穩定、隨時可發佈到正式環境的版本。
    *   **規則**: 嚴禁在 `Pro` 分支直接開發。只有當在 `Dev` 測試通過並準備上線時，才能由 `Dev` 合併至 `Pro`。
*   **`Dev` (開發/測試輔助)**
    *   **定義**: 日常開發與整合測試的主要分支。
    *   **規則**: 小型的修復與調整可以直接在此分支上操作。所有新開發的功能也必須優先整併並測試於此分支。
*   **`Feature` (功能開發)**
    *   **定義**: 用於處理重大更新或全新大功能的獨立分支。
    *   **命名慣例**: 建議為 `feature/your-feature-name`。
    *   **規則**: 若判定需求為大型功能，需從最新的 `Dev` 建立 Feature 分支，開發完成後再併回 `Dev`。

## 2. Semantic Commits 規範

請堅守專案《全域規範》的 Commit 訊息規則，務必帶有以下前綴 (皆為小寫並帶冒號空白)：

*   `feat:` 新增功能、畫面
*   `fix:` 修復問題或非預期的 UI 跑版
*   `style:` 單純代碼縮排、不改動邏輯的外觀
*   `refactor:` 重構程式碼但未影響功能
*   `docs:` 說明文件或規範文件的增刪
*   `chore:` 升級依賴、環境變數或其他建置工具配置
*   > *範例*: `feat: 建立深色模式與基礎卡片組件`

## 3. 技能執行工作流程 (Standard Workflow)

當 AI 代理人或開發者受命「幫我提交程式或是管理版本」時，必須依照此流程：
1. **確認狀態**: 執行 `git status` 與 `git branch` 了解當前的工作目錄狀態及所在分支。
2. **判斷分支**:
    - 如果是小修改，確保自己處於 `Dev` 分支。
    - 如果是大型新功能，若尚未建立，應從 `Dev` 切出分支 `git checkout -b feature/xxx`。
3. **分裝提交**: 貫徹專案「單一職責」，適度地將變更群組化後執行 `git add <files>`，並寫出具有洞察力與解釋性的 Semantic Commit。
4. **推播儲存庫**: 依照當前開發進度推送到對應的遠端分支。
