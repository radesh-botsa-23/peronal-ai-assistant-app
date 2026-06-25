import dotenv from "dotenv";
dotenv.config();

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID || "1516680999772094617",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  whatsapp: {
    phoneId: process.env.WHATSAPP_PHONE_ID || "1149331888269055",
    whatsappId: process.env.WHATSAPP_BUSINESS_ID || "4373204106268491",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "EAAOC0x9uJTQBR9mDZAYydUP26PSICgKZAvRfMASos5HQRJSnOFjtgIb0ZBljTNCZCZAtwQxpIcGac5pk9dwZBpQs02qyZCzSAri3H80qfLFz0uRrW9YpweDZA57ZCkItl0EWZAQEtPHpZBECKfxgBMZAnvD03tsjm16Wj87iKZCteQ6jYQsHtvbKs6NEDZC6dg0baMS8t4bRuBLmYHIN80i2ZCN6ZCKsHZC2uD38F0C5hXXTZBd4X0bMpdDpKKiAZDZD",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "personal_ai_assistant_verify",
  },
  fireflies: {
    apiKey: process.env.FIREFLIES_API_KEY || "",
  },
  ingestion: {
    intervalMinutes: parseInt(process.env.INGESTION_INTERVAL || "30", 10),
    maxEmails: 50,
  },
  dailyReport: {
    hour: parseInt(process.env.DAILY_REPORT_HOUR || "8", 10),
    minute: parseInt(process.env.DAILY_REPORT_MINUTE || "0", 10),
  },
};
