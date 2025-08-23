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
   あかり用：ユーザーごとの実績メモリ（簡易）
   - streak: 連続日数
   - lastDate: 最後に報告があった JST 日付(YYYY-MM-DD)
-------------------- */
const userStats = new Map(); // key -> { streak: number, lastDate: string }

function keyFromSource(src) {
  if (src.type === "user") return `user:${src.userId}`;
  if (src.type === "group") return `group:${src.groupId}`;
  if (src.type === "room") return `room:${src.roomId}`;
  return "unknown";
}

// JST の "今日" を YYYY-MM-DD で返す（日本はDSTなしなので固定+9時間でOK）
function nowJst() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
function dateStrJst(d) {
  return d.toISOString().slice(0, 10);
}
function todayStrJst() {
  return dateStrJst(nowJst());
}
function yesterdayStrJst() {
  return dateStrJst(new Date(nowJst().getTime() - 24 * 60 * 60 * 1000));
}

function updateStreak(convoKey) {
  const today = todayStrJst();
  const yesterday = yesterdayStrJst();
  const cur = userStats.get(convoKey) || { streak: 0, lastDate: "" };

  if (cur.lastDate === today) {
    // 同日複数回報告 → streakは据え置き
    return cur;
  }
  if (cur.lastDate === yesterday) {
    cur.streak += 1;
  } else {
    cur.streak = 1;
  }
  cur.lastDate = today;
  userStats.set(convoKey, cur);
  return cur;
}

/* --------------------
   「あかり」キャラで、筋トレ報告へのねぎらい返信を生成
   - 入力: userText, streak 等の文脈
   - 出力: 1〜2文、日本語、カジュアルで明るい若い女性
-------------------- */
async function akariPraiseReply({ userText, streak }) {
  const context = `連続日数(streak): ${streak}`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "system", content: context },
    { role: "user", content: `今日の報告: ${userText}` },
  ];

  const resp = await openai.responses.create({
    model: "gpt-4o-mini",
    input: messages,
  });
  return (resp.output_text || "").trim();
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
          const convoKey = keyFromSource(event.source);
          const userText = event.message.text;

          // // デバッグ用ログ
          // console.log("Source type:", event.source.type);
          // console.log("Message text:", userText);
          // console.log("Message object:", JSON.stringify(event.message, null, 2));

          // グループ/ルームでは@メンションされたときだけ返信
          if (event.source.type === "group" || event.source.type === "room") {
            // テキストに「@あかり」が含まれているかチェック
            if (!userText.includes("@あかり")) {
              return;
            }

            // メンションを除去してから処理を続ける
            const cleanText = userText.replace(/@あかり/g, "").trim();
            if (cleanText) {
              event.message.text = cleanText;
            }
          }

          // 連続日数を更新
          const { streak } = updateStreak(convoKey);

          let replyText = "";
          try {
            // グループ/ルームの場合はクリーンなテキストを使用
            const textForAI = event.message.text;
            replyText = await akariPraiseReply({ userText: textForAI, streak });
          } catch (e) {
            console.error("OpenAI error:", e);
            // フォールバック
            replyText = `${streak}日目もおつかれさま！ ${event.message.text}、すごいね！`;
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
