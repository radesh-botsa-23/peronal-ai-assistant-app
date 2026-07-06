import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.mjs";

let genAI = null;
let model = null;

function getModel() {
  if (!model) {
    if (!config.gemini.apiKey) {
      throw new Error("GEMINI_API_KEY is not set. Add it to your .env file.");
    }
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
  }
  return model;
}

/**
 * Call model.generateContent with a timeout and retry mechanism for transient errors.
 * @param {object} model - The Gemini model instance
 * @param {any} contents - Prompt or array of prompt parts/inlineData
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} The GenerateContentResult
 */
export async function generateContentWithRetry(model, contents, timeoutMs = 30000, maxRetries = 3) {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Gemini request timed out")), timeoutMs)
      );

      const requestPromise = model.generateContent(contents);

      return await Promise.race([requestPromise, timeoutPromise]);
    } catch (err) {
      const isTransient = 
        err.message?.includes("503") || 
        err.message?.includes("429") || 
        err.message?.includes("timed out") ||
        err.message?.includes("high demand") ||
        err.message?.includes("Service Unavailable") ||
        err.message?.includes("Too Many Requests");

      if (isTransient && attempt <= maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️ Gemini request failed (attempt ${attempt}/${maxRetries}): ${err.message}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Generate a response from Gemini with a given prompt.
 * Uses Promise.race for reliable timeout (AbortController not supported by SDK).
 * @param {string} prompt
 * @param {number} timeoutMs - default 30000ms
 * @returns {Promise<string>}
 */
export async function generateResponse(prompt, timeoutMs = 30000) {
  const m = getModel();
  const result = await generateContentWithRetry(m, prompt, timeoutMs);
  return result.response.text();
}

/**
 * Parse user intent from a natural language command.
 * @param {string} message - User's message
 * @returns {Promise<{intent: string, query: string, sender: string|null, timeframe: string|null}>}
 */
export async function parseIntent(message) {
  const prompt = `You are an intent parser for a personal AI email assistant. Analyze the user message and return a JSON object with:
- "intent": one of "search_emails", "summarize_emails", "important_emails", "action_items", "daily_report", "meeting_prep", "todays_meetings", "upcoming_meetings", "meeting_summary", "recent_meetings", "search_teams", "search_whatsapp", "summarize_whatsapp", "general_query", "unknown"
- "query": the search topic or keyword extracted from the message
- "sender": the sender name if mentioned, otherwise null
- "timeframe": "today", "yesterday", "week", "month", or null

Intent guidelines:
- "search_emails" = user wants to search/find emails about a topic or from a sender
- "todays_meetings" = user asks about today's calendar/meetings/schedule
- "upcoming_meetings" = user asks about upcoming/next meetings
- "meeting_prep" = user wants preparation for a specific meeting with context from previous meetings
- "meeting_summary" = user asks for summary of today's meetings/what was discussed
- "recent_meetings" = user asks to see recent meeting transcripts
- "search_teams" = user searches for specific meeting content or topic
- "daily_report" = user wants a full daily productivity overview
- "search_whatsapp" = user asks to search WhatsApp messages
- "summarize_whatsapp" = user asks to summarize WhatsApp chats
- "general_query" = any general question, query, search, greeting, or command that doesn't fit specific categories

User message: "${message}"

Respond ONLY with valid JSON, no markdown fences.`;

  try {
    const text = await generateResponse(prompt);
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { intent: "unknown", query: message, sender: null, timeframe: null };
  }
}

/**
 * Summarize emails by type: "daily", "important", or "action_items".
 * @param {string} emailsText
 * @param {string} type
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
 * @param {string} topic
 * @param {string} context
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
 * Generate a daily productivity report including calendar, emails, and tasks.
 * @param {string} emailsContext
 * @param {string} tasksContext
 * @param {string} calendarContext
 * @returns {Promise<string>}
 */
export async function generateDailyReport(emailsContext, tasksContext, calendarContext = "") {
  const prompt = `Generate a structured daily productivity report with these sections:

## 📅 Today's Meetings
${calendarContext || "(No meetings scheduled)"}

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
