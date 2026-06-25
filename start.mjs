import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("🚀 Personal AI Assistant — Starting services...\n");

const processes = [];

function spawnProcess(name, file, env = {}) {
  const proc = spawn("node", [path.join(__dirname, file)], {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  proc.on("error", (err) => console.error(`[${name}] Error:`, err.message));
  proc.on("exit", (code) => {
    if (code !== 0) console.error(`[${name}] Exited with code ${code}`);
  });
  processes.push(proc);
  console.log(`✅ Started: ${name}`);
  return proc;
}

// Always start the Discord bot
spawnProcess("Discord Bot", "discord-bot.mjs");

// Always start the ingestion pipeline
spawnProcess("Email Ingestion", "ingestion-pipeline.mjs");

// Start WhatsApp webhook only if access token is configured
if (config.whatsapp.accessToken) {
  spawnProcess("WhatsApp Webhook", "whatsapp-webhook.mjs");
} else {
  console.log("⏭️  WhatsApp webhook skipped (WHATSAPP_ACCESS_TOKEN not set)");
}

console.log("");

// Graceful shutdown
function shutdown() {
  console.log("\n🛑 Shutting down all services...");
  for (const proc of processes) {
    proc.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
