#!/usr/bin/env python3
"""Add memory provider config to openclaw.json to use Google embeddings."""
import json
import os

config_path = os.path.expanduser("~/.openclaw/openclaw.json")

with open(config_path, "r") as f:
    config = json.load(f)

config["memory"] = {
    "provider": "google",
    "model": "text-embedding-004"
}

with open(config_path, "w") as f:
    json.dump(config, f, indent=2)

print("✅ Memory provider set to google/text-embedding-004")
