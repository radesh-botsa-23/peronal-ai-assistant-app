import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchEmails } from "./lib/gmail-client.mjs";
import { storeEmail } from "./lib/gbrain-client.mjs";
import { config } from "./config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Email Ingestion Pipeline
 * Fetches emails from Gmail (with full body) and stores them in GBrain.
 * Also saves a local JSON backup.
 * Runs on a configurable schedule (default: every 30 minutes).
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runIngestion() {
  console.log(`[${new Date().toISOString()}] Starting email ingestion...`);

  let emails;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      emails = await fetchEmails(config.ingestion.maxEmails);
      break;
    } catch (err) {
      if (err.message?.includes("auth") || err.code === 401 || err.code === 403) {
        retries++;
        console.error(`Auth error (attempt ${retries}/${MAX_RETRIES}):`, err.message);
        if (retries < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
      } else {
        console.error("Gmail fetch error:", err.message);
        return;
      }
    }
  }

  if (!emails) {
    console.error("Auth failed after all retries. Run: node gmail-auth.mjs");
    return;
  }

  console.log(`Fetched ${emails.length} emails from Gmail.`);

  let stored = 0;
  let skipped = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      const wasStored = storeEmail(email);
      if (wasStored) stored++;
      else skipped++;
    } catch (err) {
      console.error(`Failed to store email ${email.id}:`, err.message);
      failed++;
    }
  }

  console.log(`Done: ${stored} stored, ${skipped} skipped (duplicates), ${failed} failed.`);

  // Local JSON backup
  const today = new Date().toISOString().split("T")[0];
  const dataDir = path.join(__dirname, "data", "messages");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, `${today}.json`), JSON.stringify(emails, null, 2));
}

// Run immediately on start
await runIngestion();

// Schedule recurring runs
const intervalMs = config.ingestion.intervalMinutes * 60 * 1000;
console.log(`Scheduling ingestion every ${config.ingestion.intervalMinutes} minutes.`);
setInterval(runIngestion, intervalMs);
