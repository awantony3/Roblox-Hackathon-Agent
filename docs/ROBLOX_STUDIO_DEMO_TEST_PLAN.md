# Roblox Studio Demo Test Plan

## Objective

Validate the Roblox Hackathon Agent end to end inside Roblox Studio. This plan tests:

1. ReAct building and verification.
2. Play-assisted runtime evidence.
3. Reflexion after a controlled failure.
4. Keyframe animation generation and preview.
5. Creator Store quarantine and external asset workflows.

Run the tests in order. Later tests reuse objects created by earlier tests.

## Safety boundary

Use a new disposable Baseplate place or a local copy of a non-production place.

Do not run this plan in a production experience containing irreplaceable work. Do not publish the place until all generated changes have been reviewed.

The demos create isolated content under:

```text
Workspace.AgentDemo
ServerStorage.AgentAssetQuarantine
ServerStorage.AgentDemoAnimations
```

## Prerequisites

### Backend configuration

From Terminal:

```bash
cd /Users/antonywang/roblox-hackathon-agent
cp .env.example .env
```

Configure `.env`:

```env
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5.6
PORT=3100
AGENT_API_KEY=your-local-agent-key
MAX_REACT_ITERATIONS=20
MAX_REFLEXION_ATTEMPTS=2
STUDIO_COMMAND_TIMEOUT_MS=30000
MESHY_API_KEY=optional-production-meshy-key
```

The OpenAI API project must have available credit and access to the configured model. A syntactically valid key without access or credit cannot run the ReAct or Reflexion demos.

### Verify the project

```bash
npm install
npm run typecheck
npm test
npm run doctor
```

Expected result:

```text
READY
```

Meshy is optional and does not block core readiness.

### Install the plugin

```bash
./studio-plugin/sync.sh
```

Restart Roblox Studio after installation.

### Studio preparation

1. Open a new Baseplate place.
2. Enable **Game Settings → Security → Allow HTTP Requests**.
3. Confirm the latest `RobloxHackathonAgent.lua` plugin is enabled.
4. Open **View → Output**.
5. Open **View → Explorer** and **View → Properties**.
6. Open the **Roblox AI Agent** plugin panel.

### Start the backend

```bash
cd /Users/antonywang/roblox-hackathon-agent
npm start
```

Keep this terminal visible during the demo.

### Check readiness

Use the configured API key:

```bash
curl -H "X-API-Key: your-local-agent-key" \
  http://localhost:3100/api/status
```

Pass conditions:

- `ready` is `true`.
- `blockers` is empty.
- `connectedSessions` is at least `1`.
- The capability list contains 26 tools.

## Evidence record

For each demo, record:

```text
Start time:
End time:
Prompt:
Agent result:
Studio objects created:
Tool failures:
Runtime errors:
Reflexion attempts:
Pass or fail:
Notes:
```

Capture screenshots of:

- The plugin response.
- The relevant Explorer hierarchy.
- The viewport result.
- Output or runtime evidence.
- Any destructive confirmation dialog.

---

# Demo A — ReAct Building

## Goal

Verify that the agent scans the existing project, builds multiple objects efficiently, generates TweenService code, inspects its work, and performs structural validation.

## Exact prompt

Paste this into the agent panel:

> Inspect this project first. Create a small neon obstacle section isolated under a new Model named AgentDemo in Workspace. Add five anchored neon platforms arranged as a short playable path and one separate moving platform. Name every object clearly. Generate a TweenService server Script that moves the moving platform back and forth safely. Do not alter or delete existing project content. After building, inspect Workspace.AgentDemo and run structural validation. Report the created paths, tween script path, and validation evidence.

## Expected ReAct sequence

```text
scan_project
→ build_from_spec or multiple create tools
→ create_tween
→ get_instance or find_instances
→ validate_project
→ final evidence report
```

The precise tool order may vary, but scanning must occur before mutation and verification must occur after the final mutation.

## Operator actions

1. Submit the prompt.
2. Do not approve any request to delete or replace existing content.
3. Watch `Workspace.AgentDemo` appear in Explorer.
4. Expand the model and inspect its children.
5. Select the platforms and check their properties.
6. Open the generated TweenService script.

