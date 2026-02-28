# 人生OS 週次レビューアプリ

週次レビュー入力テンプレを、そのまま使えるローカルWebアプリにしたものです。  
ブラウザだけで動作し、入力データは `localStorage` に保存されます。

## 機能

- 週次レビューの入力・保存・編集・削除
- 今月ダッシュボード表示
- 月末サマリーの自動集計
- ChatGPT分析依頼文の自動生成とコピー
- JSONエクスポート
- PWA対応（ホーム画面追加・オフライン起動）

## 使い方

1. `index.html` をブラウザで開く
2. `週次レビュー入力` を埋めて `保存する`
3. `保存済みレビュー` から編集/削除
4. `週次分析プロンプトをコピー` で分析依頼を生成

## iPhoneホーム画面に追加（PWA）

`file://` 直開きではPWA機能が有効にならないため、Webサーバー経由で開いてください。  
また、Service Worker（オフライン起動）は `https://` 配信が必要です。

1. このフォルダを GitHub Pages / Netlify / Vercel などで `https://` 公開
2. iPhoneのSafariで公開URLを開く
3. 共有ボタンから `ホーム画面に追加`
4. 追加後は単体アプリとして起動（オフライン利用可）

### GitHub Pagesでの最短公開

このアプリフォルダ単体をGitHubリポジトリ化して公開できます。  
`/.github/workflows/deploy-pages.yml` は設定済みです。

1. GitHubで空リポジトリを作成（例: `life-os-app`）
2. このフォルダで初回push

```bash
cd "/Users/jihen/Library/Mobile Documents/com~apple~CloudDocs/ChatGPT/life-os-app"
git init
git add .
git commit -m "Initial commit: life-os pwa"
git branch -M main
git remote add origin <YOUR_REPO_URL>
git push -u origin main
```

3. GitHubの `Settings > Pages` で `Build and deployment` を `GitHub Actions` に設定
4. `Actions` タブで `Deploy Life OS to GitHub Pages` が成功したら公開URLが出ます
5. iPhone SafariでそのURLを開き、`ホーム画面に追加`

ローカル確認のみ行う場合:

1. `python3 -m http.server 8000`
2. Macのブラウザで `http://localhost:8000` を開く（PWA登録確認用）

## ファイル構成

- `index.html`: 画面
- `styles.css`: スタイル
- `app.js`: 入力保存、集計、コピー処理
- `manifest.json`: PWA設定
- `sw.js`: オフラインキャッシュ
- `icons/`: アプリアイコン群

## 注意

- データは同一ブラウザ内の保存です。別端末には同期されません。
- ブラウザのストレージ削除でデータは消えます。必要なら定期的にJSONエクスポートしてください。
