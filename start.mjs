import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { config } from "./config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper to sanitize environment variables that might contain outer quotes
function sanitizeEnvJson(val) {
  if (!val) return val;
  let str = val.trim();
  if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
    str = str.substring(1, str.length - 1).trim();
  }
  return str;
}

// 1. Recreate credentials and token files from env if they don't exist (e.g. on Railway)
if (process.env.GMAIL_CREDENTIALS_JSON && !fs.existsSync(path.join(__dirname, "credentials.json"))) {
  const sanitizedCreds = sanitizeEnvJson(process.env.GMAIL_CREDENTIALS_JSON);
  fs.writeFileSync(path.join(__dirname, "credentials.json"), sanitizedCreds, "utf8");
  console.log("📝 Created credentials.json from GMAIL_CREDENTIALS_JSON environment variable.");
}
if (process.env.GMAIL_TOKEN_JSON && !fs.existsSync(path.join(__dirname, "token.json"))) {
  const sanitizedToken = sanitizeEnvJson(process.env.GMAIL_TOKEN_JSON);
  fs.writeFileSync(path.join(__dirname, "token.json"), sanitizedToken, "utf8");
  console.log("📝 Created token.json from GMAIL_TOKEN_JSON environment variable.");
}

const isDocker = fs.existsSync("/.dockerenv") || process.env.RAILWAY_ENVIRONMENT !== undefined || process.env.SPACE_ID !== undefined || __dirname.startsWith("/usr/src/app");

// 2. OpenClaw config injection (inject Railway environment variables into openclaw.json when in Docker)
try {
  if (isDocker) {
    const homeDir = process.env.HOME || "/root";
    const openclawConfigPath = path.join(homeDir, ".openclaw", "openclaw.json");
    if (fs.existsSync(openclawConfigPath)) {
      console.log("⚙️ Injecting environment variables into openclaw.json...");
      const configStr = fs.readFileSync(openclawConfigPath, "utf8");
      const configJson = JSON.parse(configStr);

      if (!configJson.channels) configJson.channels = {};
      if (!configJson.channels.discord) configJson.channels.discord = {};
      if (!configJson.auth) configJson.auth = {};
      if (!configJson.auth.profiles) configJson.auth.profiles = {};
      if (!configJson.agents) configJson.agents = {};
      if (!configJson.agents.defaults) configJson.agents.defaults = {};

      // Inject Discord token
      if (process.env.DISCORD_TOKEN) {
        configJson.channels.discord.token = process.env.DISCORD_TOKEN;
        configJson.channels.discord.enabled = true;
        console.log("✅ Injected DISCORD_TOKEN into openclaw.json");
      }

      // Inject Telegram token
      if (process.env.TELEGRAM_BOT_TOKEN) {
        if (!configJson.channels.telegram) configJson.channels.telegram = {};
        configJson.channels.telegram.botToken = process.env.TELEGRAM_BOT_TOKEN;
        configJson.channels.telegram.enabled = true;
        console.log("✅ Injected TELEGRAM_BOT_TOKEN into openclaw.json");
      }

      // Inject Gemini API Key
      if (process.env.GEMINI_API_KEY) {
        // Setup Google API profile definition in openclaw.json (without key to prevent schema errors)
        if (!configJson.auth.profiles["google:default"]) {
          configJson.auth.profiles["google:default"] = { mode: "api_key", provider: "google" };
        }
        
        // Write actual key to the internal auth-profiles.json file where OpenClaw expects it
        const authProfilesDir = path.join(homeDir, ".openclaw", "agents", "main", "agent");
        fs.mkdirSync(authProfilesDir, { recursive: true });
        
        const authProfilesPath = path.join(authProfilesDir, "auth-profiles.json");
        const authProfilesJson = {
          version: 1,
          profiles: {
            "google:default": {
              type: "api_key",
              provider: "google",
              key: process.env.GEMINI_API_KEY
            }
          }
        };
        fs.writeFileSync(authProfilesPath, JSON.stringify(authProfilesJson, null, 2), "utf8");
        console.log("✅ Injected GEMINI_API_KEY into OpenClaw auth-profiles.json");
      }

      // Align workspace path with container home directory
      configJson.agents.defaults.workspace = path.join(homeDir, ".openclaw", "workspace");

      fs.writeFileSync(openclawConfigPath, JSON.stringify(configJson, null, 2), "utf8");
      console.log("⚙️ openclaw.json configuration sync complete.");
    } else {
      console.log("⏭️  OpenClaw config file not found at ~/.openclaw/openclaw.json (skipping injection)");
    }
  }
} catch (err) {
  console.error("⚠️ Failed to inject configs into openclaw.json:", err.message);
}

