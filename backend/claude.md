# Roblox Hackathon Agent — Backend Engineering Guide

## Purpose

This file documents the complete architecture, implementation process, safety model, and continuation workflow for the Roblox Hackathon Agent backend.

The project is an independent Roblox game-development agent. It was inspired by architectural ideas from an older Roblox assistant, but its implementation was created separately. The agent controls Roblox Studio through a local plugin and uses:

- **ReAct** for reasoning, tool execution, observation, and iteration.
- **Reflexion** for evidence-based recovery after failed outcomes.
- **Typed Studio tools** for seeing, altering, coding, building, animating, and testing Roblox projects.
- **Execution-layer safety** for destructive confirmation, undo, rollback, quarantine, and limits.

The agent is genre-neutral. It does not generate one predefined game. It provides general Roblox capabilities that can be composed to create games across genres.

## Project location

```text
/Users/antonywang/roblox-hackathon-agent
```

The backend documented here is located at:

```text
/Users/antonywang/roblox-hackathon-agent/backend
```

## High-level architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                     Roblox Studio Plugin                     │
│                                                              │
│  Dock widget                                                 │
│  Project scanner                                             │
│  Runtime observer                                            │
│  Command executor                                            │
│  Change History transactions                                 │
│  Destructive confirmation                                    │
└────────────────────────────┬─────────────────────────────────┘
                             │ Authenticated localhost HTTP
                             │ Poll commands / return results
┌────────────────────────────▼─────────────────────────────────┐
│                     TypeScript Backend                       │
│                                                              │
│  Express API                                                 │
│      ↓                                                       │
│  StudioBridge                                                │
│      ↓                                                       │
│  ReActAgent → ToolRegistry → Studio or backend services      │
│      ↓                                                       │
│  OutcomeEvaluator                                            │
│      ↓ failed or inconclusive                                │
│  ReflexionEngine                                             │
│      ↓                                                       │
│  Revised ReAct attempt                                       │
│                                                              │
│  LessonStore / MeshyClient / readiness diagnostics           │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
                    Claude Sonnet 4 API
```

## Backend structure

```text
backend/
├── claude.md
├── data/
│   ├── assets/                  # Downloaded verified Meshy artifacts
│   └── sessions/                # Validated session lessons
├── src/
│   ├── agent/
│   │   ├── FailedActionGuard.ts # Blocks repeated failures without new evidence
│   │   ├── OutcomeEvaluator.ts  # Evidence-based completion decision
│   │   ├── ReActAgent.ts        # Main tool-use loop
│   │   ├── ReflexionEngine.ts   # Structured retry analysis
│   │   └── prompts.ts           # Compact operating context
│   ├── assets/
│   │   └── MeshyClient.ts       # Text-to-3D jobs, polling, trusted downloads
│   ├── memory/
│   │   └── LessonStore.ts       # Validated Reflexion lessons
│   ├── studio/
│   │   └── StudioBridge.ts      # Plugin command queue and observations
│   ├── tools/
│   │   └── registry.ts          # Tool definitions, routing, risk classification
│   ├── config.ts                # Environment configuration
│   ├── doctor.ts                # CLI readiness report
│   ├── readiness.ts             # Reusable readiness checks
│   ├── server.ts                # Express routes and task lifecycle
│   └── types.ts                 # Shared backend types
└── tests/
    ├── FailedActionGuard.test.ts
    ├── MeshyClient.test.ts
    ├── OutcomeEvaluator.test.ts
    ├── Readiness.test.ts
    └── StudioBridge.test.ts
