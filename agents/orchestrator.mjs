import { parseIntent } from "../lib/gemini-client.mjs";
import { searchEmails, summarizeTodaysEmails, getImportantEmails, extractActionItems } from "./email-agent.mjs";
import { crossSourceSearch, prepareMeetingBrief as memoryMeetingBrief } from "./memory-agent.mjs";
import { getDailyReport } from "./summary-agent.mjs";
import { getTodaysMeetings, getUpcomingMeetings, prepareMeetingBrief } from "./calendar-agent.mjs";
import { searchWhatsAppMessages, summarizeWhatsAppChat } from "./whatsapp-agent.mjs";
import { getRecentMeetings, searchMeetings, prepareMeetingWithContext, getTodaysMeetingSummaries } from "./meetings-agent.mjs";

/**
 * GStack Orchestrator - Routes requests to the appropriate specialized agent
 * based on intent classification.
 */

/**
 * Process a user message through the orchestration pipeline.
 * @param {string} message - The user's natural language command
 * @returns {Promise<string>} The formatted response
 */
export async function processCommand(message) {
  try {
    // Step 1: Parse intent using Gemini
    const { intent, query, sender, timeframe } = await parseIntent(message);

    // Step 2: Route to appropriate agent
    switch (intent) {
      case "search_emails":
        return await searchEmails(query, sender);

      case "summarize_emails":
        return await summarizeTodaysEmails();

      case "important_emails":
        return await getImportantEmails();

      case "action_items":
        return await extractActionItems();

      case "daily_report":
        return await getDailyReport();

      case "meeting_prep":
        return await prepareMeetingWithContext(query);

      case "todays_meetings":
        return await getTodaysMeetings();

      case "upcoming_meetings":
        return await getUpcomingMeetings();

      case "search_teams":
        return await searchMeetings(query);

      case "meeting_summary":
        return await getTodaysMeetingSummaries();

      case "recent_meetings":
        return await getRecentMeetings();

      case "search_whatsapp":
        return await searchWhatsAppMessages(query);

      case "summarize_whatsapp":
        return await summarizeWhatsAppChat(query);

      case "general_query":
        return await crossSourceSearch(query);

      case "unknown":
      default:
        return `I'm not sure what you're asking. I can help with:\n` +
          `• **Search emails** - "search emails about [topic]"\n` +
          `• **Summarize emails** - "summarize today's emails"\n` +
          `• **Important emails** - "show important emails"\n` +
          `• **Action items** - "show pending action items"\n` +
          `• **Daily report** - "give me my daily report"\n` +
          `• **Today's meetings** - "what meetings do I have today"\n` +
          `• **Meeting prep** - "prepare me for [meeting topic]"\n` +
          `• **General search** - "what do I know about [topic]"`;
    }
  } catch (err) {
    console.error("Orchestrator error:", err);
    return "Something went wrong processing your request. Please try again.";
  }
}
