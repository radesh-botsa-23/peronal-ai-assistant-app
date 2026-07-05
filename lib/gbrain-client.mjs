import { execSync, execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { config } from "../config.mjs";

/**
 * GBrain Client
 *
 * GBrain runs inside WSL. This client detects whether we're running on
 * Windows or Linux and adapts accordingly:
 *
 *   - On Windows: calls `wsl bash -c "gbrain ..."` via cmd.exe
 *   - On Linux/WSL: calls `/home/radesh/.bun/bin/gbrain` directly
 */

const IS_WINDOWS = process.platform === "win32";
const GBRAIN_WSL_PATH = "/home/radesh/.bun/bin/gbrain";
const BUN_PATH = "/home/radesh/.bun/bin";

// Dynamically determine the gbrain path on Linux (e.g., on Railway or standard Linux installs)
let GBRAIN_PATH = GBRAIN_WSL_PATH;
if (!IS_WINDOWS) {
  try {
    if (!fs.existsSync(GBRAIN_WSL_PATH)) {
      GBRAIN_PATH = execSync("which gbrain", { encoding: "utf8" }).trim();
    }
  } catch {
    GBRAIN_PATH = "gbrain"; // Fallback to bare command if "which" fails
  }
}

const PATH_SEPARATOR = IS_WINDOWS ? ";" : ":";
const GBRAIN_ENV = { 
  PATH: `${BUN_PATH}${PATH_SEPARATOR}${process.env.PATH || ""}`,
  OPENAI_API_KEY: config.gemini.apiKey,
  OPENAI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  GEMINI_API_KEY: config.gemini.apiKey,
  GOOGLE_API_KEY: config.gemini.apiKey,
  GOOGLE_GENERATIVE_AI_API_KEY: config.gemini.apiKey,
  BUN_JSC_useJIT: "0",
  BUN_JSC_useWasmIPInt: "1"
};

/**
 * Run a gbrain command, handling Windows vs Linux transparently.
 * @param {string} cmd - The gbrain subcommand + args (e.g. 'query "security"')
 * @param {object} [opts] - Options: { quiet: true } suppresses stderr
 * @returns {string} stdout output
 */
export function runGbrain(cmd, opts = {}) {
  if (IS_WINDOWS) {
    // On Windows, run through WSL using execFileSync to preserve quotes and arguments
    return execFileSync("wsl", [
      "bash",
      "-c",
      `export PATH="${BUN_PATH}:/usr/bin:/bin:\$PATH" && export OPENAI_API_KEY='${config.gemini.apiKey}' && export OPENAI_BASE_URL='https://generativelanguage.googleapis.com/v1beta/openai/' && export GEMINI_API_KEY='${config.gemini.apiKey}' && export GOOGLE_API_KEY='${config.gemini.apiKey}' && export GOOGLE_GENERATIVE_AI_API_KEY='${config.gemini.apiKey}' && gbrain ${cmd}`
    ], {
      encoding: "utf8",
      timeout: 15000,
    });
  } else {
    // On Linux/WSL, run directly using dynamic path
    return execSync(`${GBRAIN_PATH} ${cmd}`, {
      encoding: "utf8",
      timeout: 15000,
      shell: "/bin/bash",
      env: { ...process.env, ...GBRAIN_ENV },
      stdio: opts.quiet ? ["pipe", "pipe", "ignore"] : undefined,
    });
  }
}

/**
 * Run a gbrain command that reads from a file (for `put`).
 * @param {string} slug
 * @param {string} filePath
 * @returns {boolean}
 */
function runGbrainPut(slug, filePath) {
  if (IS_WINDOWS) {
    // Convert Windows path to WSL path
    const wslPath = filePath.replace(/\\/g, "/").replace(/^C:/, "/mnt/c").replace(/^([A-Z]):/, (_, l) => `/mnt/${l.toLowerCase()}`);
    execFileSync("wsl", [
      "bash",
      "-c",
      `export PATH="${BUN_PATH}:/usr/bin:/bin:\$PATH" && export OPENAI_API_KEY='${config.gemini.apiKey}' && export OPENAI_BASE_URL='https://generativelanguage.googleapis.com/v1beta/openai/' && export GEMINI_API_KEY='${config.gemini.apiKey}' && export GOOGLE_API_KEY='${config.gemini.apiKey}' && export GOOGLE_GENERATIVE_AI_API_KEY='${config.gemini.apiKey}' && gbrain put ${slug} < '${wslPath}'`
    ], {
      stdio: "ignore",
      timeout: 10000,
    });
  } else {
    const quotedPath = `'${filePath.replace(/'/g, "'\\''")}'`;
    execSync(`${GBRAIN_PATH} put ${slug} < ${quotedPath}`, {
      stdio: "ignore",
      shell: "/bin/bash",
      env: { ...process.env, ...GBRAIN_ENV },
      timeout: 10000,
    });
  }
}

/**
 * Store a document in GBrain.
 * @param {string} slug - Unique identifier
 * @param {string} content - Markdown content
 * @returns {boolean}
 */
export function storeDocument(slug, content) {
  const lowercaseSlug = slug.toLowerCase();
  // Write to OS temp dir
  const tmpFile = path.join(os.tmpdir(), `gbrain-${lowercaseSlug.replace(/[^a-z0-9-]/gi, "_")}.md`);
  fs.writeFileSync(tmpFile, content, "utf8");

  try {
    runGbrainPut(lowercaseSlug, tmpFile);
    return true;
  } catch (err) {
    console.error(`GBrain store failed for ${lowercaseSlug}:`, err.message);
    return false;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch { }
  }
}

/**
 * Search GBrain with a keyword/semantic query.
 * @param {string} query
 * @returns {string} Raw result text
 */
export function queryGBrain(query) {
  if (!query || query.trim().length === 0) return "";

  try {
    const escaped = query.replace(/"/g, '\\"').replace(/'/g, "\\'");
    return runGbrain(`query "${escaped}"`);
  } catch (err) {
    if (err.message.includes("ENOENT")) return "";

    // Fallback to keyword search if vector search fails
    try {
      const escaped = query.replace(/"/g, '\\"').replace(/'/g, "\\'");
      return runGbrain(`search "${escaped}"`);
    } catch (fallbackErr) {
      console.error("GBrain fallback search failed:", fallbackErr.message);
      return "";
    }
  }
}

/**
 * Check if a document slug already exists in GBrain.
 * @param {string} slug
 * @returns {boolean}
 */
export function documentExists(slug) {
  try {
    runGbrain(`get ${slug.toLowerCase()}`, { quiet: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Store an email in GBrain, skipping duplicates.
 * @param {object} email
 * @returns {boolean}
 */
export function storeEmail(email) {
  const slug = `email-${email.id}`;

  if (documentExists(slug)) return false;

  const content = `# Email: ${email.subject}

From: ${email.from}
To: ${email.to || ""}
Subject: ${email.subject}
Date: ${email.date}

${email.body || email.snippet || ""}
`;

  return storeDocument(slug, content);
}

/**
 * Parse raw GBrain result blocks into structured objects.
 * @param {string} raw - Raw stdout string from gbrain query/search
 * @returns {Array<{header: string, slug: string, bodyLines: string[]}>}
 */
export function parseGbrainResults(raw) {
  if (!raw || raw.trim().length === 0) return [];

  const matches = [];
  const lines = raw.split("\n");
  let currentMatch = null;

  for (const line of lines) {
    if (line.match(/^\[\d+\.\d+\]\s+\S+/)) {
      if (currentMatch) {
        matches.push(currentMatch);
      }

      const slugPart = line.split(" -- ")[0] || "";
      const slug = slugPart.substring(slugPart.indexOf(" ") + 1).trim();

      currentMatch = {
        header: line,
        slug: slug,
        bodyLines: []
      };
    } else if (currentMatch) {
      currentMatch.bodyLines.push(line);
    }
  }
  if (currentMatch) {
    matches.push(currentMatch);
  }
  return matches;
}

/**
 * Store a calendar event in GBrain, skipping duplicates.
 * @param {object} event - Calendar event object
 * @returns {boolean}
 */
export function storeCalendarEvent(event) {
  const slug = `calendar-${event.id}`;

  if (documentExists(slug)) return false;

  const startTime = event.start ? new Date(event.start).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }) : "All day";
  const endTime = event.end ? new Date(event.end).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";

  const content = `# Calendar Event: ${event.title}

Start: ${startTime}
End: ${endTime}
Location: ${event.location || "Not specified"}
Attendees: ${event.attendees || "None listed"}
Organizer: ${event.organizer || ""}
Meet Link: ${event.meetLink || "None"}

${event.description || "No description"}

---
_Source: Google Calendar | ID: ${event.id}_
`;

  return storeDocument(slug, content);
}

