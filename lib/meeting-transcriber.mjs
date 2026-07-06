import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.mjs";
import { generateContentWithRetry } from "./gemini-client.mjs";

/**
 * Meeting Transcriber - Transcribes audio files using Gemini's multimodal capabilities.
 * Supports: .mp3, .wav, .ogg, .m4a, .webm audio files
 * 
 * Flow: Audio File → Gemini (transcription) → Raw Transcript
 */

const SUPPORTED_FORMATS = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".webm": "audio/webm",
  ".opus": "audio/opus",
};

/**
 * Transcribe an audio file using Gemini.
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<string>} Raw transcript text
 */
export async function transcribeAudioFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = SUPPORTED_FORMATS[ext];

  if (!mimeType) {
    throw new Error(`Unsupported audio format: ${ext}. Supported: ${Object.keys(SUPPORTED_FORMATS).join(", ")}`);
  }

  const audioBuffer = fs.readFileSync(filePath);
  const base64Audio = audioBuffer.toString("base64");

  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Transcribe this audio recording of a meeting. Include speaker labels if you can identify different speakers (Speaker 1, Speaker 2, etc.). Capture everything that is spoken. Format as a clean transcript with timestamps if possible.`;

  const result = await generateContentWithRetry(model, [
    prompt,
    {
      inlineData: {
        data: base64Audio,
        mimeType: mimeType,
      },
    },
  ]);

  const response = await result.response;
  return response.text();
}

/**
 * Transcribe audio from a Buffer (for uploaded files).
 * @param {Buffer} audioBuffer - Audio data
 * @param {string} mimeType - MIME type of the audio
 * @returns {Promise<string>} Raw transcript
 */
export async function transcribeBuffer(audioBuffer, mimeType = "audio/webm") {
  const base64Audio = audioBuffer.toString("base64");

  const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `Transcribe this audio recording of a meeting. Include speaker labels if you can identify different speakers (Speaker 1, Speaker 2, etc.). Capture everything spoken clearly and accurately.`;

  const result = await generateContentWithRetry(model, [
    prompt,
    {
      inlineData: {
        data: base64Audio,
        mimeType: mimeType,
      },
    },
  ]);

  const response = await result.response;
  return response.text();
}
