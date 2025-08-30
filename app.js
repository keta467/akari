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

// 環境変数の確認
console.log("[DEBUG] Starting app...");
console.log("[DEBUG] Environment variables check:");
console.log(
  "[DEBUG] - OPENAI_API_KEY:",
  process.env.OPENAI_API_KEY
    ? "Set (length: " + process.env.OPENAI_API_KEY.length + ")"
    : "NOT SET"
);
console.log(
  "[DEBUG] - CHANNEL_SECRET:",
  process.env.CHANNEL_SECRET
    ? "Set (length: " + process.env.CHANNEL_SECRET.length + ")"
    : "NOT SET"
);
console.log(
  "[DEBUG] - CHANNEL_ACCESS_TOKEN:",
  process.env.CHANNEL_ACCESS_TOKEN
    ? "Set (length: " + process.env.CHANNEL_ACCESS_TOKEN.length + ")"
    : "NOT SET"
);
console.log("[DEBUG] - PORT:", process.env.PORT || "3000 (default)");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* --------------------
   返答すべきかどうかを判定
-------------------- */
async function shouldRespond(userText) {
  console.log("[DEBUG] shouldRespond - Checking message:", userText);

  const checkPrompt = `
以下のメッセージに対して、あなたは返信すべきかどうかを判定してください。

判定基準：
1. 筋トレ報告メッセージの場合 → YES
2. 明らかに自分(あかり)に対して話しかけている場合 → YES  
3. それ以外 → NO

メッセージ: ${userText}

"YES" または "NO" のみで答えてください。`;

  try {
    console.log(
      "[DEBUG] shouldRespond - Calling OpenAI API with model: gpt-5-mini"
    );
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: shouldRespondPrompt },
        { role: "user", content: checkPrompt },
      ],
      // max_completion_tokens: 10,
    });

    const answer = response.output_text.trim().toUpperCase();
    console.log("[DEBUG] shouldRespond - OpenAI response:", answer);
    return answer === "YES";
  } catch (e) {
    console.error("[ERROR] shouldRespond - Error details:");
    console.error("[ERROR] - Message:", e.message);
    console.error("[ERROR] - Status:", e.status);
    console.error("[ERROR] - Response:", e.response?.data);
    console.error("[ERROR] - Full error:", e);

    // エラー時のフォールバック
    const fallbackResult =
      userText.includes("@あかり") || userText.includes("あかり");
    console.log(
      "[DEBUG] shouldRespond - Using fallback, result:",
      fallbackResult
    );
    return fallbackResult;
  }
}

/* --------------------
   返答メッセージを生成
-------------------- */
async function buildReplyMessage(userText) {
  console.log("[DEBUG] buildReplyMessage - Generating reply for:", userText);

  try {
    console.log(
      "[DEBUG] buildReplyMessage - Calling OpenAI API with model: gpt-5-mini"
    );

    console.log("★とりあえずチャレンジ★");
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        { role: "system", content: buildReplyMessagePrompt },
        { role: "user", content: userText },
      ],
      // max_output_tokens: 200,
    });

    // console.log("★とりあえずチャレンジ★");
    // const response = await openai.responses.create({
    //   model: "gpt-5",
    //   input: "Write a one-sentence bedtime story about a unicorn.",
    // });

    console.log("★", response);

    const replyContent = response.output_text;
    console.log("[DEBUG] buildReplyMessage - Generated reply:", replyContent);
    return replyContent;
  } catch (e) {
    console.error("[ERROR] buildReplyMessage - Error details:");
    console.error("[ERROR] - Message:", e.message);
    console.error("[ERROR] - Status:", e.status);
    console.error("[ERROR] - Response:", e.response?.data);
    console.error("[ERROR] - Full error:", e);

    // エラー時のフォールバック
    const fallbackMessage = "はい！どうしたの？";
    console.log(
      "[DEBUG] buildReplyMessage - Using fallback message:",
      fallbackMessage
    );
    return fallbackMessage;
  }
}

/* --------------------
   LINE Webhook
-------------------- */
app.post(
  "/callback",
  middleware({ channelSecret: process.env.CHANNEL_SECRET }),
  async (req, res) => {
    console.log("[DEBUG] Webhook - Received POST /callback");
    console.log(
      "[DEBUG] Webhook - Request body:",
      JSON.stringify(req.body, null, 2)
    );
    const client = new MessagingApiClient({
      channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    });

    const events = req.body.events || [];
    console.log("[DEBUG] Webhook - Events count:", events.length);
    await Promise.all(
      events.map(async (event, index) => {
        console.log(`[DEBUG] Webhook - Processing event ${index + 1}:`);
        console.log("[DEBUG] - Event type:", event.type);
        console.log("[DEBUG] - Message type:", event.message?.type);

        if (event.type === "message" && event.message.type === "text") {
          const userText = event.message.text;

          console.log("[DEBUG] Webhook - Text message details:");
          console.log("[DEBUG] - Source type:", event.source.type);
          console.log("[DEBUG] - Source userId:", event.source.userId);
          console.log("[DEBUG] - Source groupId:", event.source.groupId);
          console.log("[DEBUG] - Source roomId:", event.source.roomId);
          console.log("[DEBUG] - Message text:", userText);
          console.log("[DEBUG] - Reply token:", event.replyToken);

          // グループ/ルームの場合のみ返答すべきかチェック
          if (event.source.type === "group" || event.source.type === "room") {
            console.log(
              "[DEBUG] Webhook - Group/Room message, checking if should respond..."
            );
            const shouldReply = await shouldRespond(userText);
            console.log("[DEBUG] Webhook - Should respond:", shouldReply);

            if (!shouldReply) {
              console.log("[DEBUG] Webhook - Skipping reply (not needed)");
              return;
            }
          } else {
            console.log("[DEBUG] Webhook - Direct message (user), will reply");
          }

          // 返答メッセージを生成
          console.log("[DEBUG] Webhook - Generating reply message...");
          const replyText = await buildReplyMessage(userText);
          console.log("[DEBUG] Webhook - Reply text:", replyText);

          try {
            console.log("[DEBUG] Webhook - Sending reply via LINE API...");
            await client.replyMessage({
              replyToken: event.replyToken,
              messages: [{ type: "text", text: replyText }],
            });
            console.log("[DEBUG] Webhook - Reply sent successfully");
          } catch (replyError) {
            console.error("[ERROR] Webhook - Failed to send reply:");
            console.error("[ERROR] - Message:", replyError.message);
            console.error("[ERROR] - Status:", replyError.statusCode);
            console.error("[ERROR] - Response:", replyError.body);
            console.error("[ERROR] - Full error:", replyError);
          }
        } else {
          console.log("[DEBUG] Webhook - Non-text message, skipping");
        }
      })
    );

    console.log("[DEBUG] Webhook - All events processed, sending 200 OK");
    res.sendStatus(200);
  }
);

app.get("/", (_req, res) => {
  console.log("[DEBUG] Health check - GET /");
  res.send("OK");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("[DEBUG] ========================================");
  console.log(`[DEBUG] Server started successfully on port ${port}`);
  console.log("[DEBUG] Webhook URL: POST /callback");
  console.log("[DEBUG] Health check URL: GET /");
  console.log("[DEBUG] ========================================");
});
