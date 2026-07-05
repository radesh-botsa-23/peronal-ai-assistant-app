import { Client, GatewayIntentBits, Partials } from "discord.js";
import { config } from "./config.mjs";
import { processCommand } from "./agents/orchestrator.mjs";
import { getVoiceAttachment, downloadAttachment, transcribeAudio } from "./lib/voice-handler.mjs";
import { processMeetingBuffer } from "./agents/meeting-processor.mjs";

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

  console.log(`💬 Discord msg from ${message.author.tag} in channel ${message.channel.id} (Guild: ${message.guild?.name || "DM"}): "${message.content}"`);

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

  if (!userMessage || userMessage.length === 0) {
    // Check if it's a voice-only message (no text content)
    const voiceOnly = getVoiceAttachment(message);
    if (voiceOnly) {
      userMessage = ""; // Will be handled by voice processing below
    } else {
      return;
    }
  }

  try {
    // Show typing indicator
    await message.channel.sendTyping();

    // Check for voice message attachment
    const voiceAttachment = getVoiceAttachment(message);
    if (voiceAttachment) {
      // If message text contains "meeting" or file is >60s, process as meeting recording
      const isMeetingUpload = 
        userMessage.toLowerCase().includes("meeting") ||
        userMessage.toLowerCase().includes("recording") ||
        userMessage.toLowerCase().includes("transcript") ||
        (voiceAttachment.duration && voiceAttachment.duration > 60000);

      if (isMeetingUpload) {
        await message.reply("🎤 Processing meeting recording... This may take a minute.");
        try {
          const audioBuffer = await downloadAttachment(voiceAttachment.url);
          const metadata = {
            title: userMessage || "Discord Meeting Upload",
            participants: "",
            platform: "Uploaded via Discord",
            date: new Date().toISOString(),
          };
          const result = await processMeetingBuffer(audioBuffer, voiceAttachment.contentType, metadata);

          let reply = `✅ **Meeting Processed**\n\n`;
          reply += `**Summary:** ${result.analysis.summary}\n\n`;
          if (result.analysis.actionItems?.length > 0) {
            reply += `**Action Items:**\n${result.analysis.actionItems.map((a, i) => `${i + 1}. ${a}`).join("\n")}\n\n`;
          }
          if (result.analysis.decisions?.length > 0) {
            reply += `**Decisions:**\n${result.analysis.decisions.map((d, i) => `${i + 1}. ${d}`).join("\n")}\n\n`;
          }
          reply += `_Stored in memory for future meeting preparation._`;

          const chunks = splitMessage(reply);
          for (const chunk of chunks) {
            await message.reply(chunk);
          }
        } catch (err) {
          console.error("Meeting processing error:", err);
          await message.reply("⚠️ Failed to process meeting recording. Please try again.");
        }
        return;
      }

      // Handle as short voice command
      if (voiceAttachment.duration && voiceAttachment.duration > 60000) {
        await message.reply("⚠️ Voice message too long (max 60 seconds). Please send a shorter message or type your command.");
        return;
      }

      try {
        await message.channel.sendTyping();
        const audioBuffer = await downloadAttachment(voiceAttachment.url);
        const { text, confidence } = await transcribeAudio(audioBuffer, voiceAttachment.contentType);

        if (confidence < 0.7) {
          await message.reply(`⚠️ Couldn't understand clearly. Did you say: "${text}"?\nPlease type your command instead.`);
          return;
        }

        userMessage = text;
      } catch (err) {
        console.error("Voice transcription error:", err);
        await message.reply("⚠️ Voice transcription unavailable. Please type your command instead.");
        return;
      }
    }

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

// Start the bot with timeout and retries (do NOT crash the app on failure)
const DISCORD_LOGIN_TIMEOUT_MS = 15000;
const DISCORD_MAX_RETRIES = 3;
const DISCORD_RETRY_DELAY_MS = 10000;

function loginWithTimeout(token, timeoutMs) {
  return Promise.race([
    client.login(token),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Login timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}

async function startDiscord() {
  if (!config.discord.token) {
    console.warn("⚠️ [Discord] DISCORD_TOKEN not set — bot disabled.");
    return;
  }

  for (let attempt = 1; attempt <= DISCORD_MAX_RETRIES; attempt++) {
    console.log(`🔌 [Discord] Connecting... (attempt ${attempt}/${DISCORD_MAX_RETRIES})`);
    try {
      await loginWithTimeout(config.discord.token, DISCORD_LOGIN_TIMEOUT_MS);
      console.log("✅ [Discord] Bot connected successfully!");
      return; // success — stop retrying
    } catch (err) {
      console.warn(`⚠️ [Discord] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < DISCORD_MAX_RETRIES) {
        console.log(`   Retrying in ${DISCORD_RETRY_DELAY_MS / 1000}s...`);
        await new Promise((r) => setTimeout(r, DISCORD_RETRY_DELAY_MS));
      }
    }
  }

  console.warn("⚠️ [Discord] All connection attempts failed. Bot is disabled.");
  console.warn("   Other services (GBrain, Gmail, OpenClaw, WhatsApp) continue running.");
  console.warn("   This is expected on Hugging Face Spaces (outbound Discord connections are blocked).");
}

console.log("🤖 Starting Personal AI Assistant...");
startDiscord();
