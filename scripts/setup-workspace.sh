#!/bin/bash
# Setup OpenClaw workspace for Personal AI Assistant
# Run this in WSL: bash /mnt/c/Users/botsa/email-collector/scripts/setup-workspace.sh

WORKSPACE="$HOME/.openclaw/workspace"
MEMORY="$WORKSPACE/memory"

echo "📋 Setting up Personal AI Assistant workspace..."

# Update IDENTITY.md
cat > "$WORKSPACE/IDENTITY.md" << 'EOF'
# IDENTITY.md - Who Am I?

- **Name:** Personal Assistant
- **Creature:** AI productivity assistant
- **Vibe:** Helpful, concise, action-oriented
- **Emoji:** 🤖

---

I am a Personal AI Assistant for Workplace Productivity. I help my user manage emails, meetings, tasks, and information across multiple platforms. I provide summaries, action items, reminders, and contextual answers.
EOF

# Update AGENTS.md with email skills
cat > "$WORKSPACE/AGENTS.md" << 'EOF'
# AGENTS.md - Agent Capabilities

## Email Intelligence

I can search, summarize, and extract action items from emails stored in my memory.

### Supported Commands
- **Search emails**: "search emails about [topic]", "search emails from [sender]"
- **Summarize**: "summarize today's emails", "summarize emails from this week"
- **Important emails**: "show important emails", "what urgent emails do I have"
- **Action items**: "show pending action items", "what tasks are due"
- **Daily report**: "give me my daily report", "morning briefing"
- **Meeting prep**: "prepare me for [meeting topic]"

### How I Handle Email Queries
1. Search my memory for relevant emails using semantic similarity
2. Use Gemini to summarize, categorize, or extract action items
3. Format results clearly with subject, sender, date, and relevant snippet
4. If no results found, suggest broadening the search

### Priority Indicators
I identify urgency by looking for: "urgent", "deadline", "ASAP", "immediate", "security", "alert", "action required", "please do", "by [date]", "follow up"

### Memory Sources
All my email knowledge comes from files in my memory directory. Each email is stored as a markdown file with From, Subject, Date, and Content fields.

## Cross-Source Intelligence

I can search across all stored information regardless of source (emails, Teams, WhatsApp, meetings).

## Daily Productivity Reports

When asked for a daily report, I provide:
1. Email highlights (top 10 by urgency)
2. Pending action items (ordered by deadline)
3. Suggested priorities (top 5)
EOF

# Update TOOLS.md
cat > "$WORKSPACE/TOOLS.md" << 'EOF'
# TOOLS.md - Local Setup

## Email Pipeline
- **Source**: Gmail (botsa's personal account)
- **Ingestion**: Runs every 30 minutes via cron
- **Storage**: Memory markdown files (email-{id}.md)
- **Search**: OpenClaw memory semantic search

## Communication Channels
- **Discord**: Primary interface (channel: 1516680999772094617)
- **Telegram**: Secondary interface

## Commands (for self-reference)
- Ingest emails: `node /mnt/c/Users/botsa/email-collector/scripts/ingest-emails-to-memory.mjs`
- Search memory: `openclaw memory search "query"`
- Send Discord message: `openclaw message send --channel discord --target channel:1516680999772094617 --message "text"`
EOF

echo "✅ Workspace files updated"

# Setup cron job for email ingestion (every 30 minutes)
CRON_CMD="*/30 * * * * cd /mnt/c/Users/botsa/email-collector && /usr/bin/node scripts/ingest-emails-to-memory.mjs >> /mnt/c/Users/botsa/email-collector/cron.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "ingest-emails-to-memory"; then
    echo "⏰ Cron job already exists"
else
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "⏰ Cron job added (every 30 minutes)"
fi

echo ""
echo "🔄 Restarting OpenClaw gateway..."
openclaw gateway restart 2>&1 || {
    echo "Gateway restart via command failed. Trying systemd..."
    systemctl --user restart openclaw-gateway 2>&1 || echo "Manual restart needed: openclaw gateway run"
}

echo ""
echo "⏳ Waiting for gateway to come back up..."
sleep 5

# Verify gateway is up
openclaw status 2>&1 | head -5

echo ""
echo "📧 Running initial email ingestion..."
cd /mnt/c/Users/botsa/email-collector
node scripts/ingest-emails-to-memory.mjs

echo ""
echo "🔍 Rebuilding memory index..."
openclaw memory index --force --agent main 2>&1 || echo "Memory index may need manual rebuild after gateway stabilizes"

echo ""
echo "✅ Setup complete! Your Personal AI Assistant is ready."
echo ""
echo "Test it by sending a message in Discord:"
echo '  "search emails about security"'
echo '  "summarize today'"'"'s emails"'
echo '  "show pending action items"'
echo '  "give me my daily report"'
