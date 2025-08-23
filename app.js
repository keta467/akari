import express from "express";
import { middleware, messagingApi, webhook } from "@line/bot-sdk";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const { MessagingApiClient } = messagingApi;
const app = express();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// OpenAI で「女の子っぽい」文体にパラフレーズ
async function toGirlishByAI(text) {
  const prompt = [
    "あなたはカジュアルで明るい若い女性の文体に変換するライターです。",
    "禁止：過度な絵文字連発・性的/不適切表現・意味の改変。語尾は柔らかく、フレンドリーに。",
    "敬語は控えめ、砕けすぎない自然体。語尾の例：〜だよ、〜なの、〜だね、〜かな、〜だよね など。",
    "入力文の意味は維持し、1文〜2文で返答。日本語で出力。",
    "",
    `入力: ${text}`,
    "出力: ",
  ].join("\n");

  const resp = await openai.responses.create({
    model: "gpt-4o-mini",
    input: prompt,
  });
  // SDKのヘルパでテキスト取り出し
  return (resp.output_text || "").trim();
}

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
          const originalText = event.message.text;

          let replyText = "";
          try {
            replyText = await toGirlishByAI(originalText);
          } catch (e) {
            console.error("OpenAI error:", e);
            // フォールバック（失敗時は元の簡易変換で返す）
            replyText = originalText + "だよ〜";
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
