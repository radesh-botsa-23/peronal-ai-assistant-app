#!/usr/bin/env node
/**
 * Ingest emails from Gmail and store them in:
 * 1. OpenClaw's memory directory (markdown files for agent context)
 * 2. GBrain (vector-indexed semantic search)
 *
 * Usage: node scripts/ingest-emails-to-memory.mjs
 */

import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { execSync } from "child_process";
import os from "os";

const GBRAIN_PATH = "/home/radesh/.bun/bin/gbrain";
const BUN_PATH = "/home/radesh/.bun/bin";

// Paths
const CREDENTIALS_PATH = path.resolve("credentials.json");
const TOKEN_PATH = path.resolve("token.json");
const MEMORY_DIR = path.join(os.homedir(), ".openclaw", "workspace", "memory");
const DATA_DIR = path.resolve("data", "messages");

// Ensure directories exist
fs.mkdirSync(MEMORY_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// Auth
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
const { client_id, client_secret } = credentials.installed;
const auth = new google.auth.OAuth2(client_id, client_secret, "http://localhost");
auth.setCredentials(token);

const gmail = google.gmail({ version: "v1", auth });

const MAX_EMAILS = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEmails(retryCount = 0) {
  try {
    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: MAX_EMAILS,
    });
    return list.data.messages || [];
  } catch (err) {
    if (
      retryCount < MAX_RETRIES &&
      (err.code === 401 || err.code === 403 || err.message?.includes("auth"))
    ) {
      console.log(`Auth error, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY_MS);
      return fetchEmails(retryCount + 1);
    }
    throw err;
  }
}

async function getEmailDetails(messageId) {
  const details = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
  });

  const headers = details.data.payload.headers || [];
  return {
    id: messageId,
    from: headers.find((h) => h.name === "From")?.value || "",
    subject: headers.find((h) => h.name === "Subject")?.value || "",
    date: headers.find((h) => h.name === "Date")?.value || "",
    snippet: details.data.snippet || "",
  };
}

function emailMemoryPath(messageId) {
  return path.join(MEMORY_DIR, `email-${messageId}.md`);
}

function emailAlreadyStored(messageId) {
  return fs.existsSync(emailMemoryPath(messageId));
}

function storeEmailToMemory(email) {
  const content = `# Email: ${email.subject}

**From:** ${email.from}
**Date:** ${email.date}
**Subject:** ${email.subject}

## Content

${email.snippet}

---
_Source: Gmail | ID: ${email.id}_
`;

  fs.writeFileSync(emailMemoryPath(email.id), content);
}

// Main
console.log(`[${new Date().toISOString()}] Starting email ingestion to OpenClaw memory...`);

try {
  const messages = await fetchEmails();
  console.log(`Found ${messages.length} messages in Gmail.`);

  let stored = 0;
  let skipped = 0;
  let failed = 0;
  const allEmails = [];

  for (const msg of messages) {
    if (emailAlreadyStored(msg.id)) {
      skipped++;
      continue;
    }

    try {
      const email = await getEmailDetails(msg.id);
      storeEmailToMemory(email);
      allEmails.push(email);
      stored++;
    } catch (err) {
      console.error(`Failed to process email ${msg.id}:`, err.message);
      failed++;
    }
  }

  // Save local backup JSON
  const today = new Date().toISOString().split("T")[0];
  if (allEmails.length > 0) {
    const existing = fs.existsSync(`${DATA_DIR}/${today}.json`)
      ? JSON.parse(fs.readFileSync(`${DATA_DIR}/${today}.json`, "utf8"))
      : [];
    const merged = [...existing, ...allEmails];
    fs.writeFileSync(`${DATA_DIR}/${today}.json`, JSON.stringify(merged, null, 2));
  }

  console.log(
    `Ingestion complete:\n` +
    `  OpenClaw Memory: ${stored} new, ${skipped} skipped\n` +
    `  Failed: ${failed}`
  );

  // Trigger GBrain sync for all memory emails
  console.log("Syncing to GBrain...");
  try {
    execSync(`bash /mnt/c/Users/botsa/email-collector/scripts/sync-to-gbrain.sh`, {
      stdio: "inherit",
      timeout: 120000,
      env: { ...process.env, PATH: `${BUN_PATH}:/usr/bin:/bin:${process.env.PATH || ""}` },
    });
  } catch (err) {
    console.warn("GBrain sync failed:", err.message);
  }
} catch (err) {
  console.error("Ingestion failed:", err.message);
  if (err.message?.includes("auth") || err.code === 401) {
    console.error("Authentication failed after all retry attempts. Run: node gmail-auth.mjs");
  }
  process.exit(1);
}
