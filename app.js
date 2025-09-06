import express from "express";
import { middleware, messagingApi } from "@line/bot-sdk";
import dotenv from "dotenv";
import OpenAI from "openai";
import {
  shouldRespondPrompt,
  buildReplyMessagePrompt,
} from "./systemPrompt.js";

dotenv.config();

const { MessagingApiClient } = messagingApi;
const app = express();

const channelSecret = process.env.CHANNEL_SECRET;
const channelAccessToken = process.env.CHANNEL_ACCESS_TOKEN;

// 環境変数の確認
console.log("環境変数:", {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "設定済み" : "未設定",
  CHANNEL_SECRET: process.env.CHANNEL_SECRET ? "設定済み" : "未設定",
  CHANNEL_ACCESS_TOKEN: process.env.CHANNEL_ACCESS_TOKEN
    ? "設定済み"
    : "未設定",
  PORT: process.env.PORT || "3000",
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* --------------------
   OpenAI API共通処理
-------------------- */
async function callOpenAI(systemPrompt, userPrompt, maxTokens = 200) {
  try {
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return response.output_text?.trim() || "";
  } catch (e) {
    console.error("[OpenAI API] エラー:", e.message);
    throw e;
  }
}

/* --------------------
   返答すべきかどうかを判定
-------------------- */
async function shouldRespond(userText) {
  const checkPrompt = `
以下のメッセージに対して、あなたは返信すべきかどうかを判定してください。

判定基準：
1. 筋トレ報告メッセージの場合 → YES
2. 明らかに自分(あかり)に対して話しかけている場合 → YES  
3. それ以外 → NO

メッセージ: ${userText}

"YES" または "NO" のみで答えてください。`;

  try {
    const answer = await callOpenAI(shouldRespondPrompt, checkPrompt, 10);
    return answer.toUpperCase() === "YES";
  } catch (e) {
    // エラー時のフォールバック
    return userText.includes("@あかり") || userText.includes("あかり");
  }
}

/* --------------------
   返答メッセージを生成
-------------------- */
async function buildReplyMessage(userText) {
  try {
    const reply = await callOpenAI(buildReplyMessagePrompt, userText, 200);
    const trimmed = reply.trim();
    return trimmed.endsWith("にゃん") ? trimmed : trimmed + "にゃん";
  } catch (e) {
    // エラー時のフォールバック
    return "はい！どうしたの？にゃん";
  }
}

/* --------------------
   LINE Webhook
-------------------- */
app.post(
  "/callback",
  middleware({ channelSecret }),
  async (req, res) => {
    const client = new MessagingApiClient({
      channelAccessToken,
    });

    const events = req.body.events || [];
    await Promise.all(
      events.map(async (event) => {
        if (event.type === "message" && event.message.type === "text") {
          const userText = event.message.text;
          console.log(`[${event.source.type}] メッセージ受信: ${userText}`);

          // グループ/ルームの場合のみ返答すべきかチェック
          if (event.source.type === "group" || event.source.type === "room") {
            const shouldReply = await shouldRespond(userText);
            if (!shouldReply) {
              console.log("→ 返信不要と判定");
              return;
            }
            console.log("→ 返信する");
          }

          // 返答メッセージを生成
          const replyText = await buildReplyMessage(userText);
          console.log("→ 返信内容:", replyText);

          try {
            await client.replyMessage({
              replyToken: event.replyToken,
              messages: [{ type: "text", text: replyText }],
            });
          } catch (replyError) {
            console.error("[LINE API] 送信エラー:", replyError.message);
          }
        }
      })
    );

    res.sendStatus(200);
  }
);

app.get("/", (_req, res) => res.send("OK"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`サーバー起動: ポート ${port}`);
});
