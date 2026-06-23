#!/usr/bin/env python3
"""
Add openai auth profile pointing to Google's embedding endpoint.
OpenClaw memory-core needs a provider called 'openai' for embeddings.
We configure it to actually use Google's embedding API via compatibility.

Alternative simpler fix: just add a dummy openai profile so memory can load,
and configure models.json to remap openai to use google embedding.
"""
import json
import os

# The real fix: add the openai key to models.json pointing to google embedding
models_path = os.path.expanduser("~/.openclaw/agents/main/agent/models.json")

# Update models.json to add Google as embedding provider under openai name
models = {
    "providers": {
        "openai": {
            "api": "google-generative-ai",
            "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
            "models": [
                {
                    "id": "text-embedding-004",
                    "name": "Google Text Embedding 004",
                    "input": ["text"],
                    "contextWindow": 2048,
                    "maxTokens": 768
                }
            ]
        }
    }
}

with open(models_path, "w") as f:
    json.dump(models, f, indent=2)

# Also add an openai auth profile that uses the same Google API key
auth_path = os.path.expanduser("~/.openclaw/agents/main/agent/auth-profiles.json")
with open(auth_path, "r") as f:
    auth = json.load(f)

# Get the Google API key
google_key = auth["profiles"]["google:default"]["key"]

# Add an openai profile with the same key (will be routed to Google)
auth["profiles"]["openai:default"] = {
    "type": "api_key",
    "provider": "openai",
    "key": google_key
}

with open(auth_path, "w") as f:
    json.dump(auth, f, indent=2)

print(f"✅ Added openai auth profile (using Google key)")
print(f"✅ Updated models.json to route openai->google embedding")
print(f"   Memory-core should now be able to generate embeddings via Google")
