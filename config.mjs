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
    // Token loaded from env only — never hardcoded
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
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
