# Roblox Hackathon Agent — Development Plan

## 1. Objective

Build an independent AI agent that can create and modify Roblox games through a Roblox Studio plugin. The agent must be genre-neutral and capable of:

- Seeing the current game hierarchy, scripts, selection, properties, and runtime evidence.
- Altering existing Roblox instances and systems.
- Writing and editing secure Luau code.
- Building environments, gameplay systems, UI, lighting, and effects.
- Creating procedural animation and using uploaded Roblox animation assets.
- Using Roblox, Toolbox, generated, and external 3D assets when configured.
- Testing its work and collecting observable evidence.
- Using ReAct to execute tasks and Reflexion to revise failed approaches.
- Applying safe changes automatically while requiring confirmation for destructive changes.

The project is separate from `/Users/antonywang/roblox-ai-assistant`. The older project is an architectural reference only.

## 2. Product principles

1. **Evidence before completion:** The agent must not report success solely because a model says it succeeded.
2. **Studio remains authoritative:** Only the installed plugin may mutate the open Roblox project.
3. **Safe autonomy:** Additive and low-risk changes may run automatically. Destructive changes require confirmation.
4. **Genre neutrality:** Tools provide general Roblox capabilities rather than hard-coded game templates.
5. **Server authority:** Rewards, damage, purchases, inventory, and saved data must be validated by server code.
6. **Structured context:** Supply project facts and tool observations instead of accumulating prompt rules.
7. **Fail closed:** Missing credentials or unsupported platform functionality must produce explicit errors.
8. **Hackathon focus:** Prioritize one polished end-to-end workflow before expanding integrations.

## 3. System architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                     Roblox Studio Plugin                     │
│                                                              │
│  Agent panel → Project scanner → Command executor            │
│        │               │                 │                   │
│        │               │                 ├─ Build             │
│        │               │                 ├─ Alter             │
│        │               │                 ├─ Code              │
│        │               │                 └─ Animate           │
│        │               │                                     │
│        └──────── Destructive-change confirmation              │
└────────────────────────────┬─────────────────────────────────┘
                             │ Local HTTP command protocol
┌────────────────────────────▼─────────────────────────────────┐
│                     TypeScript Backend                       │
│                                                              │
│  API → StudioBridge → ToolRegistry → ReActAgent              │
│                                      │                       │
│                                      ▼                       │
│                              OutcomeEvaluator                │
│                                      │ failure               │
│                                      ▼                       │
│                              ReflexionEngine                  │
│                                      │                       │
│                                      ▼                       │
│                               Revised attempt                 │
│                                                              │
│                   LessonStore + execution trace               │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
                    Claude Sonnet 4 API
```

## 4. Agent framework

### 4.1 ReAct loop

Each attempt follows this lifecycle:

```text
PLAN → ACT → OBSERVE → EVALUATE
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
          COMPLETE               REFLECT
                                     │
                                     ▼
                                  REPLAN
                                     │
                                     ▼
                                    ACT
