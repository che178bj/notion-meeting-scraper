# Notion Meeting Scraper

Notion 會議記錄爬蟲，自動爬取會議資訊並輸出為 Markdown 格式。

## ✨ 功能特色

- 📥 爬取多個 Notion 分類的會議記錄
- 📅 自動過濾只保留當天日期的會議
- 📝 輸出為結構化 Markdown 格式（含 YAML front matter）
- 🔄 自動發現子分類
- ⚙️ 設定檔管理，易於維護

## 📦 安裝

```bash
# 安裝依賴
pip install -r requirements.txt

# 安裝 Playwright 瀏覽器
playwright install chromium
```

## 🚀 使用方式

### 基本使用

```bash
python -m src.cli
```

### 指定日期

```bash
python -m src.cli --date 2026-02-12
```

### 指定輸出資料夾

```bash
python -m src.cli --output ./my-output
```

### 只爬取特定分類

```bash
python -m src.cli --category "數據週會議"
```

## ⚙️ 設定

編輯 `config.yaml` 來設定：

- Notion 頁面 URL
- 爬蟲參數
- 輸出格式

## 📁 輸出範例

```markdown
---
category: 數據週會議
subcategory: 
date: 2026-02-12
crawled_at: 2026-02-12T08:00:00
---

## 📋 會議資訊

| 項目 | 內容 |
|------|------|
| 分類 | 數據週會議 |
| 日期 | 2026年2月12日 |

---

## 📝 摘要

雲端成本異常：1月A9帳單增加約10-16萬元...

---

## 📓 筆記

- GPT-5費用異常
- TEN自動化專案暫停

---
```

## 📋 輸出檔名

```
meetings-{分類}-{YYYYMMDD}.md
meetings-{分類}-{子分類}-{YYYYMMDD}.md
```

---

Made with ❤️ by JC's AI Assistant (小爪子)
