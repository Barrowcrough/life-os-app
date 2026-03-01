# 人生OS 日次レビューアプリ

日次レビュー入力テンプレを、そのまま使えるローカルWebアプリにしたものです。  
ブラウザだけで動作し、入力データは `localStorage` に保存されます。

## 機能

- 日次レビューの入力・保存・編集・削除
- 今週ダッシュボード表示
- 月末サマリーの自動集計
- ChatGPT分析依頼文の自動生成とコピー
- JSONエクスポート
- GitHub Gistクラウド同期（全端末共通）
- PWA対応（ホーム画面追加・オフライン起動）

## 使い方

1. `index.html` をブラウザで開く
2. `日次レビュー入力` を埋めて `保存する`
3. `保存済み日次レビュー` から編集/削除
4. `日次分析プロンプトをコピー` で分析依頼を生成

## 全端末で共通利用する（クラウド同期）

推奨は `短命トークン（中継API）` モードです。  
PATは中継API側だけに保存し、端末側は短命トークンで同期します。

### 推奨: 短命トークン（中継API）

1. `broker-api` をCloudflare Workersへデプロイ  
2. Secretを設定（`GITHUB_PAT`, `BROKER_PASSPHRASE`, `SESSION_SIGNING_SECRET`）  
3. アプリの `クラウド同期` でモードを `短命トークン（中継API・推奨）` に設定  
4. `中継API URL` と `Gist ID` を保存（初回は `新規Gist作成` で作る）  
5. `短命トークン発行` を押してから `クラウドから取得 / クラウドへ保存` を利用  
6. `保存時に自動でクラウドへ反映` をONにすると自動同期

`broker-api` の詳細手順: `broker-api/README.md`

### 互換: 直接PAT（既存方式）

1. 同期モードを `直接PAT` に変更  
2. `PAT` と `Gist ID` を保存  
3. `クラウドから取得 / クラウドへ保存` を利用

## iPhoneホーム画面に追加（PWA）

`file://` 直開きではPWA機能が有効にならないため、Webサーバー経由で開いてください。  
また、Service Worker（オフライン起動）は `https://` 配信が必要です。

1. このフォルダを GitHub Pages / Netlify / Vercel などで `https://` 公開
2. iPhoneのSafariで公開URLを開く
3. 共有ボタンから `ホーム画面に追加`
4. 追加後は単体アプリとして起動（オフライン利用可）

表示が古い場合:

1. iPhoneでホーム画面アプリを完全終了
2. Safariで公開URLを開いて再読み込み
3. まだ古ければホーム画面アイコンを削除して再追加

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

- 同期を使わない場合、データは同一ブラウザ内のみ保存されます。
- `短命トークン` モードではPATは端末に保存されません（中継API側のみ）。
- `直接PAT` モードではPATが端末の`localStorage`へ保存されます。共有端末では使わないでください。
- ブラウザのストレージ削除でデータは消えます。必要なら定期的にJSONエクスポートしてください。
