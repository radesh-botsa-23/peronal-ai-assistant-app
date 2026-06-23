import { queryGBrain } from "../lib/gbrain-client.mjs";
import { summarizeEmails } from "../lib/gemini-client.mjs";

/**
 * Email Agent - Searches email memory, filters relevant emails, extracts action items.
 */

/**
 * Search emails by topic using semantic search.
 * @param {string} query - Search query
 * @param {string|null} sender - Optional sender filter
 * @returns {Promise<string>} Formatted results
 */
export async function searchEmails(query, sender = null) {
  let searchQuery = query;
  if (sender) {
    searchQuery = `from ${sender} ${query}`;
  }

  const rawResults = queryGBrain(searchQuery);

  if (!rawResults || rawResults.trim().length === 0) {
    return "No relevant emails found. Try broadening your search terms.";
  }

  // Filter by sender if specified
  if (sender) {
    const lines = rawResults.split("\n");
    const filtered = lines.filter(
      (line) => line.toLowerCase().includes(sender.toLowerCase())
    );
    if (filtered.length === 0) {
      return `No emails found from "${sender}". Try a different sender name.`;
    }
    return formatSearchResults(filtered.join("\n"));
  }

  return formatSearchResults(rawResults);
}

/**
 * Get today's emails for summarization.
 * @returns {Promise<string>} Summarized emails
 */
export async function summarizeTodaysEmails() {
  const today = new Date().toISOString().split("T")[0];
  const rawResults = queryGBrain(`emails from ${today}`);

  if (!rawResults || rawResults.trim().length === 0) {
    return `No emails found for ${today}.`;
  }

  try {
    const summary = await summarizeEmails(rawResults, "daily");
    return summary;
  } catch (err) {
    return "Summarization is temporarily unavailable. Please try again.";
  }
}

/**
 * Get important emails ranked by priority.
 * @returns {Promise<string>}
 */
export async function getImportantEmails() {
  const rawResults = queryGBrain("urgent important deadline ASAP security alert action required");

  if (!rawResults || rawResults.trim().length === 0) {
    return "No important emails found in recent messages.";
  }

  try {
    const summary = await summarizeEmails(rawResults, "important");
    return summary;
  } catch (err) {
    return "Summarization is temporarily unavailable. Please try again.";
  }
}

/**
 * Extract action items from recent emails.
 * @returns {Promise<string>}
 */
export async function extractActionItems() {
  const rawResults = queryGBrain("action required please do deadline follow up task");

  if (!rawResults || rawResults.trim().length === 0) {
    return "No pending action items detected in recent emails. Try expanding your search range.";
  }

  try {
    const summary = await summarizeEmails(rawResults, "action_items");
    return summary;
  } catch (err) {
    return "Action item extraction is temporarily unavailable. Please try again.";
  }
}

/**
 * Format raw GBrain results into a readable format.
 */
function formatSearchResults(raw) {
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length === 0) return "No results found.";

  // Limit snippet length to 150 chars
  const formatted = lines.slice(0, 10).map((line, i) => {
    const truncated = line.length > 150 ? line.substring(0, 147) + "..." : line;
    return `${i + 1}. ${truncated}`;
  });

  return formatted.join("\n");
}
