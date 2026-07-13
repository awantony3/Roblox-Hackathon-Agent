#!/bin/bash
set -e
SOURCE="$(cd "$(dirname "$0")" && pwd)/RobloxHackathonAgent.lua"
TARGET="$HOME/Documents/Roblox/Plugins/RobloxHackathonAgent.lua"
mkdir -p "$(dirname "$TARGET")"
cp "$SOURCE" "$TARGET"
echo "Installed Roblox Hackathon Agent plugin at $TARGET"
