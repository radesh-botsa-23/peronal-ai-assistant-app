import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

// Always resolve credentials from the project root, regardless of cwd
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CREDENTIALS_PATH = path.join(PROJECT_ROOT, "credentials.json");
const TOKEN_PATH = path.join(PROJECT_ROOT, "token.json");

/**
 * Google Calendar Client
 * Uses the same OAuth credentials as Gmail.
 * Requires 'https://www.googleapis.com/auth/calendar.readonly' scope.
 */

function createCalendarClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));

  const { client_id, client_secret } = credentials.installed;
  const auth = new google.auth.OAuth2(client_id, client_secret, "http://localhost");
  auth.setCredentials(token);

  return google.calendar({ version: "v3", auth });
}

/**
 * Get today's events from Google Calendar.
 * @returns {Promise<Array>} Array of event objects
 */
export async function getTodaysEvents() {
  const calendar = createCalendarClient();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 20,
  });

  return (res.data.items || []).map((event) => ({
    id: event.id,
    title: event.summary || "No title",
    start: event.start?.dateTime || event.start?.date || "",
    end: event.end?.dateTime || event.end?.date || "",
    location: event.location || "",
    description: event.description || "",
    attendees: (event.attendees || []).map((a) => a.email).join(", "),
    organizer: event.organizer?.email || "",
    meetLink: event.hangoutLink || "",
  }));
}

/**
 * Get upcoming events for the next N hours.
 * @param {number} hours - How many hours ahead to look
 * @returns {Promise<Array>}
 */
export async function getUpcomingEvents(hours = 24) {
  const calendar = createCalendarClient();

  const now = new Date();
  const future = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 20,
  });

  return (res.data.items || []).map((event) => ({
    id: event.id,
    title: event.summary || "No title",
    start: event.start?.dateTime || event.start?.date || "",
    end: event.end?.dateTime || event.end?.date || "",
    location: event.location || "",
    description: event.description || "",
    attendees: (event.attendees || []).map((a) => a.email).join(", "),
    organizer: event.organizer?.email || "",
    meetLink: event.hangoutLink || "",
  }));
}

/**
 * Get events for a specific date.
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Promise<Array>}
 */
export async function getEventsForDate(dateStr) {
  const calendar = createCalendarClient();

  const start = new Date(dateStr);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 20,
  });

  return (res.data.items || []).map((event) => ({
    id: event.id,
    title: event.summary || "No title",
    start: event.start?.dateTime || event.start?.date || "",
    end: event.end?.dateTime || event.end?.date || "",
    attendees: (event.attendees || []).map((a) => a.email).join(", "),
    organizer: event.organizer?.email || "",
  }));
}

/**
 * Format events into readable text.
 * @param {Array} events
 * @returns {string}
 */
export function formatEvents(events) {
  if (events.length === 0) return "No meetings scheduled.";

  return events.map((e, i) => {
    const time = e.start ? new Date(e.start).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "All day";
    const attendeeCount = e.attendees ? e.attendees.split(",").filter(Boolean).length : 0;
    return `${i + 1}. **${e.title}** — ${time}${attendeeCount > 0 ? ` (${attendeeCount} attendees)` : ""}${e.meetLink ? " 📹" : ""}`;
  }).join("\n");
}
