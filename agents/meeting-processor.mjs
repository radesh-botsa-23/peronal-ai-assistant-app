import fs from "fs";
import path from "path";
import { transcribeAudioFile, transcribeBuffer } from "../lib/meeting-transcriber.mjs";
import { analyzeMeeting, quickSummary } from "../lib/meeting-summarizer.mjs";
import { storeDocument, queryGBrain } from "../lib/gbrain-client.mjs";
import { generateResponse } from "../lib/gemini-client.mjs";

/**
 * Meeting Processor Agent
 * 
 * Complete pipeline:
 * Audio → Transcription (Gemini) → Analysis (Gemini) → GBrain Storage → Discord delivery
 * 
 * Stores: summary, action items, decisions, topics, participants, raw transcript
 * Enables: meeting prep for future meetings with same participants
 */

/**
 * Process a meeting audio file end-to-end.
 * @param {string} audioFilePath - Path to the audio file
 * @param {object} metadata - Meeting metadata
 * @param {string} metadata.title - Meeting title
 * @param {string} metadata.participants - Comma-separated participant names
 * @param {string} metadata.date - Meeting date (ISO string or readable)
 * @param {string} metadata.platform - Platform (Google Meet, Teams, Zoom)
 * @returns {Promise<object>} Complete meeting analysis
 */
export async function processMeetingAudio(audioFilePath, metadata = {}) {
  console.log(`[Meeting] Processing: ${audioFilePath}`);

  // Step 1: Transcribe
  console.log("[Meeting] Step 1: Transcribing audio...");
  const transcript = await transcribeAudioFile(audioFilePath);
  console.log(`[Meeting] Transcription complete (${transcript.length} chars)`);

  // Step 2: Analyze
  console.log("[Meeting] Step 2: Analyzing transcript...");
  const analysis = await analyzeMeeting(transcript, metadata);
  console.log("[Meeting] Analysis complete");

  // Step 3: Store in GBrain
  console.log("[Meeting] Step 3: Storing in GBrain...");
  const meetingId = `meeting-${Date.now()}`;
  const stored = storeMeetingAnalysis(meetingId, transcript, analysis, metadata);
  console.log(`[Meeting] Stored: ${stored}`);

  return {
    id: meetingId,
    transcript,
    analysis,
    metadata,
  };
}

/**
 * Process a meeting audio buffer (from Discord upload or API).
 * @param {Buffer} audioBuffer - Audio data
 * @param {string} mimeType - MIME type
 * @param {object} metadata - Meeting metadata
 * @returns {Promise<object>}
 */
export async function processMeetingBuffer(audioBuffer, mimeType, metadata = {}) {
  console.log("[Meeting] Processing audio buffer...");

  // Step 1: Transcribe
  const transcript = await transcribeBuffer(audioBuffer, mimeType);

  // Step 2: Analyze
  const analysis = await analyzeMeeting(transcript, metadata);

  // Step 3: Store
  const meetingId = `meeting-${Date.now()}`;
  storeMeetingAnalysis(meetingId, transcript, analysis, metadata);

  return { id: meetingId, transcript, analysis, metadata };
}

/**
 * Store meeting analysis in GBrain.
 */
function storeMeetingAnalysis(meetingId, transcript, analysis, metadata) {
  const date = metadata.date || new Date().toISOString();
  const title = metadata.title || analysis.topics?.[0] || "Untitled Meeting";
  const participants = metadata.participants || analysis.participants?.join(", ") || "Unknown";
  const platform = metadata.platform || "Unknown";

  const content = `# Meeting: ${title}

**Date:** ${date}
**Platform:** ${platform}
**Participants:** ${participants}
**Duration:** ${metadata.duration || "Unknown"}

## Summary
${analysis.summary || "No summary generated"}

## Action Items
${(analysis.actionItems || []).map((item, i) => `${i + 1}. ${item}`).join("\n") || "None identified"}

## Decisions Made
${(analysis.decisions || []).map((d, i) => `${i + 1}. ${d}`).join("\n") || "None recorded"}

## Topics Discussed
${(analysis.topics || []).map(t => `- ${t}`).join("\n") || "Not available"}

## Key Points
${analysis.keyPoints || "Not available"}

## Follow-ups for Next Meeting
${(analysis.followUps || []).map(f => `- ${f}`).join("\n") || "None"}

## Raw Transcript
${transcript.substring(0, 3000)}${transcript.length > 3000 ? "\n\n[...transcript truncated]" : ""}

---
_Source: Meeting Recording | Platform: ${platform} | ID: ${meetingId}_
`;

  return storeDocument(meetingId, content);
}

/**
 * Prepare for an upcoming meeting by finding previous meetings with same participants.
 * @param {string} participantsOrTopic - Participant names or meeting topic
 * @returns {Promise<string>}
 */
export async function prepareForMeeting(participantsOrTopic) {
  // Search GBrain for previous meetings
  const previousMeetings = queryGBrain(`meeting ${participantsOrTopic} summary action items decisions`);
  const relatedEmails = queryGBrain(`${participantsOrTopic} email`);

  if ((!previousMeetings || previousMeetings.trim().length < 20) &&
      (!relatedEmails || relatedEmails.trim().length < 20)) {
    return `No previous meetings or context found for "${participantsOrTopic}". This appears to be a first meeting on this topic.`;
  }

  const prompt = `You are preparing someone for a meeting about/with: "${participantsOrTopic}"

Based on previous meetings and emails, create a preparation brief:

${previousMeetings ? `## Previous Meetings\n${previousMeetings}\n` : ""}
${relatedEmails ? `## Related Emails\n${relatedEmails}\n` : ""}

Generate a structured brief (max 500 words):

## Previous Discussion Summary
(What was discussed before with these people)

## Unresolved Action Items
(Tasks from last meeting that may still be pending)

## Decisions Already Made
(So we don't re-discuss settled items)

## Suggested Agenda for This Meeting
(Based on follow-ups and unresolved items)

## Context from Emails
(Any relevant email threads since last meeting)`;

  try {
    return await generateResponse(prompt);
  } catch {
    return "Meeting preparation is temporarily unavailable. Please try again.";
  }
}

/**
 * Get summaries of all stored meetings.
 * @returns {string}
 */
export function getStoredMeetings() {
  const results = queryGBrain("meeting summary participants action items");
  if (!results || results.trim().length === 0) {
    return "No meeting recordings processed yet. Upload a meeting audio file to get started.";
  }
  return `## 📋 Stored Meeting Summaries\n\n${results}`;
}