```

The Studio plugin is outside the backend at:

```text
studio-plugin/RobloxHackathonAgent.lua
```

## Build history

### Step 1 — Independent foundation

The project was scaffolded as a new TypeScript and Node.js application.

Implemented:

- Express backend.
- Environment configuration.
- Anthropic SDK integration.
- Roblox Studio plugin.
- Local HTTP command protocol.
- Initial unit testing and type checking.

Default model:

```text
claude-sonnet-4-20250514
```

### Step 2 — ReAct framework

The main agent loop was implemented in `ReActAgent.ts`.

Lifecycle:

```text
PLANNING
→ ACTING
→ OBSERVING
→ EVALUATING
→ COMPLETE
```

Each attempt:

1. Sends the user goal and compact system context to Claude.
2. Receives structured tool calls.
3. Executes each tool through the registry.
4. Returns structured results to Claude.
5. Continues until the model ends its turn or exhausts the iteration budget.
6. Evaluates the complete attempt using external observations.

The default iteration limit is 20 and is configurable with:

```env
MAX_REACT_ITERATIONS=20
```

### Step 3 — Reflexion framework

The Reflexion engine was added to recover from failed or inconclusive attempts.

Reflection structure:

```json
{
  "outcome": "failed",
  "evidence": ["Observed evidence"],
  "rootCauses": ["Evidence-supported cause"],
  "failedApproaches": ["Approach not to repeat"],
  "revisedStrategy": ["New strategy"],
  "retryRecommended": true
}
```

Reflexion rules:

- Reflection uses tool evidence rather than speculation.
- Failed actions are tracked by normalized tool name and input.
- Identical failed actions are blocked unless successful new evidence has been collected.
- The default maximum is two reflection retries.
- A lesson is persisted only when a reflected retry subsequently succeeds.
- Raw speculative reflections are not trusted project memory.

Configuration:

```env
MAX_REFLEXION_ATTEMPTS=2
```

### Step 4 — Studio tools and safety

Typed Studio commands were implemented for:

- Project scanning.
- Instance inspection and search.
- Script reading, creation, replacement, and patching.
- Instance creation and property alteration.
- Batch construction.
- Deletion.
- Tween generation.
- Structural validation.

Roblox datatype conversion supports:

- `Vector2`
- `Vector3`
- `Color3`
- `CFrame`
- `UDim`
- `UDim2`
- `NumberRange`
- Enum values

Example property encoding:

```json
{
  "Size": { "x": 4, "y": 1, "z": 4 },
  "Color": { "r": 50, "g": 200, "b": 120 },
  "Material": "Neon",
  "CFrame": {
    "position": { "x": 0, "y": 5, "z": 0 },
    "rotation": { "x": 0, "y": 90, "z": 0 }
  }
}
```

Safety controls:

- Deletion, script replacement, and script patching require confirmation.
- Studio mutations use `ChangeHistoryService` recordings.
- Failed commands cancel their active recording.
- Successful commands are undoable.
- Batch builds are limited to 500 instances per command.
- Script source is limited to 200,000 characters.
- Destructive confirmation expires after 20 seconds.
- The backend command timeout is 30 seconds.
- A late destructive action cannot remain approved past backend timeout.

### Step 5 — Live Studio integration

The backend and plugin were tested against a real Roblox Studio place.

Verified:

- Plugin heartbeat and session connection.
- Real hierarchy scanning.
- Folder, Part, and ModuleScript creation.
- Vector3, Color3, and Material decoding.
- Script-source write and readback.
- Structural validation.
- Zero-error validation of an isolated test folder.

Issues found during live testing:

- The session endpoint originally returned oversized project snapshots and script sources. It now returns connection metadata only.
- Confirmation originally outlived the backend timeout. It now expires first.
- The approval button could accidentally submit another task. Agent submission is disabled during confirmation.

### Step 6 — Runtime observation

Roblox plugins cannot reliably start Play mode automatically. A Play-assisted workflow was implemented.

Workflow:

```text
Agent builds feature
→ user presses Play
→ run_playtest observes a bounded window
→ assertions and errors become evaluator evidence
→ failure can trigger Reflexion
```

Captured runtime evidence:

- Edit or Play mode.
- ScriptContext errors.
- Stack traces and script paths.
- Bounded Studio output messages.
- Player count.
- Player character presence.
- Humanoid health and maximum health.

Supported assertions:

- `no_errors`
- `instance_exists`
- `property_equals`
- `player_count_at_least`

Runtime buffers retain at most 200 items.

### Step 7 — Animation workflow

The agent can create typed Roblox animations.

Implemented:

- `KeyframeSequence` generation.
- Nested `Pose` generation.
- Motor6D-compatible transforms.
- Animation priority and loop configuration.
- Pose easing and direction.
- Temporary `active://` preview IDs.
- Preview playback on rigs with a Humanoid or AnimationController.
- Existing uploaded animation ID attachment.
- Confirmed native Studio publishing window.

