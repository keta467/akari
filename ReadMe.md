# あかり LINE Bot 仕様書

## 概要
- ボット名: **あかり**
- キャラクター設定: 20代のカジュアルで明るい若い女性
- 想定利用: ユーザーが毎日筋トレ内容を報告 → あかりがねぎらい・励ましを返す
- 使用技術: Node.js (Express), LINE Messaging API, OpenAI API

---

## 機能
### 1. 筋トレ報告への返信
- ユーザーが LINE 上でトレーニング内容を送信すると、あかりが **女の子らしい文体**で返信。
- 具体的にトレーニング種目や回数に触れ、1〜2文で短く返す。
- 絵文字は0〜2個まで使用可。
- 過度な絵文字、不適切な表現、事実の改変、長文は禁止。

### 2. 連続日数の記録
- ユーザーごとに**連続日数 (streak)** を記録。
- 同じ日に複数回報告しても streak は増えない。
- 前日に報告があり、翌日も報告 → streak +1。
- それ以外の日に報告 → streak を 1 にリセット。
- JST（日本標準時）を基準に日付判定。

### 3. 返信内容の生成
- OpenAI API (`gpt-4o-mini`) を利用。
- プロンプトで「20代カジュアルな女性」「筋トレ報告に対してねぎらう」などのキャラクター指示を与える。
- streak もコンテキストに含めて返信を生成。
- API 呼び出し失敗時はフォールバックメッセージ：
  ```
  {streak}日目もおつかれさま！ {報告内容}、すごいね！
  ```

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

---



OpenAPI
https://platform.openai.com/docs/api-reference/introduction


ラインデベロッパー
https://developers.line.biz/console/channel/1657625984/messaging-api

デプロイ
Render