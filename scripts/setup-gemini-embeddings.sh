#!/bin/bash
set -e

export PATH=/home/radesh/.bun/bin:/usr/bin:/bin:$PATH

echo "1. Setting up Google API Key in GBrain config..."
export $(grep -v '^#' .env | xargs)
export OPENAI_API_KEY=$GEMINI_API_KEY
export OPENAI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai/"

echo "2. Re-initializing GBrain database with Gemini via OpenAI compat (openai:text-embedding-004)..."
mv /home/radesh/.gbrain/brain.pglite /home/radesh/.gbrain/brain.pglite.bak2 || true
gbrain init --pglite --embedding-model openai:text-embedding-004

echo "3. Importing data and generating embeddings..."
gbrain import ~/.openclaw/workspace/memory/

echo "4. Ensuring all embeddings are generated..."
gbrain embed --all

echo "✅ Setup complete! Your AI Assistant is now using Gemini semantic vector search (via OpenAI compat layer)."
