import { queryGBrain, storeDocument, parseGbrainResults } from "../lib/gbrain-client.mjs";
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
  const rawResults = queryGBrain(query);

  if (!rawResults || rawResults.trim().length === 0) {
    return "No WhatsApp messages found matching your query.";
  }

  const allMatches = parseGbrainResults(rawResults);
  const whatsappMatches = allMatches.filter((m) => m.slug.startsWith("whatsapp-"));

  if (whatsappMatches.length === 0) {
    return "No WhatsApp messages found matching your query.";
  }

  return formatWhatsAppSearchResults(whatsappMatches);
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

  const allMatches = parseGbrainResults(rawResults);
  const whatsappMatches = allMatches.filter((m) => m.slug.startsWith("whatsapp-"));

  if (whatsappMatches.length === 0) {
    return "No WhatsApp messages found to summarize.";
  }

  const filteredRaw = whatsappMatches.map(m => `${m.header}\n${m.bodyLines.join("\n")}`).join("\n\n");

  const prompt = `Summarize the following WhatsApp messages concisely. Group by sender/topic if possible. Highlight any action items or important information.

Messages:
${filteredRaw}`;

  try {
    return await generateResponse(prompt);
  } catch {
    return "Summarization is temporarily unavailable. Please try again.";
  }
}

/**
 * Format raw GBrain WhatsApp search results.
 */
function formatWhatsAppSearchResults(matches) {
  return matches.slice(0, 5).map((m, i) => {
    const fromLine = m.bodyLines.find(l => l.startsWith("From:")) || "";
    const dateLine = m.bodyLines.find(l => l.startsWith("Date:")) || "";
    
    const textLines = m.bodyLines
      .filter(l => !l.startsWith("From:") && !l.startsWith("Date:") && !l.startsWith("Type:") && !l.startsWith("---") && !l.includes("_Source:") && l.trim().length > 0)
      .join("\n");

    let result = `📱 **WhatsApp Message ${i + 1}**\n`;
    if (fromLine) result += `• **${fromLine}**\n`;
    if (dateLine) result += `• **${dateLine}**\n`;
    if (textLines) result += `• **Content:**\n${textLines.trim()}`;
    return result;
  }).join("\n\n");
}

/**
 * Process an incoming WhatsApp message — store it and optionally respond.
 * @param {object} message - Parsed WhatsApp message
 * @returns {Promise<string|null>} Response to send back, or null
 */
export async function processIncomingMessage(message) {
  // Store the message in GBrain
  storeWhatsAppMessage(message);

  const cleanText = message.text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  
  const greetings = ["hi", "hello", "hey", "yo", "greetings", "good morning", "good afternoon", "good evening"];
  const acknowledgements = ["ok", "okay", "thanks", "thank you", "cool", "got it", "fine"];
  
  if (greetings.includes(cleanText)) {
    return "Hello! How can I help you today? 🤖";
  }
  
  if (acknowledgements.includes(cleanText)) {
    return "You're welcome! Let me know if you need anything else. 👍";
  }

  // If the message looks like a command/question, generate a response
  const text = message.text.toLowerCase().trim();
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
        const errMsg = (err && err.message) ? err.message : String(err);
        if (
          errMsg.includes("429") ||
          errMsg.includes("quota") ||
          errMsg.includes("limit") ||
          errMsg.includes("overloaded") ||
          errMsg.includes("RESOURCE_EXHAUSTED")
        ) {
          return "⚠️ The AI Assistant is currently rate-limited or experiencing high load. Please try again in a few minutes.";
        }
        return "⚠️ Sorry, I encountered an error while processing your request. Please try again.";
      }
    }
  }

  return null; // Just store, don't respond
}
