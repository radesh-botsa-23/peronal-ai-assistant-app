# Personal AI Assistant — Deployment Status Snapshot
**Date:** July 6, 2026 01:26 IST | **Platform:** Hugging Face Spaces | **Commit:** `8bddc37`

---

## Current Service Status (on Hugging Face)

| Service | Status | Details |
|---|---|---|
| PostgreSQL | ✅ Running | Native server on port 5432, pgvector installed |
| GBrain | ✅ 85/100 | v0.42.56.0, 117 migrations, schema v122, Gemini embeddings |
| Gmail Ingestion | ✅ Working | 50 emails fetched and stored per cycle (30-min interval) |
| OpenClaw Gateway | ✅ Ready | 10 plugins, Gemini 2.5 Flash, port 18789 |
| WhatsApp Webhook | ✅ Running | Port 3002 |
| Discord Bot | ❌ Blocked | HF network blocks outbound to `162.159.x.x:443`. Logs 3 retry attempts then disables gracefully |
| Telegram Bot | ❌ Blocked | HF network blocks outbound to `api.telegram.org`. OpenClaw handles this with timeout warnings |
| App Stability | ✅ Stable | No crashes, no restart loops |

---

## All Fixes Applied (Chronological)

### 1. WASM W^X Crash → Native PostgreSQL
- **Problem:** PGlite (WASM Postgres) violated W^X memory protections on Railway/HF
- **Fix:** Replaced with native PostgreSQL (`apt-get install postgresql`) running inside the container
- **Files:** [Dockerfile](file:///c:/Users/botsa/email-collector/Dockerfile), [start.mjs](file:///c:/Users/botsa/email-collector/start.mjs)

### 2. Git LFS Binary Rejection → Base64 ZIP Seed
- **Problem:** HF rejected large binary seed files via Git LFS
- **Fix:** Packed seed data as Base64 ZIP with Python extractor script
- **Files:** `gbrain-seed.zip.base64`, [scripts/extract-seed.py](file:///c:/Users/botsa/email-collector/scripts/extract-seed.py)

### 3. PostgreSQL Socket Permissions → `/tmp` Socket
- **Problem:** Unix socket directory not writable by `node` user
- **Fix:** Added `-k /tmp` to `pg_ctl` start command
- **Files:** [start.mjs](file:///c:/Users/botsa/email-collector/start.mjs)

### 4. Unknown Role Error → Explicit `node` User
- **Problem:** `createdb` didn't know which PostgreSQL role to use
- **Fix:** Added `-U node` and `-h /tmp` to all `createdb`/`psql` commands
- **Files:** [start.mjs](file:///c:/Users/botsa/email-collector/start.mjs)

### 5. pgvector Not Available → Build from Source
- **Problem:** `postgresql-*-pgvector` not in Debian Bookworm apt repos
- **Fix:** Built pgvector v0.8.0 from source in Dockerfile using `postgresql-server-dev-*` headers
- **Files:** [Dockerfile](file:///c:/Users/botsa/email-collector/Dockerfile) (lines 46-51)

### 6. Embedding Model CLI Rejection → Direct JSON Write
- **Problem:** GBrain v0.42+ rejects `gbrain config set embedding_model` via CLI
- **Fix:** Write `embedding_model` directly into `~/.gbrain/config.json`
- **Files:** [start.mjs](file:///c:/Users/botsa/email-collector/start.mjs)

### 7. `page_not_found` Stderr Spam → Quiet Mode
- **Problem:** `documentExists()` calls `gbrain get` which prints noisy errors to stderr on a fresh DB
- **Fix:** Added `{ quiet: true }` option to suppress stderr in `runGbrain()`
- **Files:** [lib/gbrain-client.mjs](file:///c:/Users/botsa/email-collector/lib/gbrain-client.mjs)

### 8. Discord `process.exit(1)` → Graceful Degradation
- **Problem:** Discord connection timeout killed the entire app including all other services
- **Fix:** Removed `process.exit(1)`, added 15s timeout + 3 retries with clear logging
- **Files:** [discord-bot.mjs](file:///c:/Users/botsa/email-collector/discord-bot.mjs)

### 9. PostgreSQL Stale PID → Cleanup on Start
- **Problem:** Ungraceful container restarts left `postmaster.pid`, preventing server from starting
- **Fix:** Remove stale PID file before `pg_ctl start`; added `pg_ctl stop -m fast` to shutdown handler
- **Files:** [start.mjs](file:///c:/Users/botsa/email-collector/start.mjs)

---

## Remaining Items (Not Bugs — Platform Limitations)

### Discord & Telegram Cannot Connect from Hugging Face
- **Root Cause:** HF Spaces free tier blocks outbound WebSocket/HTTPS to Discord (`162.159.x.x`) and Telegram (`api.telegram.org`)
- **Solution Options:**
  1. Deploy on **Railway** (unrestricted outbound networking) — your friend's setup
  2. Use **HF Spaces Pro** (may have fewer restrictions)
  3. Run Discord/Telegram bots separately on a VPS and connect to HF via API

### GBrain Recommended Skills (Not Installed)
9 skills are available but not yet installed:
- `book-mirror`, `article-enrichment`, `strategic-reading`, `concept-synthesis`
- `perplexity-research`, `archive-crawler`, `academic-verify`, `brain-pdf`, `voice-note-ingest`
- **Install command:** `gbrain skillpack scaffold --all`

### Gemini API Rate Limits
- Free tier quota: 20 requests/day for `gemini-3.5-flash`
- Seen in logs as `429 Too Many Requests`
- **Solution:** Upgrade to a paid Gemini API plan or reduce request frequency

---

## Key Files Modified

| File | Purpose |
|---|---|
| [Dockerfile](file:///c:/Users/botsa/email-collector/Dockerfile) | Container build with native PostgreSQL + pgvector |
| [start.mjs](file:///c:/Users/botsa/email-collector/start.mjs) | Startup orchestration: PG init, GBrain config, service launcher |
| [discord-bot.mjs](file:///c:/Users/botsa/email-collector/discord-bot.mjs) | Discord bot with timeout/retry/graceful degradation |
| [lib/gbrain-client.mjs](file:///c:/Users/botsa/email-collector/lib/gbrain-client.mjs) | GBrain CLI wrapper with quiet mode for stderr |

---

## Git Remotes

| Remote | URL | Branch |
|---|---|---|
| `origin` | `github.com/Botsa-Radesh/Personal_Ai_Assistant_Internship` | `main` |
| `hf` | `huggingface.co/spaces/BotsaRadesh23/personal-ai-assistant` | `main` (force-pushed from orphan `hf-deploy`) |

## Deploy Workflow
```bash
# 1. Commit to GitHub
git add . && git commit -m "message" && git push origin main

# 2. Deploy to Hugging Face
git checkout --orphan hf-deploy
git add . && git add --renormalize .
git commit -m "deploy to hugging face"
git push hf hf-deploy:main --force
git checkout main && git branch -D hf-deploy
```
