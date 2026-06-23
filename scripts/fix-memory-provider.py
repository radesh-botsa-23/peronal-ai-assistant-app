#!/usr/bin/env python3
"""Configure memory-core plugin to use Google embeddings instead of OpenAI."""
import json
import os

config_path = os.path.expanduser("~/.openclaw/openclaw.json")

with open(config_path, "r") as f:
    config = json.load(f)

# Add memory-core plugin configuration with google embedding provider
if "plugins" not in config:
    config["plugins"] = {"entries": {}}

config["plugins"]["entries"]["memory-core"] = {
    "enabled": True,
    "embeddingProvider": "google"
}

with open(config_path, "w") as f:
    json.dump(config, f, indent=2)

print("✅ memory-core plugin configured to use Google embeddings")