```

Rules:

- Scan the project before making changes unless a current snapshot is available.
- Translate the request into observable acceptance criteria.
- Use typed tool calls for all Studio actions.
- Record every tool input and result.
- Never infer tool success from intention.
- Stop after the configured iteration budget.
- Escalate when required evidence or authority is unavailable.

### 4.2 Reflexion loop

Reflexion runs after an outcome failure or inconclusive result—not after every transient tool error.

A reflection contains:

```json
{
  "outcome": "failed",
  "evidence": ["Observed failure evidence"],
  "rootCauses": ["Evidence-supported root cause"],
  "failedApproaches": ["Approach that should not be repeated"],
  "revisedStrategy": ["Next action based on the evidence"],
  "retryRecommended": true
}
```

Reflection policy:

- Maximum of two Reflexion retries per task for the hackathon build.
- Do not repeat an identical failed action.
- Do not invent observations that were not returned by tools.
- Persist a lesson only when the revised attempt later passes.
- Escalate when retrying is unsafe, impossible, or making no measurable progress.

## 5. Capability roadmap

### 5.1 Perception

- [x] Scan important Roblox services.
- [x] Read hierarchy and selection.
- [x] Read Luau script source.
- [x] Inspect common BasePart properties.
- [x] Inspect camera position and field of view.
- [x] Search instances and scripts without returning the entire hierarchy.
- [x] Capture bounded Studio output and runtime errors during Play-assisted testing.
- [ ] Capture viewport pixels through a local macOS companion.
- [x] Observe live player character and health state.
- [ ] Observe NPC state, UI state, and RemoteEvent activity.

### 5.2 Building and alteration

- [x] Create arbitrary Roblox instances.
- [x] Set common instance properties.
- [x] Build batches from declarative specifications.
- [x] Delete instances with confirmation.
- [x] Record mutations through Roblox Studio Change History for undo.
- [x] Cancel the current Change History recording when a batch command fails.
- [ ] Add clone, move, rename, tag, attribute, and collection tools.
- [ ] Add reusable builders for terrain, lighting, UI, particles, and constraints.
- [ ] Generate optimized layouts rather than issuing one tool call per part.

### 5.3 Coding

- [x] Create Script, LocalScript, and ModuleScript instances.
- [x] Replace scripts with destructive-change confirmation.
- [x] Patch exact script fragments without replacing whole scripts.
- [ ] Add Luau syntax validation before installation.
- [ ] Detect incorrect server/client placement.
- [ ] Validate RemoteEvent input and server authority.
- [ ] Detect duplicate systems and naming conflicts.
- [ ] Add static checks for common memory, performance, and DataStore errors.

### 5.4 Animation

- [x] Attach an existing Roblox animation ID to a rig.
- [x] Define the animation-upload tool contract.
- [x] Generate TweenService scripts from typed tween specifications.
- [x] Generate typed Pose/Motor6D KeyframeSequence animation data.
- [x] Serialize agent animation specifications into Studio KeyframeSequence instances.
- [x] Open Roblox's authenticated native publishing workflow with confirmation.
- [ ] Capture and confirm creator ownership from the user-provided published asset ID.
- [x] Preview KeyframeSequences on a target rig with a temporary Studio-only ID.
- [ ] Create camera animation and cutscene sequencing.

### 5.5 Assets

The agent should eventually support all three acquisition paths:

1. **Self-generated Roblox geometry** using Parts, MeshParts, materials, terrain, and effects.
2. **Roblox/Toolbox assets** with ownership, safety, script, and license inspection.
3. **External generated assets** using services such as Meshy, followed by conversion and Studio import.

Implementation tasks:

- [x] Define an external asset-generation tool contract.
- [x] Add Meshy authentication and job polling.
- [x] Download generated GLB/FBX files with trusted-host and 50 MB limits.
- [ ] Convert scale, orientation, materials, and rig data for Roblox.
- [ ] Complete generated-asset import through Studio's native 3D Importer.
- [x] Add Creator Store search and quarantined insert operations.
- [x] Scan imported models for scripts and unsafe behavior.
- [x] Track asset provenance and import metadata.

### 5.6 Testing and validation

- [x] Evaluate structured tool success and failure.
- [x] Trigger Reflexion after failed or inconclusive attempts.
- [x] Unit-test basic evaluator behavior.
- [x] Add play-mode-assisted runtime observation.
- [x] Capture ScriptContext errors and Studio output messages.
- [ ] Add typed runtime assertions for instances, properties, UI, scores, and player state.
- [ ] Test client/server replication.
- [ ] Compare visual output with user-supplied references.
- [ ] Score completion against explicit acceptance criteria.

## 6. Hackathon execution plan

### Milestone A — Runnable foundation

Status: **Complete**

- Independent TypeScript project created.
- Claude Sonnet 4 configured as the default model.
- Backend API and Studio command queue implemented.
- Studio plugin panel implemented.
- ReAct loop, evaluator, Reflexion engine, and lesson store implemented.
- TypeScript validation and initial tests passing.

Exit criteria:

- Backend starts on `localhost:3100`.
- `/health` reports the expected model.
- Studio plugin connects to the backend.

### Milestone B — Reliable building demo

Priority: **Critical**

- [x] Install and open the plugin in Roblox Studio.
- [x] Verify hierarchy scanning against a real place.
- [x] Verify instance creation and property conversion.
- [x] Verify Luau script creation.
- Test `build_from_spec` with at least 20 instances.
- Fix any Studio-specific serialization or API errors.
- Add rollback for partially failed batch construction.

Exit criteria:

- The agent creates a small environment and gameplay script from one prompt.
- The resulting place remains editable and organized.
- Failed batch changes can be reverted.

### Milestone C — Animation demo

Priority: **High**

- Apply a known owned animation asset to a compatible rig.
- Generate and install TweenService animation scripts.
- Confirm that asset IDs and Animator placement are correct.
- If upload credentials are ready, implement KeyframeSequence upload.
- If upload is blocked, demonstrate existing asset application and explain the upload adapter honestly.

Exit criteria:

- At least one object and one rig visibly animate in Studio play mode.

### Milestone D — Evidence and Reflexion demo

Priority: **Critical**

- Add runtime error collection or a manual Play-assisted observer.
- Create one intentionally broken feature.
- Demonstrate evidence collection.
- Show the reflection identifying the failure without inventing evidence.
- Apply a revised implementation.
- Verify the second attempt.

Exit criteria:

- The presentation visibly demonstrates: failure → evidence → reflection → repair → validation.

### Milestone E — Presentation polish

Priority: **Critical**

- [ ] Use a clean empty or lightly prepared Roblox place.
- [x] Prepare tested demo prompts and a hackathon runbook.
- [ ] Preconfigure funded API keys and HTTP permissions.
- Keep the backend terminal visible for trace evidence.
- Prepare a short recorded fallback.
- Avoid untested asset uploads during the live presentation.

Suggested flagship prompt:

> Build a compact neon dungeon with a collectible key, an animated door, one enemy, a health UI, atmospheric lighting, and a victory portal. Use server-authoritative gameplay code, organize everything clearly, and validate the main gameplay path.

## 7. Acceptance criteria

### Agent behavior

- The agent scans before editing.
- All mutations occur through registered tools.
- Tool failures are returned to the agent as observations.
- The agent does not claim unsupported playtest or screenshot capabilities.
- Reflexion uses actual failure evidence.
- The agent stops after configured iteration and retry limits.

### Studio integration

- The plugin connects to the local backend.
- Safe additions execute without confirmation.
- Deletion and script replacement require explicit confirmation.
- Created instances use valid parents and properties.
- Generated scripts appear in the requested Roblox service.
- Backend timeouts do not freeze Studio permanently.

### Game quality

- Gameplay authority resides on the server where appropriate.
- Client RemoteEvent input is validated.
- Systems are organized into clear services and folders.
- Generated loops and connections avoid obvious leaks.
- The flagship demo has a clear playable objective.

### Animation

- The target rig has an Animator-compatible hierarchy.
- Animation ownership matches the experience owner.
- Uploaded or applied asset IDs are recorded in the execution result.
- Animation failures do not silently count as task success.

## 8. Security and safety plan

### Automatically allowed

- Project scanning and inspection.
- Creating new instances and scripts.
- Adding folders, attributes, tags, and new systems.
- Applying low-risk visual properties.
- Adding animation objects without deleting existing assets.

### Confirmation required

- Deleting instances.
- Replacing existing script source.
- Bulk destructive changes.
- Modifying monetization or DataStore behavior.
- Publishing the place.
- Uploading paid or externally visible assets.
- Importing Toolbox models containing executable scripts.

### Required additions

- Change snapshots before mutation.
- Per-command undo records.
- Atomic batch rollback.
- Maximum mutation scope per task.
- Script source size and path limits.
- Asset source and ownership checks.

## 9. Red-team critique

### Risk: “Any genre” becomes shallow generality

The agent can remain genre-neutral, but it cannot guarantee polished design in every genre without specialized knowledge and testing. General tools should be paired with composable system patterns, such as rounds, inventory, combat, quests, NPCs, vehicles, tycoons, and obstacle courses.

**Mitigation:** Prove generality with two contrasting prompts after the flagship demo rather than attempting every genre live.

### Risk: The model grades its own work

Successful tool calls do not prove that a game is playable. The initial evaluator is necessary but not sufficient.

**Mitigation:** Prioritize runtime assertions and error capture over adding more prompting rules.

### Risk: Reflexion repeats ineffective actions

A language model may describe a new strategy while producing effectively identical tool calls.

**Mitigation:** Hash normalized tool name/input pairs and reject repeated failed actions unless new evidence justifies them.

### Risk: Safe-looking edits can still break a game

Property changes are not classified as destructive, but changing a SpawnLocation, collision property, or RemoteEvent arrangement can be behaviorally destructive.

**Mitigation:** Add a change journal and expand risk classification based on path, property, and mutation size.

### Risk: Animation upload fails during the demo

Roblox asset ownership, authentication, moderation, serialization, and rig compatibility create multiple external failure points.

**Mitigation:** Demonstrate a known owned animation ID first. Treat live uploading as an optional extension.

### Risk: External assets contain unsafe content

Toolbox models can contain scripts, and generated assets can have invalid topology, scale, or licensing metadata.

**Mitigation:** Import into quarantine, scan contents, remove scripts by default, validate geometry, and require approval before insertion.

### Risk: Live infrastructure failure

The demo depends on Roblox Studio, local HTTP permissions, the backend, API credentials, network access, and model availability.

**Mitigation:** Perform a full rehearsal, keep a stable local place, cache no secrets in the repository, and prepare a recorded fallback.

## 10. Post-hackathon roadmap

### Phase 1 — Reliability

- Transaction journal and rollback.
- Real runtime observation.
- Better acceptance-criteria evaluator.
- Semantic repeated-action detection.
- Context compression and trace viewer.

### Phase 2 — Creation depth

- Terrain, lighting, UI, VFX, and constraint builders.
- Reusable gameplay-system patterns.
- Roblox animation upload.
- Meshy and Toolbox pipelines.
- Visual reference reconstruction.

### Phase 3 — Platform expansion

- MCP wrapper around the existing tool registry.
- Windows plugin installation support.
- Multiple model providers through a model router.
- Optional specialized sub-agents for building, scripting, animation, and testing.
- Project-level validated memory and reusable lessons.

## 11. Immediate next actions

1. Configure `.env` with `ANTHROPIC_API_KEY` and a non-default `AGENT_API_KEY`.
2. Match the plugin `API_KEY` to the backend configuration.
3. Install the plugin with `./studio-plugin/sync.sh`.
4. Enable Roblox Studio HTTP requests.
5. Run a real project scan and creation test.
6. Implement batch rollback before attempting a large build.
7. Add Play-assisted runtime error capture.
8. Rehearse the flagship prompt end to end.
9. Record a fallback demo.

## 12. Definition of done

The hackathon MVP is complete when a user can enter one natural-language request and watch the agent:

1. Inspect the open Roblox project.
2. Plan a coherent game feature.
3. Build instances and write Luau code.
4. Add visible animation.
5. Collect evidence about the result.
6. Detect at least one demonstrated failure.
7. Reflect and apply a revised strategy.
8. Finish with a concise evidence-backed report.
