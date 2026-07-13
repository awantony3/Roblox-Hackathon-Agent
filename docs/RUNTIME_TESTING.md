# Play-assisted runtime testing

Roblox Studio plugins cannot reliably start Play mode themselves. The agent therefore uses a cooperative workflow:

1. The agent builds or repairs a feature.
2. The plugin asks the user to press **Play**.
3. Once Studio is running, the agent calls `run_playtest`.
4. The plugin observes a bounded window of runtime behavior.
5. Assertions and runtime errors become evidence for the outcome evaluator and Reflexion loop.

## Captured evidence

- Whether Studio is running or editing.
- ScriptContext error message, stack trace, script path, and timestamp.
- A bounded ring buffer of Studio output messages.
- Player count.
- Player character presence.
- Humanoid health and maximum health.

Buffers retain at most 200 items to prevent unbounded plugin memory growth.

## Supported assertions

```json
[
  { "type": "no_errors" },
  { "type": "instance_exists", "path": "Workspace.FinishPortal" },
  {
    "type": "property_equals",
    "path": "Workspace.FinishPortal",
    "property": "CanCollide",
    "value": false
  },
  { "type": "player_count_at_least", "value": 1 }
]
```

`run_playtest` waits between 0.25 and 15 seconds. This stays below the backend's 30-second Studio command timeout.

## Honest failure behavior

Calling `run_playtest` in Edit mode returns an error instructing the user to press Play. Structural validation remains available through `validate_project`, but it is not represented as runtime proof.

## Next runtime additions

- NPC and tagged-instance state capture.
- UI visibility/text assertions.
- Attribute and value assertions.
- RemoteEvent traffic diagnostics in agent-created wrappers.
- Performance sampling for frame time and instance growth.