// Database sync helper for container runs (copy from local fast VFS /tmp to persistent volume /root/.gbrain)
const localDbDir = "/tmp/.gbrain";
const homeDir = process.env.HOME || "/root";
const persistentDbDir = path.join(homeDir, ".gbrain");

async function syncLocalDbToPersistent() {
  try {
    if (fs.existsSync(path.join(localDbDir, "brain.pglite"))) {
      const { execSync } = await import("child_process");
      // Recreate directory on persistent volume if missing
      fs.mkdirSync(persistentDbDir, { recursive: true });
      
      // Clean up locks folder from persistent storage to avoid stale locks
      const persistentLocks = path.join(persistentDbDir, ".locks");
      if (fs.existsSync(persistentLocks)) {
        fs.rmSync(persistentLocks, { recursive: true, force: true });
      }

      // Copy from local fast FS to the persistent volume
      execSync(`cp -R ${localDbDir}/* ${persistentDbDir}/`, { stdio: "ignore" });
    }
  } catch (err) {
    console.error("⚠️ Database sync failed:", err.message);
  }
}

// 3. Auto-initialize, seed, or restore GBrain database locally (bypasses cloud locking issues)
try {
  if (isDocker) {
    const seedDir = "/usr/src/gbrain-seed";
    const { execSync } = await import("child_process");

    // WIPE any existing cached databases to start completely fresh and clean
    if (fs.existsSync(localDbDir)) {
      fs.rmSync(localDbDir, { recursive: true, force: true });
    }
    if (fs.existsSync(persistentDbDir)) {
      // Clean up files inside persistent storage but keep the mount directory
      const files = fs.readdirSync(persistentDbDir);
      for (const file of files) {
        fs.rmSync(path.join(persistentDbDir, file), { recursive: true, force: true });
      }
    }

    // Create local writable tmp directory for fast db lock operations
    fs.mkdirSync(localDbDir, { recursive: true });

    if (fs.existsSync(seedDir)) {
      console.log("🗄️ Seeding local database from pre-populated seed data...");
      execSync(`cp -R ${seedDir}/* ${localDbDir}/`, { stdio: "inherit" });
    } else {
      console.log("🗄️ Initializing clean fresh local database...");
      execSync("gbrain init --pglite", { stdio: "inherit", env: { ...process.env, HOME: "/tmp" } });
    }

    // Set config.json database_path to point to /tmp to avoid filesystem locks crashing PGlite
    const localConfigPath = path.join(localDbDir, "config.json");
    if (fs.existsSync(localConfigPath)) {
      const configStr = fs.readFileSync(localConfigPath, "utf8");
      const configJson = JSON.parse(configStr);
      configJson.database_path = "/tmp/.gbrain/brain.pglite";
      
      // Inject API key if configured
      if (process.env.GEMINI_API_KEY) {
        configJson.google_api_key = process.env.GEMINI_API_KEY;
      }
      
      fs.writeFileSync(localConfigPath, JSON.stringify(configJson, null, 2), "utf8");
      console.log("✅ Configured local database path and API key inside config.json");
    }

    // Recreate locks folder in local folder to ensure clean launch
    const localLocks = path.join(localDbDir, ".locks");
    if (fs.existsSync(localLocks)) {
      fs.rmSync(localLocks, { recursive: true, force: true });
    }
    fs.mkdirSync(localLocks, { recursive: true });

    // Ensure all directories and files are fully readable/writable inside Docker
    execSync(`chmod -R 777 ${localDbDir}`, { stdio: "ignore" });

    // Copy configurations back to the persistent volume so gbrain CLI can locate them
    await syncLocalDbToPersistent();
    console.log("✅ Database preparation complete.");

    // Run diagnostics to debug the PGlite initialization failure
    console.log("🩺 Running gbrain doctor diagnostics inside container...");
    try {
      console.log("🩺 [DEBUG] process.env.HOME:", process.env.HOME);
      console.log("🩺 [DEBUG] os.homedir():", (await import("os")).homedir());
      console.log("🩺 [DEBUG] localDbDir files:", fs.existsSync(localDbDir) ? fs.readdirSync(localDbDir) : "DOES NOT EXIST");
      console.log("🩺 [DEBUG] persistentDbDir files:", fs.existsSync(persistentDbDir) ? fs.readdirSync(persistentDbDir) : "DOES NOT EXIST");
      if (fs.existsSync(path.join(persistentDbDir, "config.json"))) {
        console.log("🩺 [DEBUG] persistentDbDir config.json content:", fs.readFileSync(path.join(persistentDbDir, "config.json"), "utf8"));
      }
      execSync("gbrain doctor", { stdio: "inherit" });
    } catch (docErr) {
      console.error("❌ gbrain doctor command failed:", docErr.message);
    }

  }
} catch (err) {
  console.error("⚠️ Failed to initialize/seed GBrain database:", err.message);
}

