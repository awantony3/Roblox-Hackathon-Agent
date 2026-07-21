# Roblox Hackathon Agent

An independent Roblox Studio game-building agent inspired by the architecture of `roblox-ai-assistant`, without importing its implementation. It uses a ReAct tool loop and evidence-based Reflexion retries.

## Current vertical slice

- Sees the Explorer hierarchy, selected instances, script source, common part properties, and camera state.
- Creates and edits instances and Luau scripts.
- Patches exact script fragments with confirmation and size limits.
- Builds batches of instances from a declarative specification.
- Creates TweenService animation scripts from typed goals.
- Adds existing Roblox animation assets to rigs.
- Generates KeyframeSequences, previews them locally on rigs, and opens Roblox's confirmed native publishing workflow.
- Searches Creator Store models, quarantines them, scans scripts, and removes scripts by default before insertion.
- Creates and polls Meshy low-poly 3D jobs, then downloads trusted GLB/FBX artifacts with size limits.
- Exposes adapters for animation upload and external 3D generation.
- Requires in-Studio approval for script replacement and deletion.
- Destructive approval expires before the backend command timeout, preventing late execution after a reported timeout.
- Evaluates tool evidence and performs at most two Reflexion retries.
- Observes Play-assisted runtime errors, output, player state, and typed assertions.
- Stores only lessons that led to a subsequently successful attempt.

The agent is genre-neutral: genre behavior comes from the user goal and generated Roblox systems, not hard-coded templates.

## Run tonight

Requirements: Node.js 18+, Roblox Studio for macOS, and an Anthropic API key.

```bash
cp .env.example .env
# Put ANTHROPIC_API_KEY in .env and change AGENT_API_KEY if desired.
npm install
npm start
```

Run the readiness doctor before opening Studio:

```bash
npm run doctor
```

The plugin defaults to `change-me` for local setup. For a custom key, set the plugin setting `RobloxHackathonAgent.ApiKey` to match `AGENT_API_KEY`, then install the plugin:

```bash
chmod +x studio-plugin/sync.sh
./studio-plugin/sync.sh
```

In Roblox Studio:

1. Enable **Game Settings → Security → Allow HTTP Requests**.
2. Restart Studio after installing the plugin.
3. Open a place and select **Plugins → Roblox AI Agent → Agent**.
4. Enter a game-building request.

Suggested demo:

> Build a compact neon dungeon with a collectible key, an animated door, an enemy, health UI, and a victory portal. Use server-authoritative gameplay code.

## Architecture

```text
Studio plugin ⇄ queued command bridge ⇄ ReAct agent ⇄ Claude Sonnet 4
                                              ↓
                                      outcome evaluator
                                              ↓ failure
                                          Reflexion
                                              ↓
                                      revised ReAct attempt
```

The plugin is the only component allowed to mutate the open Studio project. Each command is typed, returns a structured observation, and marks destructive operations for confirmation.

## How ChatGPT and Codex helped

ChatGPT and OpenAI Codex were used as collaborative development tools throughout the hackathon. ChatGPT helped brainstorm the product direction, break the idea into an achievable vertical slice, and reason through the agent architecture, safety boundaries, and demo flow. It also helped turn rough ideas and test results into clearer implementation plans and documentation.

Codex worked directly with the project files and development environment. It helped scaffold and refine the TypeScript backend and Roblox Studio plugin, implement the ReAct and Reflexion loops, connect typed tools to Studio, diagnose integration issues, and run focused checks while the project evolved. Codex also assisted with scripts used to build and test the Roblox experience and with keeping the README aligned with the working system.

These tools accelerated iteration and helped surface edge cases, but the project was directed, reviewed, tested, and submitted by the human developer. AI-generated suggestions and code were treated as drafts and verified against the actual Roblox Studio experience before being accepted.

## Known hackathon limitations

- Roblox Studio does not expose viewport pixel capture directly to ordinary plugins. `capture_viewport` currently returns camera evidence.
- Automatic play-mode launch is not exposed reliably to plugins. The user presses Play; `run_playtest` then captures a bounded runtime observation window and evaluates assertions.
- Roblox's documented Open Cloud upload types do not currently include animations. Animation publishing uses Studio's authenticated native window and remains incomplete until the user supplies the published asset ID.
- Meshy generation requires `MESHY_API_KEY`. Downloaded GLB/FBX artifacts still require Roblox Studio's native 3D Importer.
- Studio mutations are recorded in Change History; failed commands cancel their active recording and successful commands are undoable.

## Next implementation order

1. Add change journal and batch rollback.
2. Add a Play button-assisted runtime observer for real playtest evidence.
3. Add post-publish animation ownership verification after the user supplies the asset ID.
4. Add conversion checks and a guided native 3D import workflow for Meshy artifacts.
5. Expand Creator Store metadata and licensing checks.
6. Add screenshot capture through a local macOS companion.

MCP compatibility can wrap the same tool registry later without changing the core agent.
