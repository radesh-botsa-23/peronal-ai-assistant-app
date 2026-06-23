import { queryGBrain } from "../lib/gbrain-client.mjs";
import { generateDailyReport } from "../lib/gemini-client.mjs";

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

  if (
    (!emailsContext || emailsContext.trim().length === 0) &&
    (!tasksContext || tasksContext.trim().length === 0)
  ) {
    return `No data available for today's report. Emails and tasks will appear once the ingestion pipeline runs.`;
  }

  try {
    const report = await generateDailyReport(
      emailsContext || "No emails found for today.",
      tasksContext || "No pending tasks found."
    );
    return `# 📋 Daily Productivity Report - ${today}\n\n${report}`;
  } catch {
    // Fallback to basic format
    let fallback = `# 📋 Daily Report - ${today}\n\n`;
    if (emailsContext) fallback += `## Emails\n${emailsContext}\n\n`;
    if (tasksContext) fallback += `## Tasks\n${tasksContext}\n\n`;
    return fallback;
  }
}
