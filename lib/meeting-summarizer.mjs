import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.mjs";
import { generateContentWithRetry } from "./gemini-client.mjs";

/**
 * Meeting Summarizer - Processes raw transcripts into structured meeting intelligence.
 * 
 * Flow: Raw Transcript → Gemini → Summary + Action Items + Decisions
 */

/**
 * Generate a complete meeting analysis from a raw transcript.
 * @param {string} transcript - Raw meeting transcript
 * @param {object} metadata - Meeting metadata (title, participants, date)
 * @returns {Promise<{summary: string, actionItems: string[], decisions: string[], topics: string[], keyPoints: string}>}
 */
export async function analyzeMeeting(transcript, metadata = {}) {
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Analyze this meeting transcript and provide a structured output in the following JSON format:

{
  "summary": "A concise 2-3 paragraph summary of what was discussed",
  "actionItems": ["List of specific action items with owner if mentioned"],
  "decisions": ["List of decisions made during the meeting"],
  "topics": ["List of main topics discussed"],
  "keyPoints": "Bullet-point list of key takeaways",
  "participants": ["List of identified speakers/participants"],
  "followUps": ["Things that need follow-up in future meetings"]
}

Meeting Title: ${metadata.title || "Unknown"}
Date: ${metadata.date || new Date().toISOString()}
Participants: ${metadata.participants || "Not specified"}

Transcript:
${transcript}

Respond ONLY with valid JSON, no markdown fences.`;

  const result = await generateContentWithRetry(model, prompt);
  const response = await result.response;
  const text = response.text().trim();

  try {
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    // If JSON parsing fails, return raw structured text
    return {
      summary: text,
      actionItems: [],
      decisions: [],
      topics: [],
      keyPoints: text,
      participants: [],
      followUps: [],
    };
  }
}

/**
 * Generate a short summary from a transcript (for quick overview).
 * @param {string} transcript
 * @returns {Promise<string>}
 */
export async function quickSummary(transcript) {
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Provide a concise 3-5 sentence summary of this meeting transcript. Focus on: what was discussed, what was decided, and what needs to happen next.

Transcript:
${transcript.substring(0, 10000)}`;

  const result = await generateContentWithRetry(model, prompt);
  const response = await result.response;
  return response.text();
}
