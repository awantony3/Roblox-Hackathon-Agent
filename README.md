# Roblox Hackathon Agent

An autonomous Roblox Studio game-building agent that turns a natural-language goal into inspected, implemented, and verified changes inside an open Roblox project.

The system combines an OpenAI GPT-5.6-powered ReAct loop, typed tools, a queued HTTP bridge, a Roblox Studio plugin, evidence-based outcome evaluation, Reflexion retries, and human approval for destructive actions. ChatGPT and OpenAI Codex were also used as development collaborators while building the project.

## What it can do

- Inspect the Explorer hierarchy, selection, scripts, properties, camera state, and recent output.
- Create and modify Roblox instances and Luau scripts.
- Build many related objects from one declarative specification.
- Generate TweenService scripts, KeyframeSequences, animation previews, and animation configurations.
- Search Creator Store models, quarantine them, scan their scripts, and remove scripts by default before insertion.
- Start Meshy text-to-3D jobs and download validated GLB or FBX artifacts.
- Observe Play mode, runtime errors, output, player state, and typed assertions.
- Evaluate whether an attempt produced verified evidence instead of trusting the model's final message.
- Reflect on failed or inconclusive attempts and retry with a revised strategy.

The agent is genre-neutral. Its behavior comes from the user's goal and the systems it generates rather than a hard-coded game template.

## Agent structure

```text
User request
    │
    ▼
Express API server
    │ creates a task
    ▼
ReActAgent ───────────────► OpenAI GPT-5.6 API
    ▲                                │
    │                                │ returns text and typed tool calls
    │                                ▼
    └────────────────────────── Tool registry
                                     │
                         ┌───────────┴───────────┐
                         │                       │
                         ▼                       ▼
                  Local integrations       StudioBridge
                    such as Meshy                │ queues command
                                                ▼
                                      Roblox Studio plugin
                                                │
                                     inspects or changes game
                                                │
                                                ▼
                                      structured tool result
                                                │
                                                ▼
                                        OutcomeEvaluator
                                      ┌─────────┴─────────┐
                                      │                   │
                                   passed        failed/inconclusive
                                      │                   │
                                      ▼                   ▼
                                  complete        ReflexionEngine
                                                          │
                                                revised strategy
                                                          │
                                                          └──► next ReAct attempt
```

### 1. API and task orchestration

`backend/src/server.ts` is the backend entry point. It exposes endpoints for health, readiness, Studio sessions, queued commands, command results, and agent tasks.

When the plugin submits a user goal, the server:

1. Confirms that the model credentials exist.
2. Confirms that the requested Studio session is connected.
3. Creates an asynchronous task.
4. Starts a new `ReActAgent`.
5. Records state events such as `planning`, `acting`, `observing`, `evaluating`, and `reflecting`.
6. Returns a task ID that the plugin can poll for progress and results.

The API is protected by `AGENT_API_KEY`, except for the public health endpoint.

### 2. ReAct reasoning loop

`backend/src/agent/ReActAgent.ts` controls the main agent loop. The runtime model is accessed through `OpenAIClient`, which uses the official OpenAI SDK and function calling.

For each attempt, the agent:

1. Sends the system instructions, user goal, and tool definitions to the model.
2. Receives one or more typed tool calls.
3. Executes those calls and records every input and observation in a trace.
4. Returns each structured result to the model.
5. Continues until the model stops calling tools or the iteration budget is exhausted.

The default budget is 20 ReAct iterations per attempt and up to two Reflexion retries. These values can be changed with `MAX_REACT_ITERATIONS` and `MAX_REFLEXION_ATTEMPTS`.

### 3. Typed tool registry

`backend/src/tools/registry.ts` defines every action available to the model, including its name, description, JSON input schema, and destructive-action classification.

The tools fall into several groups:

- **Inspection:** scan the project, find instances, inspect properties, and read scripts.
- **Construction:** create instances, set properties, create scripts, and build from a specification.
- **Editing:** patch or replace scripts and delete instances.
- **Animation:** create tweens and KeyframeSequences, preview animations, and configure uploaded assets.
- **Asset workflows:** search and quarantine Creator Store assets or generate Meshy 3D assets.
- **Validation:** validate project structure, observe runtime state, and evaluate playtest assertions.

Most tools are forwarded to Roblox Studio. Meshy operations execute directly in the backend.

### 4. Queued Studio bridge

`backend/src/studio/StudioBridge.ts` connects the asynchronous model loop to Roblox Studio.

The backend cannot directly mutate a Studio project. Instead, it places each command in a session-specific queue. The Studio plugin polls for the next command, executes it locally, and posts a structured result back to the backend. The bridge resolves the waiting tool call when that result arrives.

A Studio session is considered connected only when it has checked in within the last five seconds. Commands fail if Studio does not answer before `STUDIO_COMMAND_TIMEOUT_MS`.

### 5. Roblox Studio plugin

`studio-plugin/RobloxHackathonAgent.lua` is the only component allowed to change the open Roblox project. It captures project snapshots, polls the backend, decodes typed Roblox values, runs tool handlers, and returns observations.

Mutations use Roblox Change History recordings. Successful commands are committed as undoable Studio actions, while failed commands cancel their recordings. Script replacement, exact script patches, deletion, animation publishing, and approval of quarantined assets require explicit user confirmation inside Studio.

