# Personal AI Assistant — Complete Project Overview

## Architecture

```
User (Discord / WhatsApp / Voice)
            ↓
      OpenClaw Gateway
      (Agent Runtime - WSL systemd service)
            ↓
      Discord Bot (discord-bot.mjs)
            ↓
      GStack Orchestrator (agents/orchestrator.mjs)
      (Intent parsing via Gemini → route to right agent)
            ↓
    ┌───────┬──────────┬───────────┬─────────────┬──────────────┐
    ↓       ↓          ↓           ↓             ↓              ↓
  Email   Memory    Calendar   WhatsApp     Meetings       Summary
  Agent   Agent      Agent      Agent        Agent          Agent
    ↓       ↓          ↓           ↓             ↓              ↓
                      GBrain (Knowledge Base - PGLite)
                            ↓
                     Gemini 1.5 Flash (LLM)
                            ↓
              Response → Discord / WhatsApp
```

---

## Data Flow

### Email Flow (Automated every 30 min)
```
Gmail API → fetchEmails() → full body extraction
         → OpenClaw memory files (~/.openclaw/workspace/memory/)
         → GBrain (gbrain import --no-embed)
         → Available for search/summarize/action items
```

### User Query Flow (Real-time)
```
User types in Discord
         → OpenClaw agent receives message
         → parseIntent() via Gemini
         → Routed to correct agent
         → Agent queries GBrain
         → Results passed to Gemini for formatting
         → Response delivered to Discord
```

### WhatsApp Flow (Webhook-based)
```
WhatsApp message received
         → Webhook server (port 3002)
         → Message stored in GBrain
         → If query detected → Gemini answers from GBrain
         → Response sent back via WhatsApp API
```

### Meeting Recording Flow (Manual upload)
```
Meeting audio file (.mp3/.wav/.webm)
         → Gemini 1.5 Flash (transcription)
         → Gemini (analysis: summary + action items + decisions)
         → GBrain (stored with participants, date, topics)
         → Available for meeting prep queries
```

### Daily Report Flow (Automated 8 AM)
```
Cron triggers → daily-report-cron.mjs
         → GBrain query (emails + tasks)
         → Google Calendar (today's events)
         → Gemini (formats structured report)
         → Delivered to Discord channel
```

---

## File Structure & Purpose

### Entry Points
| File | Purpose |
|------|---------|
| `start.mjs` | Starts Discord bot + ingestion pipeline + WhatsApp webhook (if token set) |
| `discord-bot.mjs` | Discord.js bot — listens for messages, handles voice/meeting uploads, routes to orchestrator |
| `whatsapp-webhook.mjs` | HTTP server (port 3002) — receives WhatsApp messages via Meta webhook |
| `ingestion-pipeline.mjs` | Scheduled Gmail fetch → GBrain storage (every 30 min when running via `start.mjs`) |
| `config.mjs` | Centralized config — reads from `.env` file |
| `gmail-auth.mjs` | One-time OAuth2 authentication for Gmail + Calendar |

### Agents (`agents/`)
| File | Purpose |
|------|---------|
| `orchestrator.mjs` | **GStack** — parses user intent with Gemini, routes to correct agent |
| `email-agent.mjs` | Searches/summarizes emails from GBrain; extracts action items |
| `memory-agent.mjs` | Cross-source GBrain search; basic meeting context |
| `calendar-agent.mjs` | Google Calendar — today's meetings, upcoming events |
| `summary-agent.mjs` | Daily productivity report (emails + calendar + tasks) |
| `whatsapp-agent.mjs` | Store/search WhatsApp messages; respond to queries |
| `meetings-agent.mjs` | Fireflies.ai integration (optional) + GBrain fallback for meeting summaries |
| `meeting-processor.mjs` | Custom meeting pipeline: audio → transcription → analysis → GBrain |

### Libraries (`lib/`)
| File | Purpose |
|------|---------|
| `gmail-client.mjs` | Gmail API — fetches full email body (text/html), handles auth |
| `calendar-client.mjs` | Google Calendar API — events by date/range |
| `gemini-client.mjs` | Gemini 1.5 Flash — intent parsing, summarization, meeting briefs, daily reports |
| `gbrain-client.mjs` | GBrain CLI wrapper — search, store, check duplicates (Windows/WSL aware) |
| `whatsapp-client.mjs` | Meta WhatsApp Business API — send messages, parse webhooks |
| `voice-handler.mjs` | Detects Discord voice attachments, transcribes with Gemini 2.0 Flash Lite |
| `meeting-transcriber.mjs` | Transcribes audio files/buffers using Gemini multimodal |
| `meeting-summarizer.mjs` | Extracts summary, action items, decisions, topics from raw transcript |
| `fireflies-client.mjs` | Fireflies.ai GraphQL API — fetch meeting transcripts (optional) |
| `openclaw-client.mjs` | OpenClaw CLI wrapper — send messages, check gateway status |

