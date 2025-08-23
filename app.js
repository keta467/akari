import express from "express";
import { middleware, messagingApi, webhook } from "@line/bot-sdk";
import dotenv from "dotenv";

dotenv.config();

const { MessagingApiClient } = messagingApi;
const app = express();

function makeGirlish(text) {
  const girlishEndings = ['だよ〜', 'なの！', 'だね♪', 'よ〜', 'なのです〜', 'だよね♡'];
  const randomEnding = girlishEndings[Math.floor(Math.random() * girlishEndings.length)];
  
  // 既に語尾がある場合は置き換え、そうでなければ追加
  let result = text;
  if (result.endsWith('だ') || result.endsWith('である') || result.endsWith('です') || result.endsWith('ます')) {
    result = result.replace(/(?:だ|である|です|ます)$/, randomEnding);
  } else {
    result += randomEnding;
  }
  
  return result;
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
          const girlishText = makeGirlish(originalText);
          
          await client.replyMessage({
            replyToken: event.replyToken,
            messages: [{ type: "text", text: girlishText }],
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
