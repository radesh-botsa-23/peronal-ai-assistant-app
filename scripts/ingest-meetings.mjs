#!/usr/bin/env node
/**
 * Ingest meeting transcripts from Fireflies.ai into GBrain.
 * Stores meeting summaries, participants, action items, and topics.
 *
 * Usage: node scripts/ingest-meetings.mjs
 * Schedule: Run every 30 minutes via cron alongside email ingestion.
 */

import { ingestMeetings } from "../agents/meetings-agent.mjs";

console.log(`[${new Date().toISOString()}] Starting Fireflies meeting ingestion...`);

try {
  const { stored, skipped, failed } = await ingestMeetings(20);

  console.log(
    `Meeting ingestion complete:\n` +
    `  Stored: ${stored}\n` +
    `  Skipped (duplicates): ${skipped}\n` +
    `  Failed: ${failed}`
  );
} catch (err) {
  console.error("Meeting ingestion failed:", err.message);
  if (err.message.includes("401") || err.message.includes("Unauthorized")) {
    console.error("Check your FIREFLIES_API_KEY in config.");
  }
  process.exit(1);
}