### Scripts (`scripts/`)
| File | Purpose |
|------|---------|
| `ingest-emails-to-memory.mjs` | Cron script — Gmail → OpenClaw memory + GBrain sync |
| `sync-to-gbrain.sh` | Batch import from OpenClaw memory dir into GBrain |
| `daily-report-cron.mjs` | Cron script — generates and sends 8 AM daily report to Discord |
| `process-meeting.mjs` | CLI tool — process a meeting audio file: `node scripts/process-meeting.mjs recording.mp3` |
| `reimport-gbrain.sh` | Re-imports all emails into GBrain (run after GBrain reset) |
| `setup-workspace.sh` | Sets up OpenClaw workspace files (AGENTS.md, TOOLS.md) |
| `update-agents-md.sh` | Updates OpenClaw AGENTS.md with email assistant instructions |
| `update-tools-md.sh` | Updates OpenClaw TOOLS.md with gbrain tool info |
| `get-keys.py` | Extracts API keys from OpenClaw to populate .env |

---

## Discord Commands (What Users Can Type)

### Emails
- `search emails about [topic]` — semantic search in GBrain
- `search emails from [sender]` — filter by sender
- `summarize today's emails` — AI summary of recent emails
- `show important emails` — priority-ranked urgent emails
- `show pending action items` — extract tasks and deadlines from emails

### Calendar & Meetings
- `what meetings do I have today` — Google Calendar events
- `upcoming meetings` — next 24h from Google Calendar
- `prepare me for [meeting/person]` — brief using previous meetings + emails
- `show recent meetings` — stored meeting summaries from GBrain

### Reports
- `give me my daily report` — emails + calendar + tasks in one report

### WhatsApp
- `search WhatsApp about [topic]` — search stored WhatsApp messages
- `summarize WhatsApp chat` — summarize recent WhatsApp messages

### General
- `what do I know about [topic]` — search all sources in GBrain

---

## Active Scheduled Jobs (cron in WSL)

```
*/30 * * * *   run.sh                    → Gmail fetch + digest + Discord notification
*/30 * * * *   ingest-emails-to-memory   → Gmail → OpenClaw memory + GBrain sync
0    8 * * *   daily-report-cron.mjs     → Morning productivity report to Discord
```

---

## Services Running

| Service | How It Runs | Status |
|---------|------------|--------|
| OpenClaw Gateway | systemd user service (WSL) | Auto-start on WSL boot |
| Discord Bot | Via OpenClaw plugin | Managed by gateway |
| Email Ingestion | Cron (WSL) | Every 30 min |
| GBrain | PGLite (local file DB) | `~/.gbrain/brain.pglite` |
| WhatsApp Webhook | `node whatsapp-webhook.mjs` | Manual start (port 3002) |

---

## Current Limitations

| Limitation | Reason | Workaround |
|-----------|--------|-----------|
| GBrain vector search | Google embedding model incompatible with GBrain's API format | Uses keyword (FTS) search |
| Meeting audio capture | Cannot auto-capture live audio from Meet/Teams/Zoom | Upload recording file manually |
| Teams integration | Requires Microsoft org account | Not implemented |
| WhatsApp webhook | ngrok URL changes on restart (free plan) | Use fixed domain or paid ngrok |
| Discord bot offline | Ollama service causes CPU spikes | Run `sudo systemctl disable ollama` |

---

## Future Actions to Complete

### Priority 1 — Immediate (can do now)
- [ ] **Configure WhatsApp webhook** in Meta Developer Console
  - Start ngrok: `npx ngrok http 3002`
  - Set callback URL: `https://YOUR-NGROK-URL/webhook`
  - Verify token: `personal_ai_assistant_verify`
  - Subscribe to `messages` field
- [ ] **Add meetings to Google Calendar** to test calendar features
- [ ] **Upload a meeting recording** to test the custom transcription agent

### Priority 2 — Enhancement
- [ ] **System audio capture agent** — Python script that records laptop audio during meetings automatically
- [ ] **Persistent ngrok URL** — Use ngrok paid plan or alternative like `localtunnel` for stable WhatsApp webhook URL
- [ ] **Fireflies.ai API key** — Add to `.env` as `FIREFLIES_API_KEY` if you have an account for richer meeting data
- [ ] **OpenAI embeddings key** — Add to enable semantic vector search in GBrain (currently using keyword FTS)

### Priority 3 — Future Features
- [ ] **Microsoft Teams** — Requires Microsoft 365 org account
- [ ] **WhatsApp message history import** — Bulk import existing chat exports
- [ ] **Voice-to-command in Discord** — Working for uploaded voice files; extend to voice channels
- [ ] **Reminder system** — "remind me about [task] at [time]" using OpenClaw cron
- [ ] **Email reply drafting** — "draft a reply to [email subject]" using Gemini

---

## Quick Start (Fresh Machine)

```bash
# 1. Install dependencies
npm install

# 2. Authenticate Gmail + Calendar (opens browser)
node gmail-auth.mjs

# 3. Ingest emails into GBrain
wsl bash scripts/sync-to-gbrain.sh

# 4. Start everything
npm start

# 5. (Optional) Start WhatsApp webhook
npm run whatsapp
```

---

## Key File Paths (WSL)

```
GBrain DB:         ~/.gbrain/brain.pglite
OpenClaw config:   ~/.openclaw/openclaw.json
OpenClaw memory:   ~/.openclaw/workspace/memory/
Gmail token:       ./token.json
Gmail credentials: ./credentials.json
Environment:       ./.env
Cron log:          ./cron.log
```
