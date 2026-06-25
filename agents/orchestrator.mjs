import { parseIntent } from "../lib/gemini-client.mjs";
import { searchEmails, summarizeTodaysEmails, getImportantEmails, extractActionItems } from "./email-agent.mjs";
import { crossSourceSearch } from "./memory-agent.mjs";
import { getDailyReport } from "./summary-agent.mjs";
import { getTodaysMeetings, getUpcomingMeetings } from "./calendar-agent.mjs";
import { searchWhatsAppMessages, summarizeWhatsAppChat } from "./whatsapp-agent.mjs";
import { searchMeetings, getTodaysMeetingSummaries } from "./meetings-agent.mjs";
import { prepareForMeeting, getStoredMeetings } from "./meeting-processor.mjs";

/**
 * GStack Orchestrator - Routes user requests to the appropriate specialized agent.
 *
 * Intent → Agent mapping:
 *   search_emails       → Email Agent (GBrain search)
 *   summarize_emails    → Email Agent → Gemini summary
 *   important_emails    → Email Agent → Gemini priority ranking
 *   action_items        → Email Agent → Gemini task extraction
 *   daily_report        → Summary Agent (emails + calendar + tasks)
 *   meeting_prep        → Meeting Processor (previous meetings + emails context)
 *   todays_meetings     → Calendar Agent
 *   upcoming_meetings   → Calendar Agent
 *   meeting_summary     → Meetings Agent (Fireflies / GBrain)
 *   recent_meetings     → Meeting Processor (GBrain stored meetings)
 *   search_teams        → Meetings Agent (GBrain search)
 *   search_whatsapp     → WhatsApp Agent
 *   summarize_whatsapp  → WhatsApp Agent
 *   general_query       → Memory Agent (cross-source GBrain search)
 */
export async function processCommand(message) {
  try {
    // Step 1: Parse intent
    const { intent, query, sender } = await parseIntent(message);

    // Step 2: Route to agent
    switch (intent) {
      case "search_emails":
        return await searchEmails(query || message, sender);

      case "summarize_emails":
        return await summarizeTodaysEmails();

      case "important_emails":
        return await getImportantEmails();

      case "action_items":
        return await extractActionItems();

      case "daily_report":
        return await getDailyReport();

      case "meeting_prep":
        return await prepareForMeeting(query || message);

      case "todays_meetings":
        return await getTodaysMeetings();

      case "upcoming_meetings":
        return await getUpcomingMeetings();

      case "meeting_summary":
        return await getTodaysMeetingSummaries();

      case "recent_meetings":
        return await getStoredMeetings();

      case "search_teams":
        return await searchMeetings(query || message);

      case "search_whatsapp":
        return await searchWhatsAppMessages(query || message);

      case "summarize_whatsapp":
        return await summarizeWhatsAppChat(query || message);

      case "general_query":
        return await crossSourceSearch(query || message);

      case "unknown":
      default:
        return [
          "I'm not sure what you're asking. Here's what I can help with:",
          "",
          "📧 **Emails**",
          "• `search emails about [topic]` — semantic search",
          "• `search emails from [sender]` — filter by sender",
          "• `summarize today's emails` — AI summary",
          "• `show important emails` — priority ranked",
          "• `show pending action items` — extract tasks",
          "",
          "📅 **Calendar & Meetings**",
          "• `what meetings do I have today`",
          "• `upcoming meetings`",
          "• `prepare me for [meeting/person]` — brief with past context",
          "• `show recent meetings` — stored meeting summaries",
          "",
          "📋 **Reports**",
          "• `give me my daily report` — full productivity overview",
          "",
          "💬 **WhatsApp**",
          "• `search WhatsApp about [topic]`",
          "• `summarize WhatsApp chat`",
          "",
          "🔍 **General**",
          "• `what do I know about [topic]` — search all sources",
        ].join("\n");
    }
  } catch (err) {
    console.error("Orchestrator error:", err.message);
    return "Something went wrong processing your request. Please try again.";
  }
}
