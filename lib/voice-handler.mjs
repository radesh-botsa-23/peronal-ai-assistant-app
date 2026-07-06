import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.mjs";
import { generateContentWithRetry } from "./gemini-client.mjs";

/**
 * Voice Handler - Transcribes Discord voice messages using Gemini.
 * Handles .ogg voice message attachments sent in Discord.
 */

/**
 * Transcribe an audio file using Gemini's multimodal capabilities.
 * @param {Buffer} audioBuffer - The audio file buffer
 * @param {string} mimeType - MIME type (e.g., "audio/ogg", "audio/mpeg")
 * @returns {Promise<{text: string, confidence: number}>}
 */
export async function transcribeAudio(audioBuffer, mimeType = "audio/ogg") {
  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const audioData = {
    inlineData: {
      data: audioBuffer.toString("base64"),
      mimeType: mimeType,
    },
  };

  const prompt = `Transcribe this audio. Return ONLY the spoken words, nothing else. If unclear, prefix with [LOW CONFIDENCE].`;

  try {
    const result = await generateContentWithRetry(model, [prompt, audioData]);
    const response = await result.response;
    const text = response.text().trim();

    const isLowConfidence = text.startsWith("[LOW CONFIDENCE]");
    const cleanText = isLowConfidence
      ? text.replace("[LOW CONFIDENCE]", "").trim()
      : text;

    return {
      text: cleanText,
      confidence: isLowConfidence ? 0.5 : 0.9,
    };
  } catch (err) {
    console.error("Transcription failed:", err.message);
    throw err;
  }
}

/**
 * Check if a Discord message contains a voice message attachment.
 * @param {object} message - Discord.js message object
 * @returns {object|null} The voice attachment or null
 */
export function getVoiceAttachment(message) {
  if (!message.attachments || message.attachments.size === 0) return null;

  for (const [, attachment] of message.attachments) {
    // Discord voice messages have these characteristics
    const isVoice =
      attachment.contentType?.includes("audio") ||
      attachment.name?.endsWith(".ogg") ||
      attachment.name?.endsWith(".mp3") ||
      attachment.name?.endsWith(".wav") ||
      attachment.name?.endsWith(".m4a") ||
      attachment.flags?.has(1 << 13); // IS_VOICE_MESSAGE flag

    if (isVoice) {
      return {
        url: attachment.url,
        name: attachment.name,
        size: attachment.size,
        contentType: attachment.contentType || "audio/ogg",
        duration: attachment.duration || 0,
      };
    }
  }

  return null;
}

/**
 * Download an attachment from Discord.
 * @param {string} url - The attachment URL
 * @returns {Promise<Buffer>}
 */
export async function downloadAttachment(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
