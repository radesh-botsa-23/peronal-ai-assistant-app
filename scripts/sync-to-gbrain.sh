#!/bin/bash
# Batch import all email memory files into GBrain
# This is much faster than individual put commands

export PATH=/home/radesh/.bun/bin:/usr/bin:/bin:$PATH

MEMORY_DIR="$HOME/.openclaw/workspace/memory"
IMPORT_DIR="/tmp/gbrain-email-import"

echo "📧 Syncing emails to GBrain..."

# Create temp directory with only email files
rm -rf "$IMPORT_DIR"
mkdir -p "$IMPORT_DIR"

# Copy email files to import dir
count=0
for f in "$MEMORY_DIR"/email-*.md; do
  if [ -f "$f" ]; then
    cp "$f" "$IMPORT_DIR/"
    count=$((count + 1))
  fi
done

echo "Found $count email files to sync"

if [ $count -eq 0 ]; then
  echo "No emails to import"
  exit 0
fi

# Use gbrain import for batch processing (skips existing by default)
gbrain import "$IMPORT_DIR" 2>&1

echo ""
echo "✅ GBrain sync complete"
gbrain stats

# Cleanup
rm -rf "$IMPORT_DIR"
