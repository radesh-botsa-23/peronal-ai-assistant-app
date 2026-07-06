import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { fetchEmails } from "./lib/gmail-client.mjs";
import { storeEmail, storeCalendarEvent } from "./lib/gbrain-client.mjs";
import { getTodaysEvents, getUpcomingEvents } from "./lib/calendar-client.mjs";
import { config } from "./config.mjs";
import { hasAlertBeenSent, markAlertAsSent, setSessionState } from "./lib/session-state.mjs";



const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Email & Calendar Ingestion Pipeline
 * Fetches emails from Gmail (with full body) and calendar events, stores them in GBrain.
 * Also saves a local JSON backup of emails.
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

  // Generate and send email digest (30mins summary)
  try {
    console.log(`[${new Date().toISOString()}] Generating 30-minute email digest...`);
    execSync("node digest.mjs", { cwd: __dirname, stdio: "inherit" });
    
    console.log(`[${new Date().toISOString()}] Sending 30-minute email digest to Discord...`);
    execSync("node send-discord.mjs", { cwd: __dirname, stdio: "inherit" });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to generate or send 30-minute email digest:`, err.message);
  }
}

/**
 * Calendar Ingestion
 * Fetches today's + upcoming 48h calendar events and stores them in GBrain.
 */
async function runCalendarIngestion() {
  console.log(`[${new Date().toISOString()}] Starting calendar ingestion...`);

  let events = [];
  try {
    const todayEvents = await getTodaysEvents();
    const upcomingEvents = await getUpcomingEvents(48);

    // Merge and deduplicate by event ID
    const seen = new Set();
    for (const e of [...todayEvents, ...upcomingEvents]) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        events.push(e);
      }
    }
  } catch (err) {
    if (err.message?.includes("auth") || err.code === 401) {
      console.error("Calendar auth error:", err.message);
    } else {
      console.error("Calendar fetch error:", err.message);
    }
    return;
  }

  console.log(`Fetched ${events.length} calendar events.`);

  let stored = 0;
  let skipped = 0;

  for (const event of events) {
    try {
      const wasStored = storeCalendarEvent(event);
      if (wasStored) stored++;
      else skipped++;
    } catch (err) {
      console.error(`Failed to store calendar event ${event.id}:`, err.message);
    }
  }

  console.log(`Calendar: ${stored} stored, ${skipped} skipped (duplicates).`);

  // Check for upcoming meetings starting in the next 60 minutes
  try {
    await checkForUpcomingMeetings(events);
  } catch (err) {
    console.error("Error checking for upcoming meetings:", err.message);
  }
}

/**
 * Check for meetings starting soon and send an alert if not already sent.
 * @param {Array} events - Calendar events list
 */
async function checkForUpcomingMeetings(events) {
  const now = new Date();
  const CHANNEL_ID = config.discord.channelId || "1516680999772094617";
  const token = config.discord.token;

  for (const event of events) {
    if (!event.start) continue;

    const start = new Date(event.start);
    const diffMs = start.getTime() - now.getTime();
    const diffMins = diffMs / (60 * 1000);

    // Alert if starting in the next 60 minutes (and not in the past)
    if (diffMins > 0 && diffMins <= 60) {
      if (!hasAlertBeenSent(event.id)) {
        console.log(`[Meeting Alert] "${event.title}" is starting in ${Math.round(diffMins)} minutes.`);
        
        // Prevent duplicate alerts
        markAlertAsSent(event.id);

        // Set prompt confirmation state
        setSessionState({
          activePrompt: {
            type: "meeting_prep_confirm",
            target: event.title,
            timestamp: Date.now()
          }
        });

        // Format and send alert
        const startTimeStr = start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        const alertMessage = `⏰ **Upcoming Meeting Alert:** "${event.title}" is starting in ${Math.round(diffMins)} minutes (at ${startTimeStr}).\n` +
          `Would you like me to prepare a meeting brief for you?`;

        try {
          if (token) {
            await sendDiscordAlert(CHANNEL_ID, alertMessage);
            console.log(`[Meeting Alert] Alert sent successfully for "${event.title}".`);
          } else {
            console.warn("[Meeting Alert] Discord token not configured. Cannot send alert.");
          }
        } catch (err) {
          console.error(`[Meeting Alert] Failed to send Discord alert for "${event.title}":`, err.message);
        }
      }
    }
  }
}

/**
 * Send alert message via Discord API.
 */
async function sendDiscordAlert(channelId, text) {
  const token = config.discord.token;
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Discord API error (${res.status}): ${errText}`);
  }
}

// Run immediately on start
await runIngestion();
await runCalendarIngestion();

// Schedule recurring runs
const intervalMs = config.ingestion.intervalMinutes * 60 * 1000;
console.log(`Scheduling ingestion every ${config.ingestion.intervalMinutes} minutes.`);
setInterval(async () => {
  await runIngestion();
  await runCalendarIngestion();
}, intervalMs);

// Schedule daily productivity report (automated at dailyReport hour & minute)
let lastReportDate = "";
console.log(`Scheduling daily report to check every minute for target time ${config.dailyReport.hour}:${config.dailyReport.minute.toString().padStart(2, '0')}.`);
setInterval(async () => {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0]; // "YYYY-MM-DD"
  
  if (
    now.getHours() === config.dailyReport.hour &&
    now.getMinutes() === config.dailyReport.minute &&
    lastReportDate !== todayStr
  ) {
    lastReportDate = todayStr;
    console.log(`[${now.toISOString()}] Triggering scheduled daily report...`);
    try {
      execSync("node scripts/daily-report-cron.mjs", { cwd: __dirname, stdio: "inherit" });
    } catch (err) {
      console.error(`[${now.toISOString()}] Failed to run daily report:`, err.message);
    }
  }
}, 60000); // Check every minute