## Expected hierarchy

Names may vary slightly, but the structure should resemble:

```text
Workspace
└── AgentDemo
    ├── Platform1
    ├── Platform2
    ├── Platform3
    ├── Platform4
    ├── Platform5
    └── MovingPlatform

ServerScriptService
└── MovingPlatformTween
```

The tween script can alternatively be placed under `Workspace.AgentDemo` if the agent explicitly chooses and validates that location.

## Property checks

Static platforms:

- `Anchored = true`
- `Material = Neon`
- Sizes are playable rather than paper-thin.
- Positions form a reachable path.

Moving platform:

- `Anchored = true`
- Has a clear destination offset.
- Tween script resolves the target safely.
- Tween loops or reverses as requested.

## Pass criteria

- Project scan occurred before mutation.
- Exactly one isolated `AgentDemo` model was created.
- Five static platforms exist.
- One moving platform exists.
- A TweenService script exists.
- Follow-up inspection occurred after creation.
- Structural validation returned no errors.
- Existing project content was not changed.

## Fail conditions

- The agent reports success without reading the created model.
- The agent modifies existing content outside the isolated model.
- The moving platform is unanchored without an intentional physics design.
- The tween target path is invalid.
- Structural validation is missing or reports unresolved errors.

## Manual visual check

Move the Studio camera around the obstacle section. Confirm platforms do not overlap unintentionally and form a coherent path.

---

# Demo B — Runtime Evidence

## Goal

Verify that the plugin observes Play mode, collects player state, captures runtime errors, and evaluates explicit assertions.

## Exact prompt

After Demo A passes, submit:

> Prepare to runtime-test Workspace.AgentDemo. Ask me to press Play before calling the runtime test. During the observation window, assert that there is at least one player, Workspace.AgentDemo exists, Workspace.AgentDemo.MovingPlatform exists, and no new runtime errors occur. Observe for five seconds and report every assertion with its actual and expected values.

## Operator actions

1. Wait until the agent asks for Play mode.
2. Press **Play** in Roblox Studio.
3. Wait for the player character to spawn.
4. If needed, tell the agent: `Play mode is running now. Continue the runtime test.`
5. Let the five-second observation complete.
6. Do not stop Play mode until the agent reports results.
7. Press **Stop** after evidence is returned.

## Expected assertions

```json
[
  { "type": "player_count_at_least", "value": 1 },
  { "type": "instance_exists", "path": "Workspace.AgentDemo" },
  {
    "type": "instance_exists",
    "path": "Workspace.AgentDemo.MovingPlatform"
  },
  { "type": "no_errors" }
]
```

## Expected evidence

- `isRunning = true`
- `playerCount >= 1`
- Player has a character.
- Humanoid health and maximum health are reported.
- Target instances exist.
- No new ScriptContext errors occurred during the window.

## Pass criteria

- The agent does not claim a runtime test while Studio is in Edit mode.
- All assertions include expected and actual values.
- Player state is present.
- `no_errors` passes.
- The moving platform visibly moves during Play mode.

## Fail conditions

- Runtime testing starts before the user presses Play.
- The result contains only structural validation.
- Errors occur but the agent reports `no_errors` as passed.
- The moving platform does not move.

## If the tween fails

Do not manually fix it yet. Preserve the failure for Demo C if it is isolated and safe.

---

# Demo C — Reflexion

## Goal

Demonstrate a controlled failure followed by evidence-grounded reflection, a revised strategy, and verification.

## Preferred controlled failure

Use an invalid target path inside the isolated demo. Do not damage existing game systems.

## Exact prompt

Submit:

> 


## Expected trace

```text
get_instance(Workspace.AgentDemo.MissingReflectionTarget)
→ failure: instance not found
→ evaluation: failed
→ Reflexion
→ revised scan or inspection of Workspace.AgentDemo
→ discovered real path
→ get_instance(real moving-platform path)
→ verification passed
```

## Required reflection fields

```text
outcome
evidence
rootCauses
failedApproaches
revisedStrategy
retryRecommended
```

## Pass criteria