Limits:

- Maximum 300 keyframes per sequence.
- Maximum 2,000 poses per sequence.

Roblox Open Cloud does not currently document Animation as a supported asset upload type. Publishing therefore uses Roblox Studio's authenticated native workflow. Opening the upload window returns:

```json
{
  "requiresUserCompletion": true
}
```

The evaluator must not call the task complete until the user finishes publishing and supplies the actual asset ID.

### Step 8 — Creator Store and external assets

Two safe asset pipelines were implemented.

#### Creator Store

```text
search_toolbox
→ choose asset
→ quarantine_toolbox_asset
→ ServerStorage.AgentAssetQuarantine
→ script scan
→ confirmed approval
→ scripts removed by default
→ final insertion
```

The quarantine scanner detects:

- `loadstring`
- `getfenv` and `setfenv`
- Numeric remote `require()` calls
- Runtime InsertService loading
- Runtime AssetService loading
- External HTTP requests
- Unreadable source
- Unusually large scripts

Third-party scripts are removed by default. If script preservation is requested, insertion is still blocked when suspicious patterns exist.

Provenance attributes include:

- `AgentSource`
- `AgentAssetId`
- `AgentImportedAt`
- `AgentApproved`
- `AgentScriptsRemoved`

#### Meshy

```text
generate_external_asset
→ asynchronous preview job
→ get_external_asset_job
→ poll until SUCCEEDED
→ trusted artifact URL
→ download_external_asset
→ local GLB or FBX
→ user review and native Studio import
```

Meshy settings:

- Text-to-3D API v2.
- Low-poly by default.
- Latest model.
- Prompt moderation enabled.
- Automatic sizing.
- Bottom origin.
- GLB and FBX output.

Download controls:

- Arbitrary URLs are not accepted.
- URLs must come from a completed job polled by the same backend.
- HTTPS is required.
- Hostname must be `meshy.ai` or a subdomain.
- Files are limited to 50 MB.
- Downloads are written under `backend/data/assets`.

Starting or completing a generation does not mean the asset is inside Roblox. Pending results use `requiresPolling`; completed and downloaded artifacts use `requiresUserCompletion`.

### Step 9 — Final readiness

The final integration phase added:

- `GET /api/status`
- Capability inventory.
- Credential checks.
- Studio connection checks.
- Early task rejection for missing configuration.
- Maximum 100 retained tasks.
- Maximum 100 retained events per task.
- `npm run doctor`.
- Plugin settings for server URL and API key.
- Hackathon runbook.

The current registered tool count is 26.

## Agent tools

### Perception

- `scan_project`
- `get_instance`
- `find_instances`
- `read_script`
- `capture_viewport`
- `get_runtime_observation`

### Building and alteration

- `create_instance`
- `set_properties`
- `delete_instance`
- `build_from_spec`

### Coding

- `create_script`
- `replace_script`
- `patch_script`

### Animation

- `create_tween`
- `create_keyframe_sequence`
- `preview_keyframe_sequence`
- `apply_animation_asset`
- `upload_animation_asset`

### Creator Store and external assets

- `search_toolbox`
- `quarantine_toolbox_asset`
- `approve_quarantined_asset`
- `generate_external_asset`
- `get_external_asset_job`
- `download_external_asset`

### Validation

- `validate_project`
- `run_playtest`

## Tool routing

Most tools are sent to the Studio command queue:

