#!/bin/bash
cat > ~/.openclaw/workspace/TOOLS.md << 'EOF'
# TOOLS.md - Local Setup

## Email Search Tool
ALWAYS use this bash command to search emails:
    PATH=/home/radesh/.bun/bin:/usr/bin:/bin gbrain query "SEARCH_TERMS"

DO NOT use openclaw memory search. It is broken.
ALWAYS use gbrain query instead. It works perfectly.

## Examples
- User: "search emails about security" -> run: PATH=/home/radesh/.bun/bin:/usr/bin:/bin gbrain query "security"
- User: "emails from Google" -> run: PATH=/home/radesh/.bun/bin:/usr/bin:/bin gbrain query "from Google"
- User: "summarize emails" -> run: PATH=/home/radesh/.bun/bin:/usr/bin:/bin gbrain query "recent emails" then summarize
- User: "action items" -> run: PATH=/home/radesh/.bun/bin:/usr/bin:/bin gbrain query "action required deadline task"

## Communication Channels
- Discord: Primary interface (channel: 1516680999772094617)
- Telegram: Secondary interface

## Key Paths
- GBrain binary: /home/radesh/.bun/bin/gbrain
- Bun binary: /home/radesh/.bun/bin/bun
- Required PATH prefix: /home/radesh/.bun/bin
EOF
echo "TOOLS.md updated"
