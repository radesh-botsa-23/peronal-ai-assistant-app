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

// Database configuration for container runs (using native local PostgreSQL server instead of WASM-based PGlite)
const homeDir = process.env.HOME || "/root";

try {
  if (isDocker) {
    const { execSync } = await import("child_process");
    const gbrainConfigDir = path.join(homeDir, ".gbrain");
    fs.mkdirSync(gbrainConfigDir, { recursive: true });
    const configPath = path.join(gbrainConfigDir, "config.json");

    if (process.env.DATABASE_URL) {
      console.log("🗄️ DATABASE_URL detected. Configuring GBrain to use external PostgreSQL...");
      let needsInit = true;
      if (fs.existsSync(configPath)) {
        try {
          const configStr = fs.readFileSync(configPath, "utf8");
          const configJson = JSON.parse(configStr);
          if (configJson.engine === "postgres" && configJson.url === process.env.DATABASE_URL) {
            needsInit = false;
          } else {
            console.log("🔄 Database URL changed. Re-initializing GBrain config...");
            fs.rmSync(configPath, { force: true });
          }
        } catch {
          fs.rmSync(configPath, { force: true });
        }
      }
      if (needsInit) {
        execSync(`gbrain init --url "${process.env.DATABASE_URL}" --no-embedding`, { stdio: "inherit" });
      }
    } else {
      // Start native PostgreSQL database inside Docker
      const pgDataDir = path.join(homeDir, ".postgres-data");
      const pgLogFile = "/tmp/postgres.log";

      console.log("🗄️ Preparing native local PostgreSQL database...");
      
      // Check if postgres cluster is initialized
      if (!fs.existsSync(path.join(pgDataDir, "PG_VERSION"))) {
        console.log("🗄️ Initializing native PostgreSQL database cluster...");
        fs.mkdirSync(pgDataDir, { recursive: true });
        execSync(`initdb -D ${pgDataDir}`, { stdio: "inherit" });
      }

      // Start PostgreSQL on port 5432 and put Unix domain socket in /tmp (writable by node user)
      try {
        // Remove stale PID file if it exists (can happen after ungraceful container restart)
        const pidFile = path.join(pgDataDir, "postmaster.pid");
        if (fs.existsSync(pidFile)) {
          console.log("🧹 Cleaning up stale PostgreSQL PID file from previous run...");
          fs.unlinkSync(pidFile);
        }

        execSync(`pg_ctl -D ${pgDataDir} -l ${pgLogFile} -o "-F -p 5432 -k /tmp" start`, { stdio: "inherit" });
        console.log("🟢 Local PostgreSQL server started on port 5432.");

        // Create database 'gbrain' if not exists, specifying the /tmp socket and user 'node'
        try {
          execSync(`createdb -p 5432 -h /tmp -U node gbrain 2>/dev/null`, { stdio: "ignore" });
        } catch {
          // Database already exists — this is fine
        }
      } catch (pgErr) {
        console.warn("⚠️ PostgreSQL start warning/notice:", pgErr.message);
        if (fs.existsSync(pgLogFile)) {
          console.log("📄 --- PostgreSQL Log Output ---");
          console.log(fs.readFileSync(pgLogFile, "utf8"));
          console.log("--------------------------------");
        }
      }

      if (!fs.existsSync(configPath)) {
        console.log("🗄️ Initializing GBrain knowledge base using native PostgreSQL...");
        execSync("gbrain init --url postgresql://node@localhost:5432/gbrain --no-embedding", { stdio: "inherit" });
      } else {
        // If config exists but engine is pglite, overwrite/re-init to use postgres
        const configStr = fs.readFileSync(configPath, "utf8");
        const configJson = JSON.parse(configStr);
        if (configJson.engine !== "postgres") {
          console.log("🔄 Re-initializing GBrain config to native PostgreSQL...");
          fs.rmSync(configPath, { force: true });
          execSync("gbrain init --url postgresql://node@localhost:5432/gbrain --no-embedding", { stdio: "inherit" });
        }
      }
    }

    // Inject Gemini API Key and embedding model directly into config.json
    // (gbrain v0.42+ rejects `config set embedding_model` via CLI — it's a schema-level field)
    if (fs.existsSync(configPath)) {
      const configStr = fs.readFileSync(configPath, "utf8");
      const configJson = JSON.parse(configStr);
      if (process.env.GEMINI_API_KEY) {
        configJson.google_api_key = process.env.GEMINI_API_KEY;
      }
      configJson.embedding_model = "google:gemini-embedding-2";
      fs.writeFileSync(configPath, JSON.stringify(configJson, null, 2), "utf8");
      console.log("✅ Configured Google API key and embedding model in gbrain config.");
    }

    // Run diagnostics
    console.log("🩺 Running gbrain doctor diagnostics...");
    try {
      execSync("gbrain doctor", { stdio: "inherit" });
    } catch (docErr) {
      console.error("❌ gbrain doctor failed:", docErr.message);
    }

    // Auto-inject project review meeting
    try {
      console.log("🤖 Injecting project status review meeting...");
      execSync("node scripts/inject-meeting-review.mjs", { stdio: "inherit" });
    } catch (injectErr) {
      console.error("❌ Failed to inject project review meeting:", injectErr.message);
    }

    // Auto-inject final review & submission meeting
    try {
      console.log("🤖 Injecting final review & submission meeting...");
      execSync("node scripts/inject-final-review-meeting.mjs", { stdio: "inherit" });
    } catch (injectErr) {
      console.error("❌ Failed to inject final review meeting:", injectErr.message);
    }
  }
} catch (err) {
  console.error("⚠️ Failed to initialize local PostgreSQL/GBrain:", err.message);
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
  
  // Stop local PostgreSQL server gracefully (prevents stale PID files on restart)
  if (isDocker && !process.env.DATABASE_URL) {
    const pgDataDir = path.join(homeDir, ".postgres-data");
    try {
      const { execSync } = await import("child_process");
      execSync(`pg_ctl -D ${pgDataDir} stop -m fast 2>/dev/null || true`, { stdio: "ignore", timeout: 10000 });
      console.log("🐘 PostgreSQL server stopped gracefully.");
    } catch {
      // Best-effort; container is shutting down anyway
    }

  }
  
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
