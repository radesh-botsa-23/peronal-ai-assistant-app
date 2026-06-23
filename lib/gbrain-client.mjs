import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const GBRAIN_PATH = "/home/radesh/.bun/bin/gbrain";
const BUN_PATH = "/home/radesh/.bun/bin";
const SHELL_ENV = { PATH: `${BUN_PATH}:/usr/bin:/bin:${process.env.PATH || ""}` };

/**
 * Store a document in GBrain.
 * @param {string} slug - Unique identifier for the document
 * @param {string} content - Markdown content to store
 * @returns {boolean} Whether storage succeeded
 */
export function storeDocument(slug, content) {
  const tmpFile = path.join(os.tmpdir(), `gbrain-${slug}.md`);
  fs.writeFileSync(tmpFile, content);

  try {
    execSync(`${GBRAIN_PATH} put ${slug} < "${tmpFile}"`, {
      stdio: "ignore",
      shell: "/bin/bash",
      env: { ...process.env, ...SHELL_ENV },
    });
    return true;
  } catch (err) {
    console.error(`Failed to store ${slug} in GBrain:`, err.message);
    return false;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

/**
 * Query GBrain with a semantic search.
 * @param {string} query - The search query
 * @returns {string} Raw results from GBrain
 */
export function queryGBrain(query) {
  try {
    const result = execSync(`${GBRAIN_PATH} query "${query.replace(/"/g, '\\"')}"`, {
      encoding: "utf8",
      timeout: 15000,
      shell: "/bin/bash",
      env: { ...process.env, ...SHELL_ENV },
    });
    return result;
  } catch (err) {
    console.error("GBrain query failed:", err.message);
    return "";
  }
}

/**
 * Check if a document exists in GBrain.
 * @param {string} slug - Document slug to check
 * @returns {boolean}
 */
export function documentExists(slug) {
  try {
    execSync(`${GBRAIN_PATH} get ${slug}`, {
      stdio: "ignore",
      timeout: 5000,
      shell: "/bin/bash",
      env: { ...process.env, ...SHELL_ENV },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Store an email in GBrain with proper formatting.
 * @param {object} email - Email object with id, from, subject, date, snippet
 * @returns {boolean}
 */
export function storeEmail(email) {
  const slug = `email-${email.id}`;

  if (documentExists(slug)) {
    return false; // Skip duplicate
  }

  const content = `# Email

From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}

${email.snippet}
`;

  return storeDocument(slug, content);
}
