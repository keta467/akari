import express from "express";
import { middleware, messagingApi } from "@line/bot-sdk";
import dotenv from "dotenv";
import OpenAI from "openai";
import { systemPrompt } from "./systemPrompt.js";

dotenv.config();

const { MessagingApiClient } = messagingApi;
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


/* --------------------
   メッセージ判定と返信生成を同時に行う
   返信不要の場合はnullを返す
-------------------- */
async function generateReplyIfNeeded(userText) {
  const checkPrompt = `
以下のメッセージに対して、あなたは返信すべきかどうかを判定し、返信する場合はその内容を生成してください。

判定基準：
1. 筋トレ報告メッセージの場合 → 返答メッセージを生成
2. 明らかに自分(あかり)に対して話しかけている場合 → 返答メッセージを生成  
3. それ以外 → "NO"

メッセージ: ${userText}

返信する場合は返答メッセージを、返信しない場合は "NO" とだけ答えてください。`;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: checkPrompt }
      ],
      max_tokens: 200,
      temperature: 0.7
    });
    
    const answer = resp.choices[0].message.content.trim();
    return answer === "NO" ? null : answer;
  } catch (e) {
    console.error("Reply generation error:", e);
    // エラー時のフォールバック
    if (userText.includes("@あかり") || userText.includes("あかり")) {
      return "はい！どうしたの？";
    }
    return null;
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

          // メッセージ判定と返信生成を同時に実行
          const replyText = await generateReplyIfNeeded(userText);
          
          if (!replyText) {
            console.log("No reply needed");
            return;
          }

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
