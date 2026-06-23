#!/usr/bin/env python3
"""Remove the invalid memory-core plugin entry from openclaw.json."""
import json
import os

config_path = os.path.expanduser("~/.openclaw/openclaw.json")

with open(config_path, "r") as f:
    config = json.load(f)

# Remove the invalid memory-core entry from plugins
if "plugins" in config and "entries" in config["plugins"]:
    if "memory-core" in config["plugins"]["entries"]:
        del config["plugins"]["entries"]["memory-core"]
        print("Removed invalid memory-core plugin entry")

# Also remove the invalid 'memory' top-level key if it exists
if "memory" in config:
    del config["memory"]
    print("Removed invalid memory top-level key")

with open(config_path, "w") as f:
    json.dump(config, f, indent=2)

print("✅ Config cleaned up")
