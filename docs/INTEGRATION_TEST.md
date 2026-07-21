# Live Studio integration test

Date: 2026-07-12

## Environment

- Platform: macOS
- Backend: `http://localhost:3100`
- Original model configuration: legacy provider (the runtime now uses `gpt-5.6`)
- Studio place ID: `117814451127411`
- Studio game ID: `10485307397`

## Passed

- Roblox Studio plugin connected and maintained a live heartbeat.
- Project hierarchy and script source were captured.
- `ServerStorage.AgentIntegrationTest` was created without touching existing systems.
- `VerificationPart` was created with typed properties.
- `{x:4,y:1,z:4}` decoded to `Vector3.new(4,1,4)`.
- RGB `{r:50,g:200,b:120}` decoded to the correct `Color3` values.
- Material string `Neon` decoded to `Enum.Material.Neon`.
- `VerificationModule` was created with exact Luau source.
- The created hierarchy, properties, and source were read back successfully.
- Structural validation returned zero errors.

## Issues found and fixed

- The session status endpoint returned full project snapshots, including large script sources. It now returns connection metadata only.
- Studio destructive confirmation lasted longer than the backend command timeout. Confirmation now expires after 20 seconds, before the 30-second backend timeout.
- The shared action button could also trigger a new agent request while acting as an approval button. Agent submission is now disabled during confirmation.

## External blocker

The original live model-driven task could not start because the configured legacy provider account had insufficient credit. The plugin and command protocol were therefore tested directly through the authenticated diagnostic endpoint. The current runtime uses the OpenAI API.

## Cleanup

The isolated `ServerStorage.AgentIntegrationTest` folder remains in the open place because its deletion correctly requires confirmation. It can be deleted manually or through the agent after restarting Studio with the updated plugin and approving the request.
