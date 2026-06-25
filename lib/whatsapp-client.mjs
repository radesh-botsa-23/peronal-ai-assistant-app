import { config } from "../config.mjs";

const GRAPH_API_URL = "https://graph.facebook.com/v21.0";

/**
 * WhatsApp Business API Client
 * Uses Meta's Cloud API for sending/receiving messages.
 */

/**
 * Send a text message via WhatsApp.
 * @param {string} to - Recipient phone number (with country code, no +)
 * @param {string} message - Text message to send
 * @returns {Promise<object>}
 */
export async function sendWhatsAppMessage(to, message) {
  if (!config.whatsapp.accessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is not set in .env");
  }

  const url = `${GRAPH_API_URL}/${config.whatsapp.phoneId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.whatsapp.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: message },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp send failed: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Get WhatsApp Business profile info.
 * @returns {Promise<object>}
 */
export async function getBusinessProfile() {
  const url = `${GRAPH_API_URL}/${config.whatsapp.phoneId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`;

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${config.whatsapp.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get profile: ${response.status}`);
  }

  return response.json();
}

/**
 * Mark a message as read.
 * @param {string} messageId - The WhatsApp message ID
 * @returns {Promise<void>}
 */
export async function markAsRead(messageId) {
  const url = `${GRAPH_API_URL}/${config.whatsapp.phoneId}/messages`;

  await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.whatsapp.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });
}

/**
 * Parse incoming webhook message data.
 * @param {object} body - Webhook request body
 * @returns {Array} Parsed messages
 */
export function parseWebhookMessages(body) {
  const messages = [];

  if (!body?.entry) return messages;

  for (const entry of body.entry) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;

      const value = change.value;
      if (!value?.messages) continue;

      for (const msg of value.messages) {
        messages.push({
          id: msg.id,
          from: msg.from,
          timestamp: msg.timestamp,
          type: msg.type,
          text: msg.text?.body || "",
          senderName: value.contacts?.[0]?.profile?.name || msg.from,
        });
      }
    }
  }

  return messages;
}
