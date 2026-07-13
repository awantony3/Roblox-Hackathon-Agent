# Animation generation, preview, and publishing

## Supported workflow

The agent can:

1. Generate a typed `KeyframeSequence` with nested `Pose` instances.
2. Set animation loop and priority metadata.
3. Register a temporary `active://` animation ID for local Studio preview.
4. Play the preview on a rig containing a `Humanoid` or `AnimationController`.
5. Request explicit confirmation before opening Roblox Studio's native upload window.
6. Attach the real published animation ID to a rig after the user provides it.

## Why publishing is interactive

Roblox's Open Cloud Assets documentation currently lists supported upload types such as models, meshes, images, audio, decals, and video, but does not list animation uploads. Roblox's animation documentation describes publishing animations through Studio's Animation Editor.

The agent therefore does not use unofficial cookie endpoints or claim that an upload completed when it only opened a dialog.

Official references:

- [Roblox Assets API usage guide](https://create.roblox.com/docs/cloud/guides/usage-assets)
- [Roblox animation publishing tutorial](https://create.roblox.com/docs/tutorials/use-case-tutorials/animation/create-an-animation)
- [KeyframeSequenceProvider reference](https://create.roblox.com/docs/reference/engine/classes/KeyframeSequenceProvider)
- [Plugin SaveSelectedToRoblox reference](https://create.roblox.com/docs/reference/engine/classes/Plugin)

## Example animation specification

```json
{
  "parent": "ServerStorage.RBX_ANIMSAVES",
  "name": "AgentWave",
  "loop": true,
  "priority": "Action",
  "keyframes": [
    {
      "time": 0,
      "poses": [
        {
          "name": "HumanoidRootPart",
          "children": [
            {
              "name": "UpperTorso",
              "children": [
                {
                  "name": "RightUpperArm",
                  "cframe": {
                    "rotation": { "x": 0, "y": 0, "z": -40 }
                  }
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "time": 0.5,
      "poses": [
        {
          "name": "HumanoidRootPart",
          "children": [
            {
              "name": "UpperTorso",
              "children": [
                {
                  "name": "RightUpperArm",
                  "cframe": {
                    "rotation": { "x": 0, "y": 0, "z": 40 }
                  },
                  "easingStyle": "Sine",
                  "easingDirection": "InOut"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Safety limits

- Maximum 300 keyframes per generated sequence.
- Maximum 2,000 poses per generated sequence.
- Publishing requires confirmation because it creates an externally visible Roblox asset.
- Temporary preview IDs are marked `studioOnly` and must never be stored as published IDs.
- Opening the upload window produces `requiresUserCompletion: true`, so the outcome evaluator cannot report false completion.

## Remaining work

- Verify the supplied asset ID belongs to the correct user or group.
- Capture moderation and availability state after publishing.
- Generate richer animation markers.
- Add preview stop, pause, speed, and looping controls.
- Add rig-joint validation before sequence creation.
