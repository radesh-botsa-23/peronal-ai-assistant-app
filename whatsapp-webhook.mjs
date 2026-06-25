import http from "http";
import { config } from "./config.mjs";
import { parseWebhookMessages, markAsRead, sendWhatsAppMessage } from "./lib/whatsapp-client.mjs";
import { processIncomingMessage } from "./agents/whatsapp-agent.mjs";

/**
 * WhatsApp Webhook Server
 * Receives incoming messages from Meta's WhatsApp Cloud API.
 * 
 * Setup:
 * 1. Set WHATSAPP_VERIFY_TOKEN in .env
 * 2. Expose this server via ngrok or similar: ngrok http 3001
 * 3. Set the webhook URL in Meta Developer Console:
 *    https://developers.facebook.com/apps → Webhooks → WhatsApp
 *    URL: https://your-ngrok-url/webhook
 *    Verify token: your WHATSAPP_VERIFY_TOKEN value
 */

const PORT = parseInt(process.env.WHATSAPP_WEBHOOK_PORT || "3002", 10);
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "personal_ai_assistant_verify";

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(null);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Webhook verification (GET)
  if (req.method === "GET" && url.pathname === "/webhook") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verified");
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(challenge);
    } else {
      res.writeHead(403);
      res.end("Forbidden");
    }
    return;
  }

  // Incoming messages (POST)
  if (req.method === "POST" && url.pathname === "/webhook") {
    const body = await parseBody(req);

    // Respond 200 immediately (Meta requires quick response)
    res.writeHead(200);
    res.end("OK");

    if (!body) return;

    // Parse messages
    const messages = parseWebhookMessages(body);

    for (const msg of messages) {
      console.log(`📱 WhatsApp from ${msg.senderName} (${msg.from}): ${msg.text}`);

      // Mark as read
      await markAsRead(msg.id).catch(() => {});

      // Process and optionally respond
      const response = await processIncomingMessage(msg);

      if (response) {
        await sendWhatsAppMessage(msg.from, response).catch((err) => {
          console.error("Failed to send WhatsApp reply:", err.message);
        });
      }
    }
    return;
  }

  // Health check
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "whatsapp-webhook" }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`🟢 WhatsApp webhook server running on port ${PORT}`);
  console.log(`   Verify token: ${VERIFY_TOKEN}`);
  console.log(`   Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`\n   To expose publicly: npx ngrok http ${PORT}`);
});