- A real tool failure is recorded.
- The reflection cites the actual missing path.
- The agent does not invent a runtime error.
- The revised strategy differs from the failed action.
- The identical failed action is not repeated without new evidence.
- The actual target is discovered through inspection.
- Final verification succeeds.

## Fail conditions

- The agent fabricates a cause unrelated to the observation.
- It repeatedly calls the same missing path without new evidence.
- It creates `MissingReflectionTarget` to make the original assumption appear correct.
- It reports success without verifying the discovered object.

## Optional runtime Reflexion variant

If Demo B produced a safe isolated tween error, ask the agent to:

1. Read the runtime error and stack trace.
2. Inspect the tween script.
3. Patch only the isolated tween script.
4. Ask for Play mode again.
5. Rerun `no_errors` and instance assertions.

Script patching requires destructive confirmation. Approve it only after reading the exact isolated script path and patch request.

---

# Demo D — Animation

## Goal

Verify KeyframeSequence creation, temporary local preview, and honest publishing boundaries.

## Preparation

Insert an R15 rig using Roblox Studio's Rig Builder and name it:

```text
AgentDemoRig
```

Place it under `Workspace.AgentDemo`.

## Exact prompt

Submit:

> Inspect Workspace.AgentDemo.AgentDemoRig and confirm it is an R15 rig with a Humanoid or AnimationController. Create ServerStorage.AgentDemoAnimations if it does not exist. Generate a short looping KeyframeSequence named AgentWave with at least three keyframes that raises and waves the right arm using nested R15 poses. Preview it on Workspace.AgentDemo.AgentDemoRig using a temporary Studio-only animation ID. Report the sequence path, keyframe count, pose count, duration, temporary ID, and whether playback started. Do not publish it yet.

## Expected sequence

```text
inspect rig
→ create folder if needed
→ create_keyframe_sequence
→ preview_keyframe_sequence
→ temporary active:// ID
→ visual review
```

## Operator actions

1. Confirm the rig exists and is named correctly.
2. Submit the prompt.
3. Watch the rig's right arm.
4. Rotate the viewport camera to verify the motion.
5. Check `ServerStorage.AgentDemoAnimations.AgentWave`.

## Pass criteria

- A valid KeyframeSequence is created.
- At least three keyframes exist.
- Nested poses reference valid R15 joint names.
- The temporary ID begins with `active://`.
- The temporary ID is labeled Studio-only.
- The rig visibly previews the animation.
- The agent does not claim the animation is published.

## Native publishing test

Only run this if the Roblox account and experience ownership are correct.

Prompt:

> Open the confirmed native Roblox publishing workflow for ServerStorage.AgentDemoAnimations.AgentWave. Do not report an uploaded asset ID unless I complete the Roblox window and provide the real ID.

Operator actions:

1. Read the destructive/external confirmation request.
2. Approve only the KeyframeSequence publishing action.
3. Complete Roblox's native upload window.
4. Copy the resulting animation asset ID.
5. Send: `The published animation ID is <ID>. Attach it to AgentDemoRig and verify the Animation object.`

Publishing passes only when:

- The native authenticated window opens.
- The agent reports `requiresUserCompletion` before receiving the ID.
- No fake asset ID is generated.
- The supplied numeric ID is attached and read back.

---

# Demo E — Assets

## Goal

Verify Creator Store discovery, quarantine, script scanning, confirmation, script removal, provenance, and optional Meshy generation.

## Demo E1 — Creator Store search

Exact prompt:

> Search the Roblox Creator Store for low-poly treasure chest models. Return up to ten results with asset ID, name, and creator. Do not insert anything yet. Recommend one result for quarantine review, but do not treat creator popularity as proof of safety.

Pass criteria:

- Results contain asset IDs.
- Nothing is inserted during search.
- The agent explicitly states that search metadata does not prove safety.

## Demo E2 — Quarantine and scan

Choose one free model asset ID from the search, then submit:

> Load Creator Store asset <ASSET_ID> into quarantine only. Do not place it in Workspace. Show the quarantine path, sandbox state, script count, suspicious-script count, every script path, source length, and detected risks. Wait for my approval before final insertion.

Expected location:

