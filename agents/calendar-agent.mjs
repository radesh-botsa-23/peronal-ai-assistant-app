import { getTodaysEvents, getUpcomingEvents, formatEvents } from "../lib/calendar-client.mjs";
import { generateResponse } from "../lib/gemini-client.mjs";
import { queryGBrain } from "../lib/gbrain-client.mjs";

/**
 * Calendar Agent - Retrieves meeting information, prepares meeting briefs.
 */

/**
 * Get today's meetings formatted for the user.
 * @returns {Promise<string>}
 */
export async function getTodaysMeetings() {
  try {
    const events = await getTodaysEvents();
    if (events.length === 0) {
      return "No meetings scheduled for today.";
    }
    return `## 📅 Today's Meetings\n\n${formatEvents(events)}`;
  } catch (err) {
    if (err.message?.includes("auth") || err.code === 401) {
      return "Calendar access not available. Run `node gmail-auth.mjs` to re-authenticate with calendar scope.";
    }
    return `Failed to fetch calendar: ${err.message}`;
  }
}

/**
 * Get upcoming meetings for the next N hours.
 * @param {number} hours
 * @returns {Promise<string>}
 */
export async function getUpcomingMeetings(hours = 24) {
  try {
    const events = await getUpcomingEvents(hours);
    if (events.length === 0) {
      return `No meetings in the next ${hours} hours.`;
    }
    return `## 📅 Upcoming Meetings (next ${hours}h)\n\n${formatEvents(events)}`;
  } catch (err) {
    if (err.message?.includes("auth") || err.code === 401) {
      return "Calendar access not available. Re-authenticate with calendar scope.";
    }
    return `Failed to fetch calendar: ${err.message}`;
  }
}

/**
 * Prepare a meeting brief by combining calendar + email context.
 * @param {string} topic - Meeting topic or title
 * @returns {Promise<string>}
 */
export async function prepareMeetingBrief(topic) {
  // Get upcoming meetings matching the topic
  let meetingInfo = "";
  try {
    const events = await getUpcomingEvents(48);
    const matching = events.filter(
      (e) => e.title.toLowerCase().includes(topic.toLowerCase())
    );
    if (matching.length > 0) {
      meetingInfo = matching.map((e) => 
        `Meeting: ${e.title}\nTime: ${e.start}\nAttendees: ${e.attendees}\nDescription: ${e.description}`
      ).join("\n\n");
    }
  } catch {
    meetingInfo = "Calendar unavailable.";
  }

  // Search GBrain for related emails/context
  const emailContext = queryGBrain(`${topic}`);

  const combinedContext = [
    meetingInfo ? `## Meeting Details\n${meetingInfo}` : "",
    emailContext ? `## Related Emails\n${emailContext}` : "",
  ].filter(Boolean).join("\n\n");

  if (!combinedContext || combinedContext.trim().length < 20) {
    return `Limited context available for "${topic}". No matching meetings or related emails found.`;
  }

  const prompt = `Generate a concise meeting preparation brief (max 500 words) for: "${topic}"

Context:
${combinedContext}

Structure:
## Meeting Details
## Related Emails & Context  
## Suggested Talking Points (3-5 points)

If limited info is available, note that.`;

  try {
    return await generateResponse(prompt);
  } catch {
    return "Meeting brief generation is temporarily unavailable. Please try again.";
  }
}
