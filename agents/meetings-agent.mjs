import { getTranscripts, getTranscriptsByParticipant, getTranscriptsByDateRange, formatTranscript } from "../lib/fireflies-client.mjs";
import { queryGBrain, storeDocument } from "../lib/gbrain-client.mjs";
import { generateResponse } from "../lib/gemini-client.mjs";

/**
 * Meetings Agent - Fetches meeting transcripts from Fireflies.ai,
 * stores summaries in GBrain, and prepares meeting briefs for recurring meetings.
 */

/**
 * Store a meeting transcript summary in GBrain.
 * @param {object} transcript - Fireflies transcript object
 * @returns {boolean}
 */
export function storeMeetingInGBrain(transcript) {
  const slug = `meeting-${transcript.id}`;
  const date = new Date(transcript.date).toISOString();
  const participants = transcript.meeting_attendees?.map(a => a.displayName || a.name || a.email).join(", ") || transcript.participants?.join(", ") || "";
  const speakers = transcript.speakers?.map(s => s.name).join(", ") || "";

  const content = `# Meeting: ${transcript.title}

**Date:** ${date}
**Duration:** ${transcript.duration ? Math.round(transcript.duration / 60) : 0} minutes
**Participants:** ${participants}
**Speakers:** ${speakers}
**Host:** ${transcript.host_email || ""}

## Summary
${transcript.summary?.overview || transcript.summary?.short_summary || "No summary available"}

## Action Items
${(transcript.summary?.action_items || []).map(item => `- ${item}`).join("\n") || "None identified"}

## Topics Discussed
${(transcript.summary?.topics_discussed || []).map(topic => `- ${topic}`).join("\n") || "Not available"}

## Key Points
${transcript.summary?.bullet_gist || "Not available"}

---
_Source: Fireflies.ai | Meeting ID: ${transcript.id}_
_Transcript URL: ${transcript.transcript_url || "N/A"}_
`;

  return storeDocument(slug, content);
}

/**
 * Ingest recent meetings from Fireflies into GBrain.
 * @param {number} limit - Number of recent meetings to fetch
 * @returns {Promise<{stored: number, skipped: number, failed: number}>}
 */
export async function ingestMeetings(limit = 20) {
  const transcripts = await getTranscripts(limit);

  let stored = 0;
  let skipped = 0;
  let failed = 0;

  for (const transcript of transcripts) {
    try {
      const wasStored = storeMeetingInGBrain(transcript);
      if (wasStored) {
        stored++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`Failed to store meeting ${transcript.id}:`, err.message);
      failed++;
    }
  }

  return { stored, skipped, failed };
}

/**
 * Get recent meeting summaries formatted for display.
 * @param {number} limit
 * @returns {Promise<string>}
 */
export async function getRecentMeetings(limit = 5) {
  try {
    const transcripts = await getTranscripts(limit);

    if (transcripts.length === 0) {
      return "No recent meetings found in Fireflies.";
    }

    let result = "## 📋 Recent Meetings\n\n";
    for (const t of transcripts) {
      result += formatTranscript(t) + "\n---\n\n";
    }
    return result;
  } catch (err) {
    // Fallback to GBrain if Fireflies API fails
    const gbrainResults = queryGBrain("meeting summary participants");
    if (gbrainResults && gbrainResults.trim().length > 0) {
      return `## 📋 Recent Meetings (from memory)\n\n${gbrainResults}`;
    }
    return `Failed to fetch meetings: ${err.message}`;
  }
}

/**
 * Search meetings by topic using GBrain.
 * @param {string} topic
 * @returns {Promise<string>}
 */
export async function searchMeetings(topic) {
  const results = queryGBrain(`meeting ${topic}`);

  if (!results || results.trim().length === 0) {
    return `No meetings found about "${topic}".`;
  }

  return results;
}

/**
 * Prepare for a meeting with specific participants.
 * Finds previous meetings with the same people and generates a brief.
 * @param {string} topic - Meeting topic or participant name
 * @returns {Promise<string>}
 */
export async function prepareMeetingWithContext(topic) {
  // Search GBrain for previous meetings with same topic/participants
  const previousMeetings = queryGBrain(`meeting ${topic} summary action items`);
  const relatedEmails = queryGBrain(`${topic} email`);

  const combinedContext = [
    previousMeetings ? `## Previous Meetings\n${previousMeetings}` : "",
    relatedEmails ? `## Related Emails\n${relatedEmails}` : "",
  ].filter(Boolean).join("\n\n");

  if (!combinedContext || combinedContext.trim().length < 30) {
    return `No previous meeting context found for "${topic}". This might be a first meeting on this topic.`;
  }

  const prompt = `You are preparing someone for an upcoming meeting about: "${topic}"

Based on previous meetings and related emails, generate a meeting preparation brief (max 500 words):

${combinedContext}

Structure your brief as:
## Previous Meeting Summary
(Key points from past meetings with these people/on this topic)

## Unresolved Action Items
(Tasks that were assigned but may not be completed)

## Key Context from Emails
(Relevant email threads)

## Suggested Talking Points
(3-5 points to bring up in the meeting)

## Participants History
(What each person typically discusses/contributes)

If some sections have limited info, note that.`;

  try {
    return await generateResponse(prompt);
  } catch {
    return `## Meeting Prep: ${topic}\n\n${combinedContext}`;
  }
}

/**
 * Get meeting summary for today.
 * @returns {Promise<string>}
 */
export async function getTodaysMeetingSummaries() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  try {
    const transcripts = await getTranscriptsByDateRange(
      startOfDay.toISOString(),
      endOfDay.toISOString()
    );

    if (transcripts.length === 0) {
      return "No meetings recorded today in Fireflies.";
    }

    let result = "## Today's Meeting Summaries\n\n";
    for (const t of transcripts) {
      result += formatTranscript(t) + "\n---\n\n";
    }
    return result;
  } catch (err) {
    return `Failed to fetch today's meetings: ${err.message}`;
  }
}
