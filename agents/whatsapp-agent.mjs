import { queryGBrain, storeDocument } from "../lib/gbrain-client.mjs";
import { generateResponse } from "../lib/gemini-client.mjs";
import { sendWhatsAppMessage } from "../lib/whatsapp-client.mjs";

/**
 * WhatsApp Agent - Handles WhatsApp message storage, search, and summarization.
 */

/**
 * Store a WhatsApp message in GBrain.
 * @param {object} message - Parsed WhatsApp message
 * @returns {boolean}
 */
export function storeWhatsAppMessage(message) {
  const slug = `whatsapp-${message.id}`;
  const date = new Date(parseInt(message.timestamp) * 1000).toISOString();

  const content = `# WhatsApp Message

From: ${message.senderName} (${message.from})
Date: ${date}
Type: ${message.type}

${message.text}

---
_Source: WhatsApp | ID: ${message.id}_
`;

  return storeDocument(slug, content);
}

/**
 * Search WhatsApp messages in GBrain.
 * @param {string} query - Search query
 * @returns {Promise<string>}
 */
export async function searchWhatsAppMessages(query) {
  const rawResults = queryGBrain(`whatsapp ${query}`);

  if (!rawResults || rawResults.trim().length === 0) {
    return "No WhatsApp messages found matching your query.";
  }

  // Filter to only WhatsApp results
  const lines = rawResults.split("\n");
  const whatsappLines = lines.filter(
    (line) => line.toLowerCase().includes("whatsapp")
  );

  if (whatsappLines.length === 0) {
    return "No WhatsApp messages found. Only email results available for this query.";
  }

  return whatsappLines.slice(0, 10).join("\n");
}

/**
 * Summarize recent WhatsApp messages.
 * @param {string} chatName - Optional chat/contact name filter
 * @returns {Promise<string>}
 */
export async function summarizeWhatsAppChat(chatName = "") {
  const query = chatName ? `whatsapp from ${chatName}` : "whatsapp message";
  const rawResults = queryGBrain(query);

  if (!rawResults || rawResults.trim().length === 0) {
    return "No WhatsApp messages found to summarize.";
  }

  const prompt = `Summarize the following WhatsApp messages concisely. Group by sender/topic if possible. Highlight any action items or important information.

Messages:
${rawResults}`;

  try {
    return await generateResponse(prompt);
  } catch {
    return rawResults;
  }
}

/**
 * Process an incoming WhatsApp message — store it and optionally respond.
 * @param {object} message - Parsed WhatsApp message
 * @returns {Promise<string|null>} Response to send back, or null
 */
export async function processIncomingMessage(message) {
  // Store the message in GBrain
  storeWhatsAppMessage(message);

  // If the message looks like a command/question, generate a response
  const text = message.text.toLowerCase();
  const isQuery = text.includes("?") ||
    text.startsWith("search") ||
    text.startsWith("find") ||
    text.startsWith("summarize") ||
    text.startsWith("what") ||
    text.startsWith("show");

  if (isQuery) {
    // Search GBrain and respond
    const results = queryGBrain(message.text);
    if (results && results.trim().length > 0) {
      const prompt = `Based on the following information from my knowledge base, answer this question concisely: "${message.text}"

Information:
${results}`;

      try {
        return await generateResponse(prompt);
      } catch (err) {
        console.error("Error generating response in processIncomingMessage:", err);
        return null;
      }
    }
  }

  return null; // Just store, don't respond
}
