import { storeDocument, documentExists } from "../lib/gbrain-client.mjs";

const meetingId = "meeting-final-review-submission-202";

const transcript = `
Anil: Good morning everyone. Let's start our final review and submission meeting for the Personal AI Assistant project. Thank you both for joining. Radesh, can you walk me through what you've built end to end?

Radesh: Good morning Anil. Absolutely. So the Personal AI Assistant is a multi-channel AI-powered productivity tool. At its core, it connects Gmail, Google Calendar, Discord, WhatsApp, and Telegram into a single intelligent assistant powered by Gemini 2.5 Flash.

Anil: Let's go feature by feature. Start with the email pipeline.

Radesh: Sure. The email pipeline runs automatically every 30 minutes. It fetches up to 50 emails from Gmail using the Gmail API with full OAuth2 authentication. Each email is extracted with its full body, not just the snippet. The emails are then deduplicated and stored in GBrain, which is our PostgreSQL-backed knowledge base with vector search capability. After ingestion, it automatically generates a Smart Email Digest that categorizes emails into Action Required, Important, and Promotions, and delivers this digest to our Discord channel via the Discord REST API.

Anil: That's impressive. How does the user interact with these emails?

Radesh: Through natural language commands on Discord. Users can type things like "search emails about security", "summarize today's emails", "show important emails", or "show pending action items". The GStack Orchestrator parses the user's intent using Gemini and routes it to the right agent. The Email Agent then queries GBrain and formats the response using Gemini for a clean, readable output.

Anil: Good. Sameer, tell me about the meeting recording pipeline.

Sameer: Thanks Anil. The meeting pipeline accepts audio file uploads directly in Discord. When someone uploads an MP3, WAV, or WebM file, the bot detects it as a meeting recording and processes it through a three-stage pipeline. First, Gemini 2.5 Flash transcribes the audio to text. Then it runs a detailed analysis extracting the summary, action items, decisions made, topics discussed, and follow-up items. Finally, everything is stored in GBrain so users can later ask questions like "show recent meetings" or "what were the action items from last meeting".

Anil: What about the voice note feature?

Sameer: For voice notes, we have a dedicated voice handler that detects short audio attachments in Discord. It transcribes them using Gemini and treats the transcription as a regular text message to the orchestrator. So someone can send a voice note saying "what meetings do I have tomorrow" and it will be processed just like a text command.

Anil: Excellent. Radesh, talk to me about the calendar integration.

Radesh: The Google Calendar Agent connects via the Google Calendar API with read-only scope. It can show today's meetings, upcoming meetings in the next 24 or 48 hours, and even help prepare for a meeting by pulling up related emails and previous meeting notes about the same participants or topics. Calendar events are also ingested into GBrain every 30 minutes as part of the ingestion pipeline, so they're searchable alongside emails and meeting notes.

Anil: What about the daily productivity report?

Sameer: The daily productivity report is generated automatically at 8 AM every morning. It combines data from three sources: recent emails summarized by category, today's calendar events, and any pending action items extracted from previous meetings and emails. It creates a structured morning briefing and delivers it to Discord. This helps the user start their day with a clear picture of what needs attention.

Anil: Let's talk about deployment. Where is this running?

Radesh: We deployed on multiple platforms during development. The primary production deployment is on Railway with a managed PostgreSQL database. We also tested on Hugging Face Spaces but hit network restrictions there, specifically Discord and Telegram outbound connections are blocked on the free tier. Railway has been our most reliable platform with full unrestricted networking.

Anil: What about the technology stack?

Sameer: The entire backend is Node.js 22 with ES modules. We use Discord.js v14 for the bot, googleapis for Gmail and Calendar, the Google Generative AI SDK for Gemini interactions, and GBrain as our knowledge base which runs on PostgreSQL with pgvector for semantic search. OpenClaw serves as the agent gateway runtime managing all the plugins and channels. The Dockerfile handles containerized deployment with native PostgreSQL and pgvector built from source.

Anil: What were the biggest challenges you faced?

Radesh: The biggest challenge was the database crashes during deployment. PGlite, which is a WebAssembly-based PostgreSQL, violated W^X memory protections on both Railway and Hugging Face. We had to completely rearchitect the database layer to use native PostgreSQL instead. That involved modifying the Dockerfile, the startup script, and the GBrain configuration. Another major challenge was Gmail credential management across environments. The OAuth2 tokens expire and need to be stored securely as environment variables rather than files in the container.

Sameer: On my side, the biggest challenge was Gemini API stability. We hit rate limits with the free tier, encountered 503 capacity errors with older model versions, and had to handle graceful degradation when the API was unavailable. We implemented retry logic with exponential backoff across all Gemini interactions. The voice transcription accuracy was also something we had to tune by choosing the right model and prompt engineering.

Anil: Let me make some final decisions. First, the project is approved for final submission as a working prototype. The core features of email management, calendar integration, meeting processing, voice transcription, and multi-channel support are all functional. Second, the documentation including the PROJECT_OVERVIEW.md and README.md are comprehensive and should be included in the submission. Third, we will submit with Railway as the recommended deployment platform.

Radesh: Thank you Anil. Should we prepare a demo video?

Anil: Yes, that's a good idea. Let me assign final action items. Radesh, prepare a 5-minute demo video showing the key features working end to end, including the email search, calendar queries, and meeting upload. Make sure the Discord bot is running during the demo.

Radesh: Got it, I'll record that by Wednesday.

Anil: Sameer, write a brief section in the README about the voice and meeting features, including the supported audio formats and any limitations. Also run a final test of the meeting pipeline with a real recording.

Sameer: Will do. I'll also make sure the error handling is clean for edge cases like unsupported audio formats.

Anil: I will handle the final submission on the university portal and coordinate with the evaluation panel. The submission deadline is Friday July 11th. Let's have a final check-in on Thursday to make sure everything is ready.

Radesh: Sounds good.

Sameer: Works for me.

Anil: One more thing. I want to acknowledge that this project demonstrates a genuine understanding of modern AI application architecture. The multi-agent design with GBrain as a unified knowledge base, Gemini as the reasoning engine, and OpenClaw as the gateway runtime is well thought out. Great work, both of you.

Radesh: Thank you Anil, it's been a great learning experience.

Sameer: Really appreciate that, Anil. Looking forward to the final presentation.

Anil: Alright, meeting adjourned. Have a productive week everyone.
`;

