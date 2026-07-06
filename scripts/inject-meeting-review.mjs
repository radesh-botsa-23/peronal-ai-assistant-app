import { analyzeMeeting } from "../lib/meeting-summarizer.mjs";
import { storeDocument, documentExists } from "../lib/gbrain-client.mjs";

const meetingId = "meeting-project-review-101";

const transcript = `
Anil: Good morning Radesh and Sameer. Let's start our project review for the Personal AI Assistant. Radesh, what is the status of the Gmail and PostgreSQL integration?
Radesh: Good morning Anil. I have successfully resolved the database crashes on Railway. Previously, PGlite WebAssembly was hitting W^X memory restrictions. I migrated the codebase to support dynamic external PostgreSQL via the DATABASE_URL environment variable. I also refreshed our Gmail credentials and updated GMAIL_TOKEN_JSON on Railway, so the 30-minute ingestion pipeline is now fully operational and fetching emails.
Anil: Excellent work, Radesh. That database crash was a major blocker. Sameer, what about the LLM connectivity and the OpenClaw Gateway?
Sameer: Hi Anil. We had some 503 capacity issues with the old gemini-flash-latest model. I switched the direct SDK models in all our transcribers, summarizers, and client configurations to gemini-2.5-flash. It has been highly stable. OpenClaw Gateway is now running successfully on port 18789, and we successfully connected the Telegram provider too.
Anil: Great. How is the WhatsApp Webhook integration coming along?
Radesh: I generated a public domain on Railway (peronal-ai-assistant-app-production.up.railway.app) and set up the webhook on Meta's developer portal. Verification succeeded, and we subscribed to message events. Sameer and I tested it, and the webhook successfully parses incoming messages and routes them through the orchestrator.
Anil: Good. Let's make some decisions. First, we will officially lock Railway as our production platform and use the managed PostgreSQL service. Second, gemini-2.5-flash is our default model for the entire stack. Agreed?
Sameer: Agreed. It performs really well with speech-to-text.
Radesh: Agreed. It solved our rate-limiting problems.
Anil: Perfect, those decisions are locked. Let's discuss action items. Radesh, please monitor the ingestion pipeline logs over the next 24 hours to ensure the Gmail credentials do not expire again.
Radesh: Sure, I will keep an eye on it.
Anil: Sameer, please test the voice-transcription capability with actual audio recordings of our meetings and report the accuracy.
Sameer: Will do, I'll record our next sync and feed it into the bot.
Anil: I will handle the API keys budget sign-off. Let's meet next Monday to review. Thanks everyone!
`;

const metadata = {
  title: "Personal AI Assistant Project Status & Deployment Review",
  participants: "Anil, Radesh, Sameer",
  platform: "Google Meet",
  date: new Date().toISOString(),
  duration: "60 minutes"
};

async function run() {
  console.log("🚀 Starting project review meeting ingestion...");
  
  if (documentExists(meetingId)) {
    console.log(`⏭️ Meeting ${meetingId} already exists in GBrain. Skipping injection.`);
    return;
  }

  try {
    console.log("Analyzing transcript with Gemini...");
    const analysis = await analyzeMeeting(transcript, metadata);
    
    console.log("Structuring meeting document...");
    const title = metadata.title;
    const date = metadata.date;
    const platform = metadata.platform;
    const participants = metadata.participants;
    
    const content = `# Meeting: ${title}

**Date:** ${date}
**Platform:** ${platform}
**Participants:** ${participants}
**Duration:** ${metadata.duration}

## Summary
${analysis.summary || "No summary generated"}

## Action Items
${(analysis.actionItems || []).map((item, i) => `${i + 1}. ${item}`).join("\n") || "None identified"}

## Decisions Made
${(analysis.decisions || []).map((d, i) => `${i + 1}. ${d}`).join("\n") || "None recorded"}

## Topics Discussed
${(analysis.topics || []).map(t => `- ${t}`).join("\n") || "Not available"}

## Key Points
${analysis.keyPoints || "Not available"}

## Follow-ups for Next Meeting
${(analysis.followUps || []).map(f => `- ${f}`).join("\n") || "None"}

## Raw Transcript
${transcript.trim()}

---
_Source: Meeting Recording | Platform: ${platform} | ID: ${meetingId}_
`;

    console.log("Storing meeting summary in GBrain...");
    const stored = storeDocument(meetingId, content);
    
    if (stored) {
      console.log(`✅ Stored successfully in GBrain with ID: ${meetingId}`);
    } else {
      console.error("❌ Failed to store document in GBrain.");
    }
  } catch (err) {
    console.error("Error during ingestion:", err.message);
  }
}

run();
