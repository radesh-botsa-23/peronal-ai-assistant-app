import { queryGBrain } from "../lib/gbrain-client.mjs";
import { generateDailyReport } from "../lib/gemini-client.mjs";
import { getTodaysEvents, formatEvents } from "../lib/calendar-client.mjs";

/**
 * Summary Agent - Generates concise summaries, meeting briefs, and daily reports.
 */

/**
 * Generate a daily productivity report.
 * @returns {Promise<string>}
 */
export async function getDailyReport() {
  // Gather today's emails
  const today = new Date().toISOString().split("T")[0];
  const emailsContext = queryGBrain(`emails ${today}`);

  // Gather pending tasks
  const tasksContext = queryGBrain("action required deadline task pending follow up");

  // Gather today's calendar
  let calendarContext = "";
  try {
    const events = await getTodaysEvents();
    calendarContext = events.length > 0 ? formatEvents(events) : "No meetings scheduled.";
  } catch {
    calendarContext = "Calendar unavailable.";
  }

  if (
    (!emailsContext || emailsContext.trim().length === 0) &&
    (!tasksContext || tasksContext.trim().length === 0) &&
    calendarContext === "No meetings scheduled."
  ) {
    return `No data available for today's report. Emails and tasks will appear once the ingestion pipeline runs.`;
  }

  try {
    const report = await generateDailyReport(
      emailsContext || "No emails found for today.",
      tasksContext || "No pending tasks found.",
      calendarContext
    );
    return `# 📋 Daily Productivity Report - ${today}\n\n${report}`;
  } catch {
    return "Daily productivity report generation is temporarily unavailable. Please try again.";
  }
}
