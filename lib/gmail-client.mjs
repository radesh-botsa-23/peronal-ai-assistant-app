import fs from "fs";
import { google } from "googleapis";

/**
 * Creates an authenticated Gmail client using stored credentials.
 */
export function createGmailClient() {
  const credentials = JSON.parse(fs.readFileSync("credentials.json", "utf8"));
  const token = JSON.parse(fs.readFileSync("token.json", "utf8"));

  const { client_id, client_secret } = credentials.installed;

  const auth = new google.auth.OAuth2(client_id, client_secret, "http://localhost");
  auth.setCredentials(token);

  return google.gmail({ version: "v1", auth });
}

/**
 * Fetches recent emails from Gmail.
 * @param {number} maxResults - Maximum number of emails to fetch
 * @returns {Promise<Array>} Array of email objects
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
    });

    const headers = details.data.payload.headers || [];

    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const from = headers.find((h) => h.name === "From")?.value || "";
    const date = headers.find((h) => h.name === "Date")?.value || "";
    const snippet = details.data.snippet || "";

    emails.push({ id: msg.id, from, subject, date, snippet });
  }

  return emails;
}
