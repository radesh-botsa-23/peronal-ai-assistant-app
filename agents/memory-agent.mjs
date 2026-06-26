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
  let rawResults = "";
  try {
    rawResults = queryGBrain(query);
  } catch (err) {
    console.error("GBrain query failed:", err.message);
  }

  const prompt = `You are a helpful personal AI assistant. Answer the user's query or message.
We searched the user's personal knowledge base (emails, meetings, messages) for: "${query}".
Here are the search results:
---
${rawResults && rawResults.trim().length > 0 ? rawResults : "(No matching records found in database)"}
---

Instructions:
1. If the search results contain relevant information to answer the query, use them to formulate a complete, helpful, and structured response. Cite sources (e.g., email subject, sender, date) when appropriate.
2. If the query is a general question (e.g., "who are you?", "hello", general trivia, or general help) and the database results are empty/irrelevant, answer the query directly and politely as a personal assistant.
3. If the user is specifically looking for information that is not in the database and not in general knowledge, let them know you couldn't find it in their emails, messages, or meetings, and suggest what they could search for instead.

User query/message: "${query}"`;

  try {
    return await generateResponse(prompt);
  } catch (err) {
    return rawResults || "I tried to search my memory but encountered an error. Please try again.";
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