```text
ToolRegistry
→ StudioBridge.execute()
→ pending command queue
→ plugin polls command
→ plugin executes inside Studio
→ plugin posts structured result
→ pending backend promise resolves
```

Backend-native tools do not go through Studio:

- `generate_external_asset`
- `get_external_asset_job`
- `download_external_asset`

`scan_project` reads the latest stored Studio snapshot directly.

## Studio bridge

`StudioBridge` maintains:

- Last snapshot per session.
- Last heartbeat time.
- Per-session command queues.
- Pending command promises.
- Command timeout handling.

A session is considered connected when its heartbeat was seen within the last five seconds.

Command lifecycle:

```text
pending → running → complete
                  ↘ failed
```

## Outcome evaluation

The acting model does not grade itself.

`OutcomeEvaluator` checks:

- Failed tool calls.
- Successful tool calls.
- Whether a mutation occurred.
- Whether verification occurred after the last mutation.
- Runtime assertion results.
- External workflows waiting on polling or user completion.

Possible results:

```text
passed
failed
inconclusive
```

A mutation without a later inspection, validation, preview, or runtime observation is inconclusive.

Interactive upload or import workflows remain inconclusive while:

```json
{
  "requiresPolling": true
}
```

or:

```json
{
  "requiresUserCompletion": true
}
```

## Memory model

The current memory implementation stores session lessons under:

```text
backend/data/sessions
```

Lessons are bounded to the most recent 20 entries per session.

A reflection becomes a trusted lesson only after its revised strategy leads to a passed evaluation.

Do not persist:

- Raw chain-of-thought.
- Speculative root causes.
- Unverified user preferences.
- Temporary animation IDs.
- Signed external download URLs as permanent identifiers.

## API routes

### Public health

```text
GET /health
```

### Authenticated readiness

```text
GET /api/status
```

### Studio connection

```text
POST /api/studio/connect
GET  /api/studio/sessions
GET  /api/studio/commands/:sessionId
POST /api/studio/results/:commandId
POST /api/studio/execute
```

`/api/studio/execute` is an authenticated diagnostic endpoint. It computes destructive classification on the backend rather than trusting the caller.

### Agent tasks

```text
POST /api/agent/tasks
GET  /api/agent/tasks/:taskId
```

Task creation requires:

- A configured Anthropic key.
- A connected Studio session.
- A non-empty session ID and message.

## Configuration

Create `.env` at the project root from `.env.example`.

```env
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-20250514
PORT=3100
AGENT_API_KEY=replace-this
MAX_REACT_ITERATIONS=20
MAX_REFLEXION_ATTEMPTS=2
STUDIO_COMMAND_TIMEOUT_MS=30000
MESHY_API_KEY=
```

Required for the core agent:

- `ANTHROPIC_API_KEY`
- A non-default `AGENT_API_KEY`

Optional:

- `MESHY_API_KEY`

The plugin reads these settings:

```text
RobloxHackathonAgent.ServerUrl
RobloxHackathonAgent.ApiKey
```

Defaults:

```text
http://localhost:3100
change-me
```

The plugin API key and backend `AGENT_API_KEY` must match.

## Development commands

From the project root:

```bash
npm install
npm run typecheck
npm test
npm run doctor
npm start
```

Install the plugin:

```bash
./studio-plugin/sync.sh
```

Restart Roblox Studio after every plugin sync.

## Verification status

At the end of the documented build:

- TypeScript validation passes.
- 16 automated tests pass.
- 26 tools are registered.
- The plugin was installed successfully.
- The backend starts on `localhost:3100`.
- A real Studio connection was verified.
- A real additive create/readback/validate workflow passed.
- Meshy's official no-credit test mode passed.

Operational blockers at the last readiness check:

- The new project did not have `ANTHROPIC_API_KEY` configured.
- `AGENT_API_KEY` still used `change-me`.
- Production Meshy generation was unconfigured, but Meshy is optional.

## Known limitations

### Model access

