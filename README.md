# LoveFamily

一个温暖的家庭生活网站，适合部署到 GitHub Pages。

## 功能

- `word-match.html`：英文与中文点击匹配。累计答对三次后，单词在后续抽题中的出现频率会降低；学习进度保存在浏览器中。
- `points.html`：按月展示爸爸、妈妈、多多的积分和记录，可选择项目加分或减分；积分记录保存在浏览器中，不会公开上传。

## 使用 Lark Sheet 更新词库

词库默认读取 `data/words.json`。GitHub Actions 已配置为每 6 小时同步一次，也可在仓库的 **Actions > Sync Lark word list > Run workflow** 手动同步。

1. 建立 Lark Sheet，首行包含 `英文`（或 `English`）及 `中文`（或 `Chinese`）两列。
2. 在 GitHub 仓库 **Settings > Secrets and variables > Actions** 新增：`LARK_APP_ID`、`LARK_APP_SECRET`、`LARK_SPREADSHEET_TOKEN`、`LARK_SHEET_ID`。如果使用飞书而非 Lark 国际版，额外创建 `LARK_OPEN_BASE_URL`，值为 `https://open.feishu.cn`。
3. 如需指定范围，额外添加 `LARK_WORD_RANGE`，例如 `0bxxxx!A:B`。不填时默认读取 `Sheet ID!A:B`。

> 不要将 Lark App Secret 写入网页代码或仓库文件。它只应保存在 GitHub Actions Secrets 中。

## 本地预览

直接在浏览器中打开 `index.html` 即可。

## 发布

仓库推送到 GitHub 后，在仓库的 **Settings > Pages** 选择从 `main` 分支部署，目录选择 `/ (root)`。