### 6. Evidence-based evaluation

`backend/src/agent/OutcomeEvaluator.ts` decides whether an attempt actually succeeded. It does not accept the model's final prose as proof.

An attempt fails when a required tool fails. It is inconclusive when no observable action occurred, an external workflow still needs the user, or the last mutation was not followed by a successful inspection or validation tool. It passes only when the trace contains successful, verified evidence.

### 7. Reflexion and retry protection

When an attempt fails or is inconclusive, `backend/src/agent/ReflexionEngine.ts` asks the model for a structured, evidence-grounded reflection containing root causes, failed approaches, a revised strategy, and whether retrying is worthwhile.

`backend/src/agent/FailedActionGuard.ts` fingerprints failed tool calls. It blocks the same failed tool and identical input from being repeated until a successful action creates new evidence. This prevents the agent from getting stuck retrying the same command.

Validated reflections are stored by `backend/src/memory/LessonStore.ts`. A lesson is saved only when its revised attempt later succeeds, and each session retains its 20 most recent lessons.

## Repository layout

```text
backend/
├── src/
│   ├── agent/
│   │   ├── OpenAIClient.ts        # Official OpenAI runtime client
│   │   ├── ReActAgent.ts          # Main tool-use loop
│   │   ├── OutcomeEvaluator.ts    # Evidence-based success checks
│   │   ├── ReflexionEngine.ts     # Structured retry strategy
│   │   ├── FailedActionGuard.ts   # Repeated-failure protection
│   │   └── prompts.ts             # Agent operating contract
│   ├── assets/MeshyClient.ts      # External 3D generation
│   ├── memory/LessonStore.ts      # Validated session lessons
│   ├── studio/StudioBridge.ts     # Backend-to-Studio command queue
│   ├── tools/registry.ts          # Tool definitions and dispatch
│   ├── config.ts                  # Environment configuration
│   ├── readiness.ts               # Startup readiness checks
│   ├── server.ts                  # Express API and task manager
│   └── types.ts                   # Shared command and result types
├── tests/                         # Backend unit tests
studio-plugin/
├── RobloxHackathonAgent.lua       # Studio UI and tool executor
└── sync.sh                        # Plugin installation helper
tools/                             # Demo and Roblox build scripts
docs/                              # Supporting project documentation
```

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

Run the readiness doctor before opening Studio:

```bash
npm run doctor
```

### Install the Studio plugin

The plugin uses `change-me` as its default local API key. If you set a custom `AGENT_API_KEY`, set the plugin setting `RobloxHackathonAgent.ApiKey` to the same value.

```bash
chmod +x studio-plugin/sync.sh
./studio-plugin/sync.sh
```

In Roblox Studio:

1. Enable **Game Settings → Security → Allow HTTP Requests**.
2. Restart Studio after installing the plugin.
3. Open a place and select **Plugins → Roblox AI Agent → Agent**.
4. Enter a game-building request.

Example:

> Build a compact neon dungeon with a collectible key, an animated door, an enemy, health UI, and a victory portal. Use server-authoritative gameplay code.

## Safety model

- Only the Studio plugin can mutate the open project.
- Tools use typed inputs and structured results.
- Destructive operations require explicit, expiring approval.
- Server-authoritative Roblox patterns are required by the system prompt.
- Imported Creator Store assets are quarantined and scanned.
- Embedded scripts are removed from imported assets by default.
- Build commands are limited to 500 instances.
- Failed Studio commands cancel their Change History recording.
- Successful mutations remain undoable.
- External artifact downloads are restricted by job, host, format, and size checks.

## How ChatGPT and Codex helped

ChatGPT helped shape the product direction, reduce the idea to an achievable hackathon scope, reason through architecture and safety boundaries, and turn rough notes and test results into implementation plans and documentation.

OpenAI Codex worked directly with the repository and development environment. It helped scaffold and refine the TypeScript backend and Roblox Studio plugin, implement and inspect the ReAct and Reflexion loops, connect typed tools to Studio, diagnose integration problems, run focused checks, and create scripts used to build and test the Roblox experience.

These tools accelerated iteration and helped identify edge cases. The human developer directed the project, made product decisions, reviewed the generated work, tested it in Roblox Studio, and prepared the final submission. AI suggestions and code were treated as drafts until verified in the working experience.

## Current limitations

- Ordinary Roblox Studio plugins cannot directly capture viewport pixels, so `capture_viewport` currently returns camera evidence.
- Plugins cannot reliably launch Play mode automatically. The user starts Play, and `run_playtest` then captures a bounded observation window and evaluates assertions.
- Animation publishing uses Studio's authenticated native interface and waits for the user to provide the published asset ID.
- Meshy generation requires `MESHY_API_KEY`. Downloaded GLB or FBX files still require Roblox Studio's native 3D Importer.
- Tasks and Studio queues are kept in memory, so backend restarts discard active work.
- The lesson store is session-local and is not yet injected into new prompts.

## Roadmap

1. Add durable task state, a change journal, and batch rollback.
2. Feed validated lessons back into later agent prompts.
3. Improve Play-assisted runtime observation and screenshot capture.
4. Verify animation ownership after publishing.
5. Add conversion checks and a guided native 3D import workflow.
6. Expand Creator Store metadata and licensing checks.

The same typed tool registry can later be exposed through MCP without changing the core agent.