Claude execution requires a funded Anthropic account. A valid key with insufficient credit still prevents autonomous tasks.

### Studio lifecycle

- Plugin updates require a Studio restart.
- The plugin cannot reliably start Play mode automatically.
- Runtime testing is Play-assisted.

### Visual perception

Ordinary Studio plugins do not expose raw viewport pixels. The current viewport tool returns camera evidence. Pixel screenshots require a local macOS companion or another authorized capture mechanism.

### Animation publishing

Animation publishing uses Roblox's native authenticated UI. The agent cannot truthfully return a published asset ID until the user finishes the UI workflow.

### External asset import

Meshy GLB and FBX artifacts require Roblox Studio's native 3D Importer. The plugin cannot silently access arbitrary backend files.

### Runtime coverage

Current runtime observation covers errors, output, players, characters, and Humanoid health. It does not yet inspect every NPC, UI element, RemoteEvent, or performance metric.

## Security rules for future work

1. Never send API keys to Roblox Studio or model prompts.
2. Never add cookie-authenticated Roblox endpoints.
3. Never treat a dialog opening as external completion.
4. Never import a Creator Store model directly into Workspace.
5. Never preserve suspicious third-party scripts automatically.
6. Never accept arbitrary external download URLs.
7. Never weaken destructive confirmation to improve demo speed.
8. Never store raw chain-of-thought.
9. Never claim runtime validation from edit-mode structural checks.
10. Never mark a mutation complete without later verification.

## Engineering priorities for future continuation

### Priority 1 — Operational readiness

- Configure a funded Anthropic key.
- Configure a non-default agent API key.
- Restart Studio with the latest plugin.
- Run `npm run doctor` until it reports `READY`.
- Perform one full autonomous rehearsal.

### Priority 2 — Stronger runtime evidence

- NPC and tagged-instance observation.
- UI text and visibility assertions.
- Attributes and ValueBase assertions.
- RemoteEvent diagnostics for agent-created networking.
- Performance sampling and instance-growth checks.

### Priority 3 — Visual perception

- Add an authorized macOS screenshot companion.
- Store images temporarily with strict deletion.
- Send screenshots with structural context.
- Add visual comparison evidence without making it the sole evaluator.

### Priority 4 — Asset completion

- Guided native import handoff for downloaded Meshy files.
- Mesh metadata and polygon validation.
- Meshy refine and image-to-3D jobs.
- Creator Store metadata and licensing checks.
- Thumbnail review in the plugin.

### Priority 5 — Coding quality

- Real Luau parsing and syntax validation.
- Server/client placement analysis.
- RemoteEvent security analysis.
- DataStore and memory-leak checks.
- Targeted script diffs with preview.

### Priority 6 — Optional MCP compatibility

Expose the existing tool registry through MCP without duplicating the agent core. MCP should wrap the same schemas, risk classification, and Studio bridge.

## Definition of done

The agent is operationally complete when a user can enter one request and observe the following end-to-end behavior:

1. The agent confirms Studio connection.
2. It scans and understands the current project.
3. It derives observable acceptance criteria.
4. It builds instances and writes Luau code.
5. It adds animation when requested.
6. It inspects and structurally validates its mutations.
7. The user starts Play mode when requested.
8. The agent collects runtime evidence.
9. A controlled failure triggers evidence-based Reflexion.
10. The revised attempt passes verification.
11. The final response reports evidence and limitations honestly.

## Related documentation

From the project root:

- `PLAN.md` — complete development plan.
- `README.md` — setup and quick start.
- `docs/HACKATHON_RUNBOOK.md` — final operational checklist.
- `docs/INTEGRATION_TEST.md` — live Studio test record.
- `docs/RUNTIME_TESTING.md` — Play-assisted validation.
- `docs/ANIMATION_WORKFLOW.md` — animation generation and publishing.
- `docs/ASSET_PIPELINES.md` — Creator Store and Meshy safety pipeline.
- `docs/RED_TEAM.md` — architectural risks.

