# LINE Bot 開発サポート

README のクイックスタートを進める際に必要となる LINE Developers コンソールでの設定手順をまとめました。

## 1. LINE アカウントでログイン
1. https://developers.line.biz/ja/ にアクセス
2. 「ログイン」から LINE アカウントでログイン

## 2. プロバイダーとチャネルの作成
1. 左メニューの「プロバイダーを作成」で任意の名前を入力
2. プロバイダー内で「チャネルを作成」→「Messaging API」を選択
3. チャネル名や説明を入力し作成します。
4. 作成後、チャネル基本設定に表示される **チャネルシークレット** を控えます。

## 3. チャネルアクセストークンの発行
1. チャネル詳細の「Messaging API 設定」へ移動
2. 「チャネルアクセストークン（ロングターム）」を発行
3. `.env` に以下を設定します
   ```env
   CHANNEL_SECRET=取得したチャネルシークレット
   CHANNEL_ACCESS_TOKEN=発行したアクセストークン
   ```

## 4. Webhook 設定
1. 「Messaging API 設定」で Webhook URL を `https://YOUR_DOMAIN/callback` の形式で設定
2. Webhook を有効化し、「応答メッセージ」をオフにします。

## 5. Bot を友だち追加
チャネル詳細画面の QR コードから Bot を友だち追加します。

## 6. 動作確認
1. サーバーをローカルで起動: `npm start`
2. ngrok などで外部公開し、Webhook URL として利用します。
3. LINE で Bot にメッセージを送り、応答を確認します。

---
必要に応じて [LINE Developers ドキュメント](https://developers.line.biz/ja/docs/messaging-api/) も参照してください。
