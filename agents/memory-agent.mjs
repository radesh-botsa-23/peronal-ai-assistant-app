import { queryGBrain } from "../lib/gbrain-client.mjs";
import { generateResponse, generateMeetingBrief } from "../lib/gemini-client.mjs";

/**
 * Memory Agent - Searches GBrain across all data sources, retrieves contextual information.
 */

/**
 * Cross-source search across all stored data.
 * @param {string} query - Natural language query
 * @returns {Promise<string>}
 */
export async function crossSourceSearch(query) {
  const rawResults = queryGBrain(query);

  if (!rawResults || rawResults.trim().length === 0) {
    return "No relevant information found across any source. Try refining your query with more specific terms.";
  }

  // Use Gemini to organize results by source
  const prompt = `Organize and summarize the following search results (max 500 words). Group by source type if identifiable (emails, Teams, WhatsApp). Include source attribution and date for each item. Present a unified summary.

Search query: "${query}"

Results:
${rawResults}`;

  try {
    return await generateResponse(prompt);
  } catch {
    return rawResults;
  }
}

/**
 * Prepare a meeting brief by gathering context from all sources.
 * @param {string} topic - Meeting topic
 * @returns {Promise<string>}
 */
export async function prepareMeetingBrief(topic) {
  // Search for related content across sources
  const emailContext = queryGBrain(`${topic} email`);
  const meetingContext = queryGBrain(`${topic} meeting discussion`);
  const actionContext = queryGBrain(`${topic} action item task`);

  const combinedContext = [
    emailContext ? `## Emails\n${emailContext}` : "",
    meetingContext ? `## Previous Meetings\n${meetingContext}` : "",
    actionContext ? `## Action Items\n${actionContext}` : "",
  ]
    .filter((s) => s.length > 0)
    .join("\n\n");

  if (!combinedContext || combinedContext.trim().length < 20) {
    return `Limited prior context available for "${topic}". No substantial related information was found in stored emails, meetings, or messages.`;
  }

  try {
    return await generateMeetingBrief(topic, combinedContext);
  } catch {
    return `Meeting brief generation is temporarily unavailable. Here's the raw context found:\n\n${combinedContext}`;
  }
}
