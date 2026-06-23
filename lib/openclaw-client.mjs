import { execSync } from "child_process";

/**
 * OpenClaw Client - Interfaces with the OpenClaw agent runtime.
 * Used for sending/receiving messages through OpenClaw's communication layer.
 */

/**
 * Send a message through OpenClaw to a specific channel.
 * @param {string} channel - Channel type (e.g., "discord")
 * @param {string} target - Target identifier (e.g., "channel:123456")
 * @param {string} message - Message content
 * @returns {boolean}
 */
export function sendMessage(channel, target, message) {
  try {
    execSync(
      `openclaw message send --channel ${channel} --target ${target} --message "${message.replace(/"/g, '\\"')}"`,
      { stdio: "ignore", timeout: 10000 }
    );
    return true;
  } catch (err) {
    console.error("OpenClaw send failed:", err.message);
    return false;
  }
}

/**
 * Register an agent workflow with OpenClaw.
 * @param {string} agentName - Name of the agent
 * @param {string} description - Agent description
 * @returns {boolean}
 */
export function registerAgent(agentName, description) {
  try {
    execSync(
      `openclaw agent register --name ${agentName} --description "${description}"`,
      { stdio: "ignore", timeout: 5000 }
    );
    return true;
  } catch (err) {
    // Agent may already be registered
    return false;
  }
}

/**
 * Check if OpenClaw is running and reachable.
 * @returns {boolean}
 */
export function isOpenClawAvailable() {
  try {
    execSync("openclaw status", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
