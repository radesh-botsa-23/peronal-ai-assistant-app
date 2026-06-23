import { Client, GatewayIntentBits, Partials } from "discord.js";
import { config } from "./config.mjs";
import { processCommand } from "./agents/orchestrator.mjs";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const MAX_DISCORD_LENGTH = 2000;

/**
 * Split a long message into chunks that fit Discord's 2000 char limit.
 */
function splitMessage(text) {
  if (text.length <= MAX_DISCORD_LENGTH) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_DISCORD_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitIndex = remaining.lastIndexOf("\n", MAX_DISCORD_LENGTH);
    if (splitIndex === -1 || splitIndex < MAX_DISCORD_LENGTH / 2) {
      // Fall back to splitting at space
      splitIndex = remaining.lastIndexOf(" ", MAX_DISCORD_LENGTH);
    }
    if (splitIndex === -1) {
      splitIndex = MAX_DISCORD_LENGTH;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trimStart();
  }

  return chunks;
}

client.on("ready", () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Only respond in the configured channel or DMs
  const isConfiguredChannel = message.channel.id === config.discord.channelId;
  const isDM = !message.guild;
  const isMentioned = message.mentions.has(client.user);

  if (!isConfiguredChannel && !isDM && !isMentioned) return;

  // Remove bot mention from message if present
  let userMessage = message.content;
  if (isMentioned) {
    userMessage = userMessage.replace(/<@!?\d+>/g, "").trim();
  }

  if (!userMessage || userMessage.length === 0) return;

  try {
    // Show typing indicator
    await message.channel.sendTyping();

    // Process through orchestrator (OpenClaw -> GStack -> Agents)
    const response = await processCommand(userMessage);

    // Split and send response
    const chunks = splitMessage(response);
    for (const chunk of chunks) {
      await message.reply(chunk);
    }
  } catch (err) {
    console.error("Error processing message:", err);
    await message.reply(
      "⚠️ Service temporarily unavailable. Please try again in a moment."
    );
  }
});

// Start the bot
client.login(config.discord.token).catch((err) => {
  console.error("Failed to login to Discord:", err.message);
  console.error("Make sure DISCORD_TOKEN is set in your .env file.");
  process.exit(1);
});

console.log("🤖 Starting Personal AI Assistant...");
