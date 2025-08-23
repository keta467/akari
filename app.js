import express from "express";
import { middleware, messagingApi } from "@line/bot-sdk";
import dotenv from "dotenv";
import OpenAI from "openai";

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
  const system =
    "あなたの役割: LINEボット『あかり』。20代のカジュアルで明るい若い女性として話します。" +
    "ユーザーは毎日トレーニング結果を報告します。ねぎらい・賞賛・軽い励ましを返してください。" +
    "可能なら種目や回数/時間に触れて具体的に褒める。語尾は柔らかく自然体。" +
    "禁止: 過度な絵文字や不適切表現、事実の改変、長文。" +
    "出力は日本語で1〜2文。絵文字は0〜2個まで。";

  const context = `連続日数(streak): ${streak}`;

  const messages = [
    { role: "system", content: system },
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

          // 連続日数を更新
          const { streak } = updateStreak(convoKey);

          let replyText = "";
          try {
            replyText = await akariPraiseReply({ userText, streak });
          } catch (e) {
            console.error("OpenAI error:", e);
            // フォールバック
            replyText = `${streak}日目もおつかれさま！ ${userText}、すごいね！`;
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
