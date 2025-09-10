# あかり LINE Bot 仕様書

## 概要
- ボット名: **あかり**
- キャラクター設定: 20代のカジュアルで明るい若い女性
- 想定利用: ユーザーが毎日筋トレ内容を報告 → あかりがねぎらい・励ましを返す
- 使用技術: Node.js (Express), LINE Messaging API, OpenAI API (`gpt-5-mini`)

---

## 機能
### 1. 筋トレ報告への返信
- ユーザーが LINE 上でトレーニング内容を送信すると、あかりが **女の子らしい文体**で返信。
- 具体的にトレーニング種目や回数に触れ、1〜2文で短く返す。
- 絵文字は0〜2個まで使用可。
- 過度な絵文字、不適切な表現、事実の改変、長文は禁止。

### 2. 返信するかの判定
- グループ・ルームでメッセージを受信した場合、OpenAI による判定を行い、
  筋トレ報告や「あかり」への呼びかけでないメッセージには返信しない。

### 3. 返信内容の生成
- OpenAI API (`gpt-5-mini`) を利用。
- フォールバック: 生成失敗時は「はい！どうしたの？」を返す。

### 4. LINE Webhook
- エンドポイント: `/callback`
- 受信したテキストメッセージを処理し、OpenAI に投げて返信を生成。
- 応答は `replyMessage` で送信。
- `/` に GET すると "OK" を返す。

---

## 実行環境
- 環境変数:
  - `CHANNEL_SECRET` : LINE チャネルシークレット
  - `CHANNEL_ACCESS_TOKEN` : LINE アクセストークン
  - `OPENAI_API_KEY` : OpenAI API キー
  - `PORT` : サーバーポート (デフォルト 3000)

## 実行方法
```bash
npm install
npm start
```

---

## 参考リンク
- [OpenAI API](https://platform.openai.com/docs/api-reference/introduction)
- [LINE Developers](https://developers.line.biz/console/)
- [Render](https://dashboard.render.com/web/srv-d2ksu23uibrs73ek76q0)

