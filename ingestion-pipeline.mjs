import fs from "fs";
import { fetchEmails } from "./lib/gmail-client.mjs";
import { storeEmail } from "./lib/gbrain-client.mjs";
import { config } from "./config.mjs";

/**
 * Email Ingestion Pipeline
 * Fetches emails from Gmail and stores them in GBrain with semantic embeddings.
 * Runs on a configurable schedule (default: every 30 minutes).
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runIngestion() {
  console.log(`[${new Date().toISOString()}] Starting email ingestion...`);

  let emails;
  let retries = 0;

  // Fetch emails with retry logic for auth errors
  while (retries < MAX_RETRIES) {
    try {
      emails = await fetchEmails(config.ingestion.maxEmails);
      break;
    } catch (err) {
      if (err.message?.includes("auth") || err.code === 401 || err.code === 403) {
        retries++;
        console.error(
          `Authentication error (attempt ${retries}/${MAX_RETRIES}):`,
          err.message
        );
        if (retries < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
        }
      } else {
        console.error("Gmail fetch error:", err.message);
        return;
      }
    }
  }

  if (!emails) {
    console.error("Authentication failed after all retry attempts. Aborting ingestion.");
    return;
  }

  console.log(`Fetched ${emails.length} emails from Gmail.`);

  // Store each email in GBrain
  let stored = 0;
  let skipped = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      const wasStored = storeEmail(email);
      if (wasStored) {
        stored++;
      } else {
        skipped++; // Duplicate
      }
    } catch (err) {
      console.error(`Failed to store email ${email.id}:`, err.message);
      failed++;
    }
  }

  console.log(
    `Ingestion complete: ${stored} stored, ${skipped} skipped (duplicates), ${failed} failed.`
  );

  // Also save to local JSON for backup
  const today = new Date().toISOString().split("T")[0];
  fs.mkdirSync("./data/messages", { recursive: true });
  fs.writeFileSync(
    `./data/messages/${today}.json`,
    JSON.stringify(emails, null, 2)
  );
}

// Run immediately
await runIngestion();

// Schedule recurring runs
const intervalMs = config.ingestion.intervalMinutes * 60 * 1000;
console.log(
  `Scheduling ingestion every ${config.ingestion.intervalMinutes} minutes.`
);

setInterval(runIngestion, intervalMs);
