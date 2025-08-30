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
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    const resp = await openai.chat.completions.create({
      // model: "gpt-4o-mini",
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: shouldRespondPrompt },
        { role: "user", content: checkPrompt },
      ],
      max_completion_tokens: 10,
    });

    const answer = resp.choices[0].message.content.trim().toUpperCase();
    return answer === "YES";
  } catch (e) {
    console.error("Should respond check error:", e);
    // エラー時のフォールバック
    return userText.includes("@あかり") || userText.includes("あかり");
  }
}

/* --------------------
   返答メッセージを生成
-------------------- */
async function buildReplyMessage(userText) {
  try {
    const resp = await openai.chat.completions.create({
      // model: "gpt-4o-mini",
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: buildReplyMessagePrompt },
        { role: "user", content: userText },
      ],
      max_completion_tokens: 200,
    });

    return resp.choices[0].message.content.trim();
  } catch (e) {
    console.error("Reply message generation error:", e);
    // エラー時のフォールバック
    return "はい！どうしたの？";
  }
}

/* --------------------
   LINE Webhook
-------------------- */
app.post(
  "/callback",
  middleware({ channelSecret: process.env.CHANNEL_SECRET }),
  async (req, res) => {
    const client = new MessagingApiClient({
      channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    });

    const events = req.body.events || [];
    await Promise.all(
      events.map(async (event) => {
        if (event.type === "message" && event.message.type === "text") {
          const userText = event.message.text;

          // デバッグ用ログ
          console.log("Source type:", event.source.type);
          console.log("Message text:", userText);

          // グループ/ルームの場合のみ返答すべきかチェック
          if (event.source.type === "group" || event.source.type === "room") {
            const shouldReply = await shouldRespond(userText);
            console.log("Should respond:", shouldReply);

            if (!shouldReply) {
              console.log("No reply needed");
              return;
            }
          }

          // 返答メッセージを生成
          const replyText = await buildReplyMessage(userText);
          console.log("Reply text:", replyText);

          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [{ type: "text", text: replyText }],
          });
        }
      })
    );

    res.sendStatus(200);
  }
);

app.get("/", (_req, res) => res.send("OK"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on ${port}`);
});