// 4. Start background database sync every 1 minute
if (isDocker) {
  setInterval(syncLocalDbToPersistent, 60000);
  console.log("🔄 Background database sync scheduled (every 60s).");
}

console.log("🚀 Personal AI Assistant — Starting services...\n");

const processes = [];

// Start services in-process (saves memory by combining Node.js runtimes)
console.log("🟢 Starting background services in-process...");

import("./discord-bot.mjs").catch((err) => {
  console.error("❌ [Discord Bot] Failed to load:", err.message);
});

import("./ingestion-pipeline.mjs").catch((err) => {
  console.error("❌ [Email Ingestion] Failed to load:", err.message);
});

if (config.whatsapp.accessToken) {
  import("./whatsapp-webhook.mjs").catch((err) => {
    console.error("❌ [WhatsApp Webhook] Failed to load:", err.message);
  });
  console.log("✅ Loaded WhatsApp webhook agent in-process.");
} else {
  console.log("⏭️  WhatsApp webhook skipped (WHATSAPP_ACCESS_TOKEN not set)");
}

// Start OpenClaw Gateway on Linux/Railway only when running in Docker
try {
  if (isDocker) {
    console.log("🟢 Starting OpenClaw Gateway...");
    const openclawProc = spawn("openclaw", ["gateway", "run", "--force"], {
      stdio: "inherit",
      env: { ...process.env },
    });
    openclawProc.on("error", (err) => console.error("[OpenClaw Gateway] Error:", err.message));
    openclawProc.on("exit", (code) => {
      if (code !== 0) console.error(`[OpenClaw Gateway] Exited with code ${code}`);
    });
    processes.push(openclawProc);
  }
} catch (err) {
  console.error("⚠️ Failed to launch OpenClaw Gateway:", err.message);
}

console.log("");

// Graceful shutdown
async function shutdown() {
  console.log("\n🛑 Shutting down all services...");
  for (const proc of processes) {
    proc.kill("SIGTERM");
  }
  
  if (isDocker) {
    console.log("💾 Performing final database sync to persistent volume...");
    await syncLocalDbToPersistent();
    console.log("✅ Database saved.");
  }
  
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
