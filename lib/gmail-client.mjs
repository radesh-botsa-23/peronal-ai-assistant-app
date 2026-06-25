import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

// Always resolve credentials from the project root, regardless of cwd
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CREDENTIALS_PATH = path.join(PROJECT_ROOT, "credentials.json");
const TOKEN_PATH = path.join(PROJECT_ROOT, "token.json");

/**
 * Creates an authenticated Gmail client using stored credentials.
 */
export function createGmailClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));

  const { client_id, client_secret } = credentials.installed;

  const auth = new google.auth.OAuth2(client_id, client_secret, "http://localhost");
  auth.setCredentials(token);

  return google.gmail({ version: "v1", auth });
}

/**
 * Extract the plain text body from a Gmail message payload.
 * Handles both simple and multipart messages.
 * @param {object} payload - Gmail message payload
 * @returns {string} Decoded plain text body
 */
function extractBody(payload) {
  // Simple message with body data directly
  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  // Multipart message - look for text/plain first, then text/html
  if (payload.parts) {
    // Try text/plain first
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64(part.body.data);
      }
      // Nested multipart
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }

    // Fallback to text/html (strip tags)
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = decodeBase64(part.body.data);
        return stripHtml(html);
      }
    }
  }

  return "";
}

/**
 * Decode base64url encoded string.
 */
function decodeBase64(data) {
  return Buffer.from(data, "base64url").toString("utf8");
}

/**
 * Strip HTML tags and decode entities for plain text.
 */
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetches recent emails from Gmail with full body content.
 * @param {number} maxResults - Maximum number of emails to fetch
 * @returns {Promise<Array>} Array of email objects with full body
 */
export async function fetchEmails(maxResults = 20) {
  const gmail = createGmailClient();

  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults,
  });

  const emails = [];

  for (const msg of list.data.messages || []) {
    const details = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "full",
    });

    const headers = details.data.payload.headers || [];

    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const from = headers.find((h) => h.name === "From")?.value || "";
    const to = headers.find((h) => h.name === "To")?.value || "";
    const date = headers.find((h) => h.name === "Date")?.value || "";
    const snippet = details.data.snippet || "";

    // Extract full body
    const body = extractBody(details.data.payload);

    // Truncate body to 5000 chars to avoid overwhelming GBrain
    const truncatedBody = body.length > 5000 ? body.substring(0, 5000) + "\n\n[...truncated]" : body;

    emails.push({
      id: msg.id,
      from,
      to,
      subject,
      date,
      snippet,
      body: truncatedBody,
    });
  }

  return emails;
}
