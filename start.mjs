import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Main entry point - starts both the Discord bot and the ingestion pipeline.
 */

console.log("🚀 Personal AI Assistant - Starting all services...\n");

// Start Discord Bot
const bot = spawn("node", [path.join(__dirname, "discord-bot.mjs")], {
  stdio: "inherit",
  env: { ...process.env },
});

// Start Ingestion Pipeline
const ingestion = spawn("node", [path.join(__dirname, "ingestion-pipeline.mjs")], {
  stdio: "inherit",
  env: { ...process.env },
});

bot.on("error", (err) => {
  console.error("Discord bot error:", err.message);
});

ingestion.on("error", (err) => {
  console.error("Ingestion pipeline error:", err.message);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down...");
  bot.kill();
  ingestion.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  bot.kill();
  ingestion.kill();
  process.exit(0);
});