const metadata = {
  title: "Personal AI Assistant — Final Review & Submission Meeting",
  participants: "Anil (Manager), Radesh (Developer), Sameer (Developer)",
  platform: "Google Meet",
  date: "2026-07-06T11:00:00+05:30",
  duration: "60 minutes"
};

// Pre-built analysis (no Gemini call needed — ensures it works even when API is rate-limited)
const analysis = {
  summary: "Final review meeting for the Personal AI Assistant internship project. Anil (Manager) reviewed the complete system with developers Radesh and Sameer. The project was approved for final submission as a working prototype. All core features — email pipeline (30-min ingestion + digest), Google Calendar integration, meeting recording pipeline (audio → transcript → analysis → GBrain), voice note transcription, daily productivity reports, and multi-channel support (Discord, WhatsApp, Telegram) — were confirmed functional. Railway was chosen as the recommended production deployment platform. Final submission deadline is Friday July 11th.",
  actionItems: [
    "Radesh: Prepare a 5-minute demo video showing email search, calendar queries, and meeting upload features by Wednesday",
    "Radesh: Ensure the Discord bot is running during the demo recording",
    "Sameer: Write a README section covering voice and meeting features, supported audio formats, and limitations",
    "Sameer: Run a final test of the meeting pipeline with a real recording",
    "Sameer: Clean up error handling for edge cases like unsupported audio formats",
    "Anil: Handle final submission on the university portal",
    "Anil: Coordinate with the evaluation panel for the presentation",
    "All: Final check-in meeting on Thursday before Friday July 11th deadline"
  ],
  decisions: [
    "Project approved for final submission as a working prototype",
    "Railway is the recommended production deployment platform",
    "PROJECT_OVERVIEW.md and README.md to be included in submission",
    "A 5-minute demo video will be created for the submission",
    "Final submission deadline: Friday July 11th, 2026",
    "Gemini 2.5 Flash confirmed as the default model for the entire stack"
  ],
  topics: [
    "Email ingestion pipeline (30-min Gmail fetch, digest, Discord delivery)",
    "Meeting recording pipeline (audio → transcription → analysis → GBrain)",
    "Voice note transcription via Gemini",
    "Google Calendar integration and daily productivity report",
    "Deployment architecture (Railway, Hugging Face, Docker)",
    "Technology stack overview (Node.js, Discord.js, Gemini, GBrain, OpenClaw)",
    "Challenges faced (PGlite W^X crashes, OAuth2 credential management, Gemini rate limits)",
    "Final submission planning and action items"
  ],
  keyPoints: `
- The email pipeline fetches 50 emails every 30 minutes, stores them in GBrain, generates a Smart Email Digest, and sends it to Discord.
- The meeting pipeline supports MP3, WAV, and WebM uploads; transcribes with Gemini; extracts summary, action items, decisions, and topics; stores everything in GBrain.
- Voice notes in Discord are transcribed and treated as regular text commands.
- The daily productivity report runs at 8 AM, combining emails, calendar events, and pending action items.
- Deployment on Railway with managed PostgreSQL is the recommended production setup.
- The project demonstrates multi-agent architecture with GBrain as unified knowledge base, Gemini as reasoning engine, and OpenClaw as the gateway runtime.
`.trim(),
  followUps: [
    "Review demo video before submission on Thursday",
    "Verify all documentation is complete and up-to-date",
    "Confirm Railway deployment is stable and all services are running",
    "Prepare for evaluation panel presentation after submission"
  ]
};

