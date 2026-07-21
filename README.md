# Roblox Hackathon Agent

An OpenAI-assisted agent that turns natural-language game ideas into working Roblox Studio experiences. It combines a typed Studio tool layer, a ReAct execution loop, evidence-based Reflexion retries, and human approval for destructive actions.

## What it does

- Inspects the Explorer hierarchy, selected instances, scripts, common properties, and camera state.
- Creates and edits Roblox instances and Luau scripts.
- Applies exact, size-limited script patches with confirmation.
- Builds groups of instances from declarative specifications.
- Creates TweenService animation scripts from typed goals.
- Adds existing animation assets to rigs.
- Generates and previews KeyframeSequences before opening Roblox Studio's native publishing workflow.
- Searches Creator Store models, quarantines imports, scans scripts, and removes embedded scripts by default.
- Starts Meshy low-poly 3D generation jobs and downloads trusted GLB or FBX artifacts with size limits.
- Observes playtests through runtime output, player state, errors, and typed assertions.
- Evaluates tool evidence and performs up to two Reflexion retries when an attempt fails.
- Stores only lessons that are followed by a successful attempt.

The agent is genre-neutral. Game behavior comes from the user's prompt and the generated Roblox systems rather than hard-coded templates.

## Quick start

### Requirements

- Node.js 18 or newer
- Roblox Studio for macOS
- An OpenAI API key

### Start the backend

```bash
cp .env.example .env
# Add OPENAI_API_KEY to .env and change AGENT_API_KEY if desired.
npm install
npm start
```

Check the local setup before opening Roblox Studio:

```bash
npm run doctor
```

### Install the Studio plugin

The plugin uses `change-me` as its default local API key. If you set a custom `AGENT_API_KEY`, set the Roblox plugin setting `RobloxHackathonAgent.ApiKey` to the same value.

```bash
chmod +x studio-plugin/sync.sh
./studio-plugin/sync.sh
```

Then:

1. Open Roblox Studio.
2. Enable **Game Settings → Security → Allow HTTP Requests**.
3. Restart Studio after installing the plugin.
4. Select **Plugins → Roblox AI Agent → Agent**.
5. Enter a game-building request.

Try this prompt:

> Build a compact neon dungeon with a collectible key, an animated door, an enemy, health UI, and a victory portal. Use server-authoritative gameplay code.

## Architecture

```text
Roblox Studio plugin ⇄ queued command bridge ⇄ ReAct agent ⇄ OpenAI Codex
                                                       ↓
                                               outcome evaluator
                                                       ↓ failure
                                                   Reflexion
                                                       ↓
                                               revised ReAct attempt
```

The Roblox Studio plugin is the only component allowed to mutate the open project. Every command is typed and returns a structured observation. Script replacement, deletion, and other destructive operations require explicit in-Studio approval. Approval expires before the backend timeout so a command cannot execute after being reported as timed out.

## How OpenAI helped

ChatGPT helped shape the product direction, reduce the idea to an achievable hackathon scope, reason through the architecture and safety boundaries, and turn rough notes and test results into implementation plans and documentation.

OpenAI Codex worked directly with the repository and development environment. It helped scaffold and refine the TypeScript backend and Roblox Studio plugin, implement the ReAct and Reflexion loops, connect typed tools to Studio, diagnose integration problems, run focused checks, and create scripts used to build and test the Roblox experience.

OpenAI tools accelerated iteration and helped identify edge cases. The human developer directed the project, made product decisions, reviewed the generated work, tested it in Roblox Studio, and prepared the final submission. AI suggestions and code were treated as drafts until they were verified in the working experience.

## Safety design

- Only the Studio plugin can modify the open Roblox project.
- Commands use typed inputs and structured observations.
- Script replacement and deletion require explicit approval.
- Imported Creator Store assets are quarantined and scanned.
- Embedded scripts are removed from imported models by default.
- Failed Studio commands cancel their active Change History recording.
- Successful Studio mutations remain undoable.
- External artifacts are restricted by trust and size checks.

## Hackathon limitations

- Ordinary Roblox Studio plugins cannot directly capture viewport pixels, so `capture_viewport` currently returns camera evidence.
- Plugins cannot reliably launch play mode automatically. The user starts Play, and `run_playtest` captures a bounded observation window and evaluates assertions.
- Roblox Open Cloud does not currently expose animation uploads for this workflow. Publishing opens Studio's authenticated native interface and remains incomplete until the user provides the published asset ID.
- Meshy generation requires `MESHY_API_KEY`. Downloaded GLB or FBX files still need Roblox Studio's native 3D Importer.

## Roadmap

1. Add a change journal and batch rollback.
2. Improve Play-assisted runtime observation.
3. Verify animation ownership after publishing.
4. Add conversion checks and a guided native 3D import flow.
5. Expand Creator Store metadata and licensing checks.
6. Add screenshot capture through a local macOS companion.

The same tool registry can later be exposed through MCP without changing the core agent.
