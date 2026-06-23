import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.mjs";

let genAI = null;
let model = null;

function getModel() {
  if (!model) {
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  }
  return model;
}

/**
 * Generate a response from Gemini with a given prompt.
 * @param {string} prompt - The prompt to send
 * @param {number} timeoutMs - Timeout in milliseconds (default 15000)
 * @returns {Promise<string>} The generated text
 */
export async function generateResponse(prompt, timeoutMs = 15000) {
  const m = getModel();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await m.generateContent(prompt, {
      signal: controller.signal,
    });
    const response = await result.response;
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse user intent from a natural language command.
 * @param {string} message - User's message
 * @returns {Promise<{intent: string, query: string, sender: string|null}>}
 */
export async function parseIntent(message) {
  const prompt = `You are an intent parser for a personal AI email assistant. Analyze the user message and return a JSON object with:
- "intent": one of "search_emails", "summarize_emails", "important_emails", "action_items", "daily_report", "meeting_prep", "search_teams", "search_whatsapp", "general_query", "unknown"
- "query": the search topic or keyword extracted from the message
- "sender": the sender name if mentioned, otherwise null
- "timeframe": "today", "yesterday", "week", "month", or null

User message: "${message}"

Respond ONLY with valid JSON, no markdown fences.`;

  const text = await generateResponse(prompt);

  try {
    // Strip any markdown code fences if present
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { intent: "unknown", query: message, sender: null, timeframe: null };
  }
}

/**
 * Summarize a list of emails.
 * @param {Array} emails - Array of email objects or text
 * @param {string} type - "daily", "important", or "action_items"
 * @returns {Promise<string>}
 */
export async function summarizeEmails(emailsText, type = "daily") {
  const prompts = {
    daily: `Summarize the following emails concisely (max 500 words), organized by category:
1. Action Required
2. Important Communications
3. Informational Messages

Emails:
${emailsText}`,

    important: `From the following emails, identify the most important ones based on urgency indicators (words like "urgent", "deadline", "ASAP", "immediate", "security", "alert"), sender importance, and subject keywords. Rank them by priority and present the top 10.

Emails:
${emailsText}`,

    action_items: `From the following emails, extract all action items, tasks, and things that require follow-up. For each action item provide:
- Task description (max 200 characters)
- Source email subject
- Sender name
- Deadline (if mentioned)

Order by deadline proximity (earliest first). Items without deadlines go at the end.

Emails:
${emailsText}`,
  };

  return generateResponse(prompts[type] || prompts.daily);
}

/**
 * Generate a meeting preparation brief.
 * @param {string} topic - Meeting topic
 * @param {string} context - Gathered context from GBrain
 * @returns {Promise<string>}
 */
export async function generateMeetingBrief(topic, context) {
  const prompt = `Generate a concise meeting preparation brief (max 500 words) for a meeting about: "${topic}"

Based on this context from emails, previous meetings, and messages:
${context}

Structure the brief with these sections:
## Prior Discussion Points
## Unresolved Action Items
## Recent Emails
## Suggested Talking Points (3-5 points)

If limited context is available, note that and present what exists.`;

  return generateResponse(prompt);
}

/**
 * Generate a daily productivity report.
 * @param {string} emailsContext - Today's emails
 * @param {string} tasksContext - Pending tasks
 * @returns {Promise<string>}
 */
export async function generateDailyReport(emailsContext, tasksContext) {
  const prompt = `Generate a structured daily productivity report with these sections:

## 📧 Email Highlights
(Up to 10 most important emails from today, selected by urgency and sender importance)

## ✅ Pending Action Items
(Up to 10 items ordered by deadline proximity)

## 🎯 Suggested Priorities
(Up to 5 priorities ranked by urgency)

Today's emails:
${emailsContext}

Pending tasks context:
${tasksContext}

Keep it concise and actionable.`;

  return generateResponse(prompt);
}