async function run() {
  console.log("🚀 Starting final review meeting ingestion...");

  if (documentExists(meetingId)) {
    console.log(`⏭️ Meeting ${meetingId} already exists in GBrain. Skipping injection.`);
    return;
  }

  try {
    const title = metadata.title;
    const date = metadata.date;
    const platform = metadata.platform;
    const participants = metadata.participants;

    const actionItemsStr = analysis.actionItems.map((item, i) => `${i + 1}. ${item}`).join("\n");
    const decisionsStr = analysis.decisions.map((d, i) => `${i + 1}. ${d}`).join("\n");
    const topicsStr = analysis.topics.map(t => `- ${t}`).join("\n");
    const followUpsStr = analysis.followUps.map(f => `- ${f}`).join("\n");

    const content = [
      `# Meeting: ${title}`,
      "",
      `**Date:** ${date}`,
      `**Platform:** ${platform}`,
      `**Participants:** ${participants}`,
      `**Duration:** ${metadata.duration}`,
      "",
      "## Summary",
      analysis.summary,
      "",
      "## Action Items",
      actionItemsStr,
      "",
      "## Decisions Made",
      decisionsStr,
      "",
      "## Topics Discussed",
      topicsStr,
      "",
      "## Key Points",
      analysis.keyPoints,
      "",
      "## Follow-ups for Next Meeting",
      followUpsStr,
      "",
      "## Raw Transcript",
      transcript.trim(),
      "",
      "---",
      `_Source: Meeting Recording | Platform: ${platform} | ID: ${meetingId}_`,
    ].join("\n");

    console.log("Storing meeting summary in GBrain...");
    const stored = storeDocument(meetingId, content);

    if (stored) {
      console.log("✅ Meeting stored successfully in GBrain with ID: " + meetingId);
      console.log("📋 Summary: " + analysis.summary.substring(0, 200) + "...");
      console.log("📌 Action Items: " + analysis.actionItems.length);
      console.log("🔒 Decisions: " + analysis.decisions.length);
    } else {
      console.error("❌ Failed to store document in GBrain.");
    }
  } catch (err) {
    console.error("Error during ingestion:", err.message);
  }
}

run();
