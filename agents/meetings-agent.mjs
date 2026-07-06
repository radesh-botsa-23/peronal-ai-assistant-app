import { queryGBrain, storeDocument, parseGbrainResults, runGbrain } from "../lib/gbrain-client.mjs";
import { generateResponse } from "../lib/gemini-client.mjs";
import { config } from "../config.mjs";

// Lazy-load Fireflies client only when API key is available
let firefliesClient = null;
async function getFirefliesClient() {
  if (!config.fireflies?.apiKey) return null;
  if (!firefliesClient) {
    firefliesClient = await import("../lib/fireflies-client.mjs");
  }
  return firefliesClient;
}

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
  const ff = await getFirefliesClient();
  if (!ff) {
    throw new Error("Fireflies client not initialized. Check your FIREFLIES_API_KEY in config.");
  }
  const transcripts = await ff.getTranscripts(limit);

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
 * Falls back to GBrain if Fireflies API key is not set.
 * @param {number} limit
 * @returns {Promise<string>}
 */
export async function getRecentMeetings(limit = 5) {
  const ff = await getFirefliesClient();
  if (ff) {
    try {
      const transcripts = await ff.getTranscripts(limit);
      if (transcripts.length === 0) {
        return "No recent meetings found in Fireflies.";
      }
      let result = "## 📋 Recent Meetings\n\n";
      for (const t of transcripts) {
        result += ff.formatTranscript(t) + "\n---\n\n";
      }
      return result;
    } catch (err) {
      console.warn("Fireflies fetch failed, falling back to GBrain:", err.message);
    }
  }

  // Fallback: search GBrain for stored meetings
  const gbrainResults = queryGBrain("meeting summary participants");
  if (gbrainResults && gbrainResults.trim().length > 0) {
    const allMatches = parseGbrainResults(gbrainResults);
    const meetingMatches = allMatches.filter(m => m.slug.startsWith("meeting-"));
    if (meetingMatches.length > 0) {
      return `## 📋 Stored Meeting Summaries\n\n${formatMeetingSearchResults(meetingMatches)}`;
    }
  }
  return "No meetings found. Upload a meeting recording or configure Fireflies API key.";
}

/**
 * Format raw GBrain results into a beautiful and readable meeting summary.
 */
function formatMeetingSearchResults(matches) {
  // Deduplicate matches by slug to avoid querying/displaying the same meeting multiple times
  const uniqueSlugs = new Set();
  const uniqueMatches = [];
  for (const m of matches) {
    if (!uniqueSlugs.has(m.slug)) {
      uniqueSlugs.add(m.slug);
      uniqueMatches.push(m);
    }
  }

  return uniqueMatches.slice(0, 3).map((m, i) => {
    let docContent = "";
    try {
      docContent = runGbrain(`get ${m.slug}`);
    } catch (err) {
      console.warn(`Failed to fetch full document for ${m.slug}:`, err.message);
      docContent = m.bodyLines.join("\n");
    }

    const lines = docContent.split("\n");

    const titleHeader = lines.find(l => l.trim().startsWith("# Meeting:"));
    const title = titleHeader ? titleHeader.replace("# Meeting: ", "").replace("# Meeting:", "").trim() : "";
    
    // Find fields in lines
    const dateLine = lines.find(l => l.toLowerCase().includes("**date:**")) || "";
    const platformLine = lines.find(l => l.toLowerCase().includes("**platform:**")) || "";
    const participantsLine = lines.find(l => l.toLowerCase().includes("**participants:**")) || "";
    const durationLine = lines.find(l => l.toLowerCase().includes("**duration:**")) || "";

    // Extract Summary text
    const summaryHeaderIndex = lines.findIndex(l => l.trim().startsWith("## Summary"));
    let summaryText = "";
    if (summaryHeaderIndex !== -1) {
      const summaryLines = [];
      for (let j = summaryHeaderIndex + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (line.startsWith("#")) break; // Next section starts
        if (line) summaryLines.push(line);
      }
      summaryText = summaryLines.join("\n");
    }

    // Extract Action Items
    const actionItemsIndex = lines.findIndex(l => l.trim().startsWith("## Action Items"));
    let actionItemsText = "";
    if (actionItemsIndex !== -1) {
      const actionLines = [];
      for (let j = actionItemsIndex + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (line.startsWith("#")) break; // Next section starts
        if (line) actionLines.push(line);
      }
      actionItemsText = actionLines.join("\n");
    }

    let result = `📅 **Meeting ${i + 1}: ${title || "Untitled Meeting"}**\n`;
    if (dateLine) result += `• ${dateLine.trim()}\n`;
    if (durationLine) result += `• ${durationLine.trim()}\n`;
    if (platformLine) result += `• ${platformLine.trim()}\n`;
    if (participantsLine) result += `• ${participantsLine.trim()}\n`;
    
    if (summaryText) {
      result += `\n**Summary:**\n${summaryText.substring(0, 300)}${summaryText.length > 300 ? "..." : ""}\n`;
    }
    if (actionItemsText && actionItemsText.toLowerCase() !== "none identified" && actionItemsText.toLowerCase() !== "none") {
      result += `\n**Action Items:**\n${actionItemsText}\n`;
    }
    return result;
  }).join("\n\n───────────────────\n\n");
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

  const allMatches = parseGbrainResults(results);
  const meetingMatches = allMatches.filter(m => m.slug.startsWith("meeting-"));

  if (meetingMatches.length === 0) {
    return `No meetings found about "${topic}".`;
  }

  return `## 🔍 Meeting Search Results for "${topic}"\n\n${formatMeetingSearchResults(meetingMatches)}`;
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
    return "Meeting preparation is temporarily unavailable. Please try again.";
  }
}

/**
 * Get meeting summaries for today.
 * Falls back to GBrain if Fireflies API key not set.
 * @returns {Promise<string>}
 */
export async function getTodaysMeetingSummaries() {
  const ff = await getFirefliesClient();
  if (ff) {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      const transcripts = await ff.getTranscriptsByDateRange(
        startOfDay.toISOString(),
        endOfDay.toISOString()
      );
      if (transcripts.length > 0) {
        let result = "## Today's Meeting Summaries\n\n";
        for (const t of transcripts) {
          result += ff.formatTranscript(t) + "\n---\n\n";
        }
        return result;
      }
    } catch (err) {
      console.warn("Fireflies today's meetings failed:", err.message);
    }
  }

  // Fallback: search GBrain for today's meetings
  const today = new Date().toISOString().split("T")[0];
  const results = queryGBrain(`meeting ${today}`);
  if (results && results.trim().length > 0) {
    const allMatches = parseGbrainResults(results);
    const meetingMatches = allMatches.filter(m => m.slug.startsWith("meeting-"));
    if (meetingMatches.length > 0) {
      return `## Today's Meetings (from memory)\n\n${formatMeetingSearchResults(meetingMatches)}`;
    }
  }
  return "No meeting recordings found for today.";
}
