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
  ingestion: {
    intervalMinutes: parseInt(process.env.INGESTION_INTERVAL || "30", 10),
    maxEmails: 50,
  },
  dailyReport: {
    hour: parseInt(process.env.DAILY_REPORT_HOUR || "8", 10),
    minute: parseInt(process.env.DAILY_REPORT_MINUTE || "0", 10),
  },
};
