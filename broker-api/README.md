# Life OS Broker API

短命トークン方式の中継APIです。  
GitHub PATをサーバー側だけに保持し、クライアントには短命トークンのみを渡します。

## 前提

- Cloudflare Workers
- `wrangler` CLI

## 1. セットアップ

1. このフォルダへ移動

```bash
cd "/Users/jihen/Library/Mobile Documents/com~apple~CloudDocs/ChatGPT/life-os-app/broker-api"
```

2. `wrangler.toml.example` を `wrangler.toml` にコピーして値を調整

```bash
cp wrangler.toml.example wrangler.toml
```

## 2. Secret設定

`wrangler` で以下3つを登録します。

```bash
wrangler secret put GITHUB_PAT
wrangler secret put BROKER_PASSPHRASE
wrangler secret put SESSION_SIGNING_SECRET
```

- `GITHUB_PAT`: `gist` 権限があるPAT
- `BROKER_PASSPHRASE`: アプリで入力する共通パスフレーズ
- `SESSION_SIGNING_SECRET`: JWT署名用の十分長いランダム文字列

## 3. デプロイ

```bash
wrangler deploy
```

デプロイ後、表示されるURL（例: `https://life-os-broker.xxx.workers.dev`）をアプリ側の「中継API URL」に設定します。

## エンドポイント

- `GET /v1/health`
- `POST /v1/session`
- `POST /v1/gist/create`
- `POST /v1/gist/push`
- `POST /v1/gist/pull`

## セキュリティ注意

- `ALLOWED_ORIGINS` は公開アプリのドメインに絞ってください。
- `BROKER_PASSPHRASE` は定期的に変更してください。
- `GITHUB_PAT` はこのAPI専用にし、必要最小権限（`gist`）にしてください。