```text
ServerStorage.AgentAssetQuarantine.Asset_<ASSET_ID>
```

Pass criteria:

- The asset enters ServerStorage quarantine.
- It does not enter Workspace.
- Script scan results are shown.
- Provenance attributes are present.
- No contained scripts execute from quarantine.

## Demo E3 — Approved insertion

After reviewing the scan, submit:

> Approve the quarantined asset at ServerStorage.AgentAssetQuarantine.Asset_<ASSET_ID> for insertion under Workspace.AgentDemo. Remove every Script, LocalScript, and ModuleScript before insertion. Report the final path, removed script count, and provenance attributes. Inspect the inserted model afterward.

Operator actions:

1. Read the destructive confirmation carefully.
2. Verify the path is inside `AgentAssetQuarantine`.
3. Verify `allowScripts` is false.
4. Approve the request.

Pass criteria:

- Confirmation is required.
- Scripts are removed.
- The asset moves beneath `Workspace.AgentDemo`.
- `AgentApproved = true`.
- `AgentScriptsRemoved` matches the removal count.
- Follow-up inspection occurs.

Reject the request if it attempts to preserve suspicious scripts.

## Demo E4 — Optional Meshy test mode

Use Meshy's official test key only for contract validation. It returns sample data and consumes no credits.

```env
MESHY_API_KEY=msy_dummy_api_key_for_test_mode_12345678
```

Restart the backend after changing `.env`.

Exact prompt:

> Generate a low-poly neon sci-fi treasure chest using Meshy. Start a moderated preview job, report the job ID, poll it until completion without claiming it is imported, and report the GLB and FBX artifact availability and provenance. Do not download or import it until I approve.

Pass criteria:

- The first result includes `requiresPolling`.
- The job ID is preserved.
- Polling reports a valid state.
- Completed generation includes `requiresUserCompletion`.
- The agent does not claim the artifact is in Roblox.

Optional download prompt:

> Download the verified GLB artifact from the completed Meshy job. Enforce the trusted Meshy hostname and 50 MB limit. Report the local file path and wait for native Studio import.

The download passes only when:

- The URL came from the polled job.
- HTTPS and Meshy hostname validation passed.
- Size is at most 50 MB.
- The result remains incomplete pending native import.

---

# Final Combined Acceptance Test

Run after Demos A–E.

Submit:

> Inspect the complete AgentDemo test area and summarize only verified results. List the obstacle model, platform count, tween script, runtime-test evidence, Reflexion failure and recovery, animation sequence and preview status, approved Creator Store assets, removed script count, and any external asset still awaiting user import. Run one final structural validation. Clearly separate passed evidence, failed evidence, and user-completion items.

## Overall pass criteria

- ReAct builds and verifies Studio content.
- Runtime assertions use real Play-mode evidence.
- Reflexion responds to an actual controlled failure.
- Animation preview uses a temporary ID honestly.
- Native publishing remains user-controlled.
- Creator Store content enters quarantine before the game.
- Third-party scripts are removed by default.
- External jobs do not count as imported assets.
- Final structural validation passes.
- Existing non-demo content remains untouched.

## Cleanup

Stop Play mode before cleanup.

Delete only these test objects:

```text
Workspace.AgentDemo
ServerStorage.AgentDemoAnimations
ServerStorage.AgentAssetQuarantine
ServerScriptService.MovingPlatformTween
```

The tween script name or location may differ. Confirm its actual path from Demo A evidence.

Cleanup options:

1. Use Studio Undo in reverse order.
2. Delete the isolated objects manually.
3. Ask the agent to delete the exact paths and approve each destructive request.

Do not approve a cleanup request that targets an entire Roblox service or any path outside the isolated demo objects.

## Test result summary

```text
Demo A — ReAct building:       PASS / FAIL
Demo B — Runtime evidence:     PASS / FAIL
Demo C — Reflexion:            PASS / FAIL
Demo D — Animation:            PASS / FAIL
Demo E — Assets:               PASS / FAIL
Final structural validation:   PASS / FAIL

Critical failures:
Warnings:
External blockers:
Artifacts awaiting user action:
Overall result:                PASS / FAIL
```
